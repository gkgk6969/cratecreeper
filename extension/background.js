// cratecreep extension service worker.
//
// Transport: Supabase Realtime (was a local WebSocket bridge to the Electron
// app). The web app inserts queue_items via a server-side route; this worker
// subscribes to those rows, walks Beatport adding each to the cart, and writes
// status back with an UPDATE (RLS only permits UPDATE here, never INSERT).
//
// Auth: real Supabase access/refresh tokens handed over by the web dashboard
// through externally_connectable messaging. No hand-rolled JWTs, no service
// role key in the client.

importScripts('config.js', 'vendor/supabase.js');

const CONFIG = self.CRATE_DIGGER_CONFIG || {};
const SEARCH_URL = (q) =>
  `https://www.beatport.com/search?q=${encodeURIComponent(q)}`;

// Random inter-track delay (ms). Beatport's bot detector trips on rapid-fire
// programmatic navigation - 3-7s with jitter mimics a human browsing.
const INTER_TRACK_DELAY_MS = [3000, 7000];
const rand = (a, b) => a + Math.random() * (b - a);

// Hard ceiling per track. If the content script never reports back (page never
// loaded, script crashed, etc.) the watchdog marks the track errored and moves
// on so the queue can't freeze on one stuck track.
const TRACK_TIMEOUT_MS = 45000;

let sb = null; // Supabase client
let channel = null; // Realtime channel
let loadDebounce = null;
let trackWatchdog = null; // timer id for the current track's stall guard

const STATE = {
  queue: null, // { sessionId, tracks: [{ id, rowId, idx, artist, title, mix }] }
  statuses: {}, // keyed by track.id (== array index)
  running: false,
  currentIdx: -1,
  tabId: null,
  debug: false,
  paired: false,
  email: null,
  realtimeConnected: false,
};

// --- persistence (local, survives service-worker restarts) ----------------
async function loadState() {
  try {
    const stored = await chrome.storage.local.get([
      'queue',
      'statuses',
      'running',
      'currentIdx',
      'tabId',
      'debug',
      'email',
    ]);
    Object.assign(STATE, stored);
  } catch {}
}

async function saveState() {
  try {
    await chrome.storage.local.set({
      queue: STATE.queue,
      statuses: STATE.statuses,
      running: STATE.running,
      currentIdx: STATE.currentIdx,
      tabId: STATE.tabId,
      debug: STATE.debug,
      email: STATE.email,
    });
  } catch {}
}

async function loadTokens() {
  const { access_token, refresh_token } = await chrome.storage.local.get([
    'access_token',
    'refresh_token',
  ]);
  return access_token && refresh_token ? { access_token, refresh_token } : null;
}

async function saveTokens(access_token, refresh_token) {
  await chrome.storage.local.set({ access_token, refresh_token });
}

async function clearTokens() {
  await chrome.storage.local.remove(['access_token', 'refresh_token']);
}

function notifyPopup() {
  chrome.runtime.sendMessage({ type: 'state', state: STATE }).catch(() => {});
}

// --- Supabase wiring -------------------------------------------------------
function makeClient() {
  if (!CONFIG.SUPABASE_URL || !CONFIG.SUPABASE_ANON_KEY) {
    console.warn('[crate-digger] missing Supabase config');
    return null;
  }
  return self.supabase.createClient(
    CONFIG.SUPABASE_URL,
    CONFIG.SUPABASE_ANON_KEY,
    { auth: { persistSession: false, autoRefreshToken: true } }
  );
}

// Initialise (or re-initialise) the Supabase session from stored tokens.
async function initSupabase() {
  const tokens = await loadTokens();
  if (!tokens) {
    STATE.paired = false;
    notifyPopup();
    return false;
  }

  if (!sb) sb = makeClient();
  if (!sb) return false;

  const { data, error } = await sb.auth.setSession({
    access_token: tokens.access_token,
    refresh_token: tokens.refresh_token,
  });

  if (error || !data?.session) {
    console.warn('[crate-digger] setSession failed', error?.message);
    STATE.paired = false;
    await clearTokens();
    notifyPopup();
    return false;
  }

  // Persist any refreshed tokens so we stay paired across restarts.
  sb.auth.onAuthStateChange((event, session) => {
    if (session?.access_token && session?.refresh_token) {
      saveTokens(session.access_token, session.refresh_token);
      sb.realtime.setAuth(session.access_token);
    }
    if (event === 'SIGNED_OUT') {
      STATE.paired = false;
      notifyPopup();
    }
  });

  STATE.paired = true;
  STATE.email = data.session.user?.email ?? null;
  await saveState();

  sb.realtime.setAuth(data.session.access_token);
  subscribeRealtime(data.session.user.id);
  notifyPopup();
  return true;
}

function subscribeRealtime(userId) {
  if (channel) {
    try {
      sb.removeChannel(channel);
    } catch {}
    channel = null;
  }

  channel = sb
    .channel('cd-queue')
    .on(
      'postgres_changes',
      {
        event: 'INSERT',
        schema: 'public',
        table: 'queue_items',
        filter: `user_id=eq.${userId}`,
      },
      (payload) => {
        const row = payload.new;
        if (row?.state === 'pending' && row?.session_id) {
          scheduleLoadSession(row.session_id);
        }
      }
    )
    .subscribe((status) => {
      STATE.realtimeConnected = status === 'SUBSCRIBED';
      notifyPopup();
    });
}

// Realtime INSERTs arrive one row at a time; debounce, then fetch the whole
// session in order so we never start on a partial queue.
function scheduleLoadSession(sessionId) {
  clearTimeout(loadDebounce);
  loadDebounce = setTimeout(() => loadSession(sessionId, true), 1000);
}

async function loadSession(sessionId, autostart) {
  if (!sb) return;
  const { data, error } = await sb
    .from('queue_items')
    .select('id, idx, artist, title, mix, state, detail, product_url')
    .eq('session_id', sessionId)
    .order('idx');

  if (error || !data || data.length === 0) {
    if (error) console.warn('[crate-digger] loadSession failed', error.message);
    return;
  }

  STATE.queue = {
    sessionId,
    tracks: data.map((r, i) => ({
      id: i,
      rowId: r.id,
      idx: r.idx,
      artist: r.artist,
      title: r.title,
      mix: r.mix || null,
    })),
  };
  STATE.statuses = {};
  data.forEach((r, i) => {
    STATE.statuses[i] = {
      state: r.state || 'pending',
      detail: r.detail || null,
      productUrl: r.product_url || null,
    };
  });
  STATE.running = false;
  STATE.currentIdx = -1;
  await saveState();
  notifyPopup();

  if (autostart) startQueue();
}

// Push a track's current status back to its queue_items row (UPDATE-only).
async function pushStatus(index) {
  const track = STATE.queue?.tracks?.[index];
  const st = STATE.statuses[index];
  if (!sb || !track?.rowId || !st) return;
  try {
    await sb
      .from('queue_items')
      .update({
        state: st.state,
        detail: st.detail ?? null,
        product_url: st.productUrl ?? null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', track.rowId);
  } catch (e) {
    console.warn('[crate-digger] status update failed', e);
  }
}

function setStatus(trackId, patch) {
  STATE.statuses[trackId] = { ...(STATE.statuses[trackId] || {}), ...patch };
  saveState();
  pushStatus(trackId);
  notifyPopup();
}

// --- Beatport tab + queue walking (unchanged behaviour) --------------------
async function ensureBeatportTab() {
  if (STATE.tabId) {
    try {
      const tab = await chrome.tabs.get(STATE.tabId);
      if (tab) return tab;
    } catch {}
  }
  const tab = await chrome.tabs.create({
    url: 'https://www.beatport.com/',
    active: false,
  });
  STATE.tabId = tab.id;
  await saveState();
  return tab;
}

// Build the Beatport search query. Include a distinctive version/mix (e.g.
// "Underground Mix", "U&I Remix") so the right edition surfaces, but skip the
// generic "Original"/"Extended" labels which only add noise and can hurt recall.
function searchQueryFor(track) {
  let q = `${track.artist} ${track.title}`;
  const mix = (track.mix || '').trim();
  if (mix && !/^(original|extended)(\s+mix)?$/i.test(mix)) {
    q += ` ${mix}`;
  }
  return q;
}

async function navigateToTrack(track) {
  const tab = await ensureBeatportTab();
  const url = SEARCH_URL(searchQueryFor(track));
  await chrome.tabs.update(tab.id, { url, active: false });
  return tab.id;
}

function clearTrackWatchdog() {
  if (trackWatchdog) {
    clearTimeout(trackWatchdog);
    trackWatchdog = null;
  }
}

// Arm a stall guard for the track at `idx`. If it fires, the track is still
// stuck "searching" with no reply, so mark it errored and advance the queue.
function armTrackWatchdog(idx) {
  clearTrackWatchdog();
  trackWatchdog = setTimeout(async () => {
    trackWatchdog = null;
    if (!STATE.running || STATE.currentIdx !== idx) return;
    if (STATE.statuses[idx]?.state !== 'searching') return;
    setStatus(idx, {
      state: 'error',
      detail: 'timed out waiting for Beatport (no response)',
    });
    await saveState();
    const delay = rand(INTER_TRACK_DELAY_MS[0], INTER_TRACK_DELAY_MS[1]);
    setTimeout(() => processNext(), delay);
  }, TRACK_TIMEOUT_MS);
}

async function startQueue() {
  if (!STATE.queue || STATE.running) return;
  STATE.running = true;
  STATE.currentIdx = -1;
  await saveState();
  notifyPopup();
  await processNext();
}

async function processNext() {
  if (!STATE.running || !STATE.queue) return;

  const tracks = STATE.queue.tracks;
  let nextIdx = -1;
  for (let i = STATE.currentIdx + 1; i < tracks.length; i++) {
    const s = STATE.statuses[i]?.state || 'pending';
    if (s === 'pending' || s === 'captcha') {
      nextIdx = i;
      break;
    }
  }

  if (nextIdx === -1) {
    clearTrackWatchdog();
    STATE.running = false;
    STATE.currentIdx = -1;
    await saveState();
    notifyPopup();
    return;
  }

  STATE.currentIdx = nextIdx;
  const track = tracks[nextIdx];
  setStatus(nextIdx, { state: 'searching' });
  await saveState();
  armTrackWatchdog(nextIdx);

  try {
    await navigateToTrack(track);
  } catch (e) {
    clearTrackWatchdog();
    setStatus(nextIdx, { state: 'error', detail: e.message });
    await processNext();
  }
}

async function pauseQueue() {
  clearTrackWatchdog();
  STATE.running = false;
  await saveState();
  notifyPopup();
}

async function cancelQueue() {
  clearTrackWatchdog();
  STATE.running = false;
  STATE.queue = null;
  STATE.statuses = {};
  STATE.currentIdx = -1;
  await saveState();
  notifyPopup();
}

async function resetTrack(trackId) {
  if (!STATE.queue) return;
  setStatus(trackId, { state: 'pending', detail: null, productUrl: null });
  await saveState();
}

// --- Messaging from the popup (internal) -----------------------------------
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  (async () => {
    if (msg.type === 'getState') {
      sendResponse({
        state: STATE,
        connected: STATE.paired && STATE.realtimeConnected,
      });
      return;
    }
    if (msg.type === 'start') {
      await startQueue();
      sendResponse({ ok: true });
      return;
    }
    if (msg.type === 'pause') {
      await pauseQueue();
      sendResponse({ ok: true });
      return;
    }
    if (msg.type === 'cancel') {
      await cancelQueue();
      sendResponse({ ok: true });
      return;
    }
    if (msg.type === 'retry') {
      await resetTrack(msg.trackId);
      sendResponse({ ok: true });
      return;
    }
    if (msg.type === 'unpair') {
      await clearTokens();
      STATE.paired = false;
      STATE.email = null;
      if (channel) {
        try {
          sb.removeChannel(channel);
        } catch {}
        channel = null;
      }
      await saveState();
      notifyPopup();
      sendResponse({ ok: true });
      return;
    }
    if (msg.type === 'toggleDebug') {
      STATE.debug = !STATE.debug;
      await saveState();
      sendResponse({ debug: STATE.debug });
      notifyPopup();
      return;
    }
    if (msg.type === 'trackResult' && sender.tab?.id === STATE.tabId) {
      const idx = STATE.currentIdx;
      if (idx === -1) {
        sendResponse({ ok: false, reason: 'no current track' });
        return;
      }
      clearTrackWatchdog();
      setStatus(idx, {
        state: msg.state,
        detail: msg.detail || null,
        productUrl: msg.productUrl || null,
      });
      sendResponse({ ok: true });

      // Captcha: pause and rewind so "Start" resumes from this same track
      // after the user solves it manually.
      if (msg.state === 'captcha') {
        STATE.running = false;
        STATE.currentIdx = idx - 1;
        await saveState();
        notifyPopup();
        return;
      }

      const delay = rand(INTER_TRACK_DELAY_MS[0], INTER_TRACK_DELAY_MS[1]);
      setTimeout(() => processNext(), delay);
      return;
    }
    if (msg.type === 'requestCurrentTrack' && sender.tab?.id === STATE.tabId) {
      const idx = STATE.currentIdx;
      if (idx === -1 || !STATE.queue) {
        sendResponse({ track: null });
        return;
      }
      sendResponse({ track: STATE.queue.tracks[idx], debug: STATE.debug });
      return;
    }
    sendResponse({});
  })();
  return true;
});

// --- Messaging from the web dashboard (externally_connectable) -------------
chrome.runtime.onMessageExternal.addListener((msg, sender, sendResponse) => {
  (async () => {
    if (msg?.type === 'ping') {
      sendResponse({ ok: true, paired: STATE.paired, email: STATE.email });
      return;
    }
    if (msg?.type === 'pair' && msg.access_token && msg.refresh_token) {
      await saveTokens(msg.access_token, msg.refresh_token);
      const ok = await initSupabase();
      sendResponse({ ok, email: STATE.email });
      return;
    }
    if (msg?.type === 'startSession' && msg.sessionId) {
      await loadSession(msg.sessionId, true);
      sendResponse({ ok: true });
      return;
    }
    sendResponse({ ok: false });
  })();
  return true;
});

// --- keepalive: reconnect realtime if the worker was suspended -------------
chrome.alarms.create('cd-keepalive', { periodInMinutes: 0.4 });
chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name !== 'cd-keepalive') return;
  if (STATE.paired && (!channel || !STATE.realtimeConnected)) {
    initSupabase();
  }
});

chrome.runtime.onStartup.addListener(() => {
  loadState().then(initSupabase);
});
chrome.runtime.onInstalled.addListener(() => {
  loadState().then(initSupabase);
});

loadState().then(initSupabase);
