const { WebSocketServer } = require('ws');

const PORT = 8923;
const HOST = '127.0.0.1';

let wss = null;
let clients = new Set();
let currentQueue = null;
let statuses = {};
let mainWindowRef = null;

function broadcast(msg) {
  const payload = JSON.stringify(msg);
  for (const ws of clients) {
    if (ws.readyState === ws.OPEN) {
      try {
        ws.send(payload);
      } catch (e) {
        console.error('[bridge] send error', e.message);
      }
    }
  }
}

function notifyRenderer(channel, payload) {
  try {
    const win = typeof mainWindowRef === 'function' ? mainWindowRef() : mainWindowRef;
    if (!win || win.isDestroyed()) return;
    win.webContents.send(channel, payload);
  } catch (e) {
    console.error('[bridge] notifyRenderer failed:', e.message);
  }
}

function emitConnectionState() {
  notifyRenderer('bridge:connection', { connected: clients.size > 0 });
}

function handleClientMessage(ws, raw) {
  try {
    let msg;
    try {
      msg = JSON.parse(raw.toString());
    } catch {
      return;
    }
    if (!msg || typeof msg !== 'object') return;

    if (msg.type === 'hello') {
      if (currentQueue) {
        try {
          ws.send(JSON.stringify({ type: 'queue', ...currentQueue }));
        } catch (e) {
          console.error('[bridge] send queue failed:', e.message);
        }
      }
      return;
    }

    if (msg.type === 'status' && msg.trackId !== undefined) {
      statuses[msg.trackId] = {
        state: msg.state,
        detail: msg.detail || null,
        productUrl: msg.productUrl || null,
        score: msg.score || null,
        candidates: msg.candidates || null,
        updatedAt: Date.now(),
      };
      notifyRenderer('bridge:status', { trackId: msg.trackId, ...statuses[msg.trackId] });
      return;
    }

    if (msg.type === 'queue_complete') {
      notifyRenderer('bridge:queueComplete', { statuses });
      return;
    }
  } catch (e) {
    console.error('[bridge] handleClientMessage error:', e.message);
  }
}

process.on('uncaughtException', (e) => {
  if (e && /WebSocket|ws/i.test(String(e.stack || e.message || ''))) {
    console.error('[bridge] uncaught ws error (handled):', e.message);
    return;
  }
  console.error('[bridge] uncaughtException', e);
});

function startBridgeServer(windowGetter) {
  if (wss) return { port: PORT };
  mainWindowRef = windowGetter;
  wss = new WebSocketServer({ host: HOST, port: PORT });

  wss.on('connection', (ws) => {
    clients.add(ws);
    emitConnectionState();
    console.log('[bridge] extension connected, total:', clients.size);

    ws.on('message', (raw) => handleClientMessage(ws, raw));
    ws.on('close', () => {
      clients.delete(ws);
      emitConnectionState();
      console.log('[bridge] extension disconnected, total:', clients.size);
    });
    ws.on('error', (e) => console.error('[bridge] ws error', e.message));

    if (currentQueue) {
      ws.send(JSON.stringify({ type: 'queue', ...currentQueue }));
    }
  });

  wss.on('error', (e) => console.error('[bridge] server error', e.message));
  console.log(`[bridge] listening on ws://${HOST}:${PORT}`);
  return { port: PORT };
}

function stopBridgeServer() {
  if (!wss) return;
  for (const ws of clients) {
    try { ws.close(); } catch {}
  }
  clients.clear();
  wss.close();
  wss = null;
  currentQueue = null;
  statuses = {};
}

function setQueue(tracks) {
  const sessionId = `s-${Date.now()}`;
  const queueTracks = (tracks || []).map((t, i) => ({
    id: i,
    artist: t.artist,
    title: t.title,
  }));
  currentQueue = { sessionId, tracks: queueTracks };
  statuses = {};
  queueTracks.forEach((t) => {
    statuses[t.id] = { state: 'pending' };
  });
  broadcast({ type: 'queue', ...currentQueue });
  return { sessionId, tracks: queueTracks };
}

function cancelQueue() {
  currentQueue = null;
  statuses = {};
  broadcast({ type: 'cancel' });
  return { cancelled: true };
}

function getState() {
  return {
    connected: clients.size > 0,
    queue: currentQueue,
    statuses,
  };
}

module.exports = {
  startBridgeServer,
  stopBridgeServer,
  setQueue,
  cancelQueue,
  getState,
};
