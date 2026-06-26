const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('api', {
  settings: {
    get: () => ipcRenderer.invoke('settings:get'),
    set: (key, value) => ipcRenderer.invoke('settings:set', key, value),
    pickFolder: () => ipcRenderer.invoke('settings:pickFolder'),
  },
  ocr: {
    extract: (imageDataUrl) => ipcRenderer.invoke('ocr:extract', imageDataUrl),
  },
  clipboard: {
    readImage: () => ipcRenderer.invoke('clipboard:readImage'),
  },
  stores: {
    open: (tracks, storeId) => ipcRenderer.invoke('stores:open', tracks, storeId),
  },
  watcher: {
    start: (expectedTracks) => ipcRenderer.invoke('watcher:start', expectedTracks),
    stop: () => ipcRenderer.invoke('watcher:stop'),
    manualPair: (fileId, trackIndex) =>
      ipcRenderer.invoke('watcher:manualPair', fileId, trackIndex),
    onUpdate: (callback) => {
      const handler = (_event, payload) => callback(payload);
      ipcRenderer.on('watcher:update', handler);
      return () => ipcRenderer.removeListener('watcher:update', handler);
    },
  },
  xml: {
    generate: (tracks, playlistName) =>
      ipcRenderer.invoke('xml:generate', tracks, playlistName),
  },
  shell: {
    openInFinder: (filePath) => ipcRenderer.invoke('shell:openInFinder', filePath),
  },
  bridge: {
    setQueue: (tracks) => ipcRenderer.invoke('bridge:setQueue', tracks),
    cancelQueue: () => ipcRenderer.invoke('bridge:cancelQueue'),
    getState: () => ipcRenderer.invoke('bridge:getState'),
    onStatus: (cb) => {
      const handler = (_e, payload) => cb(payload);
      ipcRenderer.on('bridge:status', handler);
      return () => ipcRenderer.removeListener('bridge:status', handler);
    },
    onConnection: (cb) => {
      const handler = (_e, payload) => cb(payload);
      ipcRenderer.on('bridge:connection', handler);
      return () => ipcRenderer.removeListener('bridge:connection', handler);
    },
    onQueueComplete: (cb) => {
      const handler = (_e, payload) => cb(payload);
      ipcRenderer.on('bridge:queueComplete', handler);
      return () => ipcRenderer.removeListener('bridge:queueComplete', handler);
    },
  },
  window: {
    close: () => ipcRenderer.invoke('window:close'),
    minimize: () => ipcRenderer.invoke('window:minimize'),
  },
});
