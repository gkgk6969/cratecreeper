const $ = (sel) => document.querySelector(sel);

const statusDot = $('#statusDot');
const statusText = $('#statusText');
const hintEl = $('#hint');
const dashboardLink = $('#dashboardLink');

const DASHBOARD_URL =
  (typeof self !== 'undefined' &&
    self.CRATE_DIGGER_CONFIG &&
    self.CRATE_DIGGER_CONFIG.DASHBOARD_URL) ||
  'https://cratecreeper-kh9c.vercel.app/dashboard';

dashboardLink.href = DASHBOARD_URL;

function render({ state, connected }) {
  const tracks = state.queue?.tracks || [];
  const statuses = state.statuses || {};
  const hasCaptcha = tracks.some(
    (t, i) => (statuses[t.id ?? i]?.state) === 'captcha'
  );
  const inCart = tracks.filter((t, i) => {
    const s = statuses[t.id ?? i]?.state;
    return s === 'added' || s === 'unconfirmed';
  }).length;

  statusDot.className = 'status-dot';
  hintEl.textContent = '';

  if (!state.paired) {
    statusDot.classList.add('off');
    statusText.textContent = 'Not connected';
    hintEl.textContent =
      'Open the dashboard and sign in — pairing happens automatically.';
    return;
  }

  if (!connected) {
    statusDot.classList.add('warn');
    statusText.textContent = 'Connecting…';
    hintEl.textContent = state.email || '';
    return;
  }

  if (hasCaptcha) {
    statusDot.classList.add('warn');
    statusText.textContent = 'Captcha on Beatport';
    hintEl.textContent =
      'Solve it in your Beatport tab, then continue from the dashboard.';
    return;
  }

  statusDot.classList.add('connected');

  if (state.running && tracks.length > 0) {
    const n = Math.min(state.currentIdx + 1, tracks.length);
    statusText.textContent = `Filling cart — ${inCart} / ${tracks.length}`;
    hintEl.textContent = state.email
      ? `Signed in as ${state.email}. Watch progress on the dashboard.`
      : 'Watch progress on the dashboard.';
    return;
  }

  if (tracks.length > 0 && inCart > 0) {
    statusText.textContent = `Ready — ${inCart} track${inCart === 1 ? '' : 's'} in cart`;
    hintEl.textContent = state.email
      ? `Signed in as ${state.email}`
      : 'Open the dashboard to review or start a new list.';
    return;
  }

  statusText.textContent = state.email
    ? `Connected as ${state.email}`
    : 'Connected and ready';
  hintEl.textContent = 'Drop a tracklist screenshot on the dashboard to begin.';
}

async function refresh() {
  try {
    const res = await chrome.runtime.sendMessage({ type: 'getState' });
    if (res) render(res);
  } catch {
    statusDot.className = 'status-dot off';
    statusText.textContent = 'Extension starting…';
    hintEl.textContent = '';
  }
}

chrome.runtime.onMessage.addListener((msg) => {
  if (msg?.type === 'state') refresh();
});

refresh();
setInterval(refresh, 2000);
