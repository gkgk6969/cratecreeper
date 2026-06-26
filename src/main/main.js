const { app, BrowserWindow, ipcMain, shell, dialog, clipboard } = require('electron');
const path = require('path');

const store = require('./store');
const { extractTracks } = require('./ocr');
const { startWatcher, stopWatcher, manualPair } = require('./file-watcher');
const { openStoreLinks } = require('./open-stores');
const { generateRekordboxXml } = require('./xml-generator');
const {
  startBridgeServer,
  stopBridgeServer,
  setQueue: bridgeSetQueue,
  cancelQueue: bridgeCancelQueue,
  getState: bridgeGetState,
} = require('./bridge-server');

const isDev = !app.isPackaged && process.env.NODE_ENV === 'development';

let mainWindow = null;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 480,
    height: 700,
    resizable: false,
    frame: false,
    backgroundColor: '#0a0a0a',
    show: false,
    webPreferences: {
      preload: path.join(__dirname, '..', 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
  });

  mainWindow.once('ready-to-show', () => mainWindow.show());

  if (isDev) {
    mainWindow.loadURL('http://localhost:5173');
  } else {
    mainWindow.loadFile(path.join(__dirname, '..', '..', 'dist', 'index.html'));
  }

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

app.whenReady().then(() => {
  registerIpc();
  createWindow();
  startBridgeServer(() => mainWindow);
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
    // Idempotent: bridge-server early-returns if already running. Belt-and-
    // braces in case it died for any reason while Electron stayed alive.
    startBridgeServer(() => mainWindow);
  });
});

app.on('window-all-closed', () => {
  stopWatcher();
  // On macOS, the app stays alive when the window is closed (standard Mac
  // behaviour — relaunch via dock). Keep the bridge server running so the
  // Chrome extension stays connected; only tear it down when we actually
  // quit on non-darwin platforms.
  if (process.platform !== 'darwin') {
    stopBridgeServer();
    app.quit();
  }
});

function registerIpc() {
  ipcMain.handle('settings:get', () => store.getAll());
  ipcMain.handle('settings:set', (_e, key, value) => {
    store.set(key, value);
    return store.getAll();
  });
  ipcMain.handle('settings:pickFolder', async () => {
    if (!mainWindow) return null;
    const result = await dialog.showOpenDialog(mainWindow, {
      properties: ['openDirectory'],
    });
    return result.canceled ? null : result.filePaths[0];
  });

  ipcMain.handle('ocr:extract', async (_e, imageDataUrl) => {
    return extractTracks(imageDataUrl);
  });

  ipcMain.handle('clipboard:readImage', () => {
    const img = clipboard.readImage();
    if (img.isEmpty()) return null;
    return img.toDataURL();
  });

  ipcMain.handle('stores:open', async (_e, tracks, storeId) => {
    return openStoreLinks(tracks, storeId);
  });

  ipcMain.handle('watcher:start', async (_e, expectedTracks) => {
    return startWatcher(expectedTracks, mainWindow);
  });
  ipcMain.handle('watcher:stop', async () => stopWatcher());
  ipcMain.handle('watcher:manualPair', async (_e, fileId, trackIndex) => {
    return manualPair(fileId, trackIndex, mainWindow);
  });

  ipcMain.handle('xml:generate', async (_e, tracks, playlistName) => {
    return generateRekordboxXml(tracks, playlistName);
  });

  ipcMain.handle('shell:openInFinder', (_e, filePath) => {
    shell.showItemInFolder(filePath);
    return true;
  });

  ipcMain.handle('bridge:setQueue', (_e, tracks) => bridgeSetQueue(tracks));
  ipcMain.handle('bridge:cancelQueue', () => bridgeCancelQueue());
  ipcMain.handle('bridge:getState', () => bridgeGetState());

  ipcMain.handle('window:close', () => mainWindow && mainWindow.close());
  ipcMain.handle('window:minimize', () => mainWindow && mainWindow.minimize());
}
