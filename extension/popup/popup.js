const $ = (sel) => document.querySelector(sel);

const statusDot = $('#statusDot');
const statusText = $('#statusText');
const queueEl = $('#queue');
const emptyEl = $('#empty');
const startBtn = $('#startBtn');
const pauseBtn = $('#pauseBtn');
const cancelBtn = $('#cancelBtn');
const debugToggle = $('#debugToggle');

function escapeHtml(s) {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function render({ state, connected }) {
  statusDot.classList.toggle('connected', !!connected);
  const tracksList = state.queue?.tracks || [];
  const statusesObj = state.statuses || {};
  const hasCaptcha = tracksList.some(
    (t, i) => (statusesObj[t.id ?? i]?.state) === 'captcha'
  );

  if (!state.paired) {
    statusText.textContent = 'not connected - open the Crate Digger web app';
  } else if (!connected) {
    statusText.textContent = state.email
      ? `${state.email} - connecting...`
      : 'connecting...';
  } else if (hasCaptcha) {
    statusText.textContent = 'captcha - solve in tab, then Start';
  } else if (state.running) {
    statusText.textContent = `running ${state.currentIdx + 1} / ${
      state.queue?.tracks?.length || 0
    }`;
  } else {
    statusText.textContent = state.email
      ? `${state.email} - ready`
      : 'ready - waiting for tracklist';
  }

  const tracks = state.queue?.tracks || [];
  const statuses = state.statuses || {};

  if (tracks.length === 0) {
    queueEl.innerHTML = '';
    emptyEl.style.display = '';
    startBtn.disabled = true;
    pauseBtn.disabled = true;
    cancelBtn.disabled = true;
  } else {
    emptyEl.style.display = 'none';
    queueEl.innerHTML = tracks
      .map((t, i) => {
        const s = statuses[t.id ?? i] || { state: 'pending' };
        const icon = ICONS[s.state] || '\u00B7';
        return `
          <div class="row ${s.state}">
            <span class="icon">${icon}</span>
            <span class="text">
              <span class="artist">${escapeHtml(t.artist)}</span><span class="sep">-</span>${escapeHtml(t.title)}
            </span>
          </div>
        `;
      })
      .join('');
    startBtn.disabled = state.running;
    pauseBtn.disabled = !state.running;
    cancelBtn.disabled = false;
  }

  debugToggle.checked = !!state.debug;
}

const ICONS = {
  pending: '\u00B7',
  searching: '\u25CB',
  added: '\u2713',
  ambiguous: '?',
  notfound: 'x',
  error: '!',
  captcha: '\u26A0',
};

async function refresh() {
  try {
    const res = await chrome.runtime.sendMessage({ type: 'getState' });
    if (res) render(res);
  } catch {}
}

startBtn.addEventListener('click', async () => {
  await chrome.runtime.sendMessage({ type: 'start' });
  refresh();
});
pauseBtn.addEventListener('click', async () => {
  await chrome.runtime.sendMessage({ type: 'pause' });
  refresh();
});
cancelBtn.addEventListener('click', async () => {
  await chrome.runtime.sendMessage({ type: 'cancel' });
  refresh();
});
debugToggle.addEventListener('change', async () => {
  await chrome.runtime.sendMessage({ type: 'toggleDebug' });
  refresh();
});

chrome.runtime.onMessage.addListener((msg) => {
  if (msg?.type === 'state') refresh();
});

refresh();
setInterval(refresh, 1500);
