const chokidar = require('chokidar');
const fs = require('fs');
const path = require('path');
const store = require('./store');
const { matchFile } = require('./matcher');

const AUDIO_EXTS = new Set(['.mp3', '.wav', '.flac', '.aiff', '.aif', '.m4a']);
const PARTIAL_SUFFIXES = ['.crdownload', '.part', '.tmp', '.download'];

let watcher = null;
let expected = [];
let matchedByIndex = {};
let unmatchedFiles = {};
let nextFileId = 1;
let processedPaths = new Set();

function isAudio(p) {
  return AUDIO_EXTS.has(path.extname(p).toLowerCase());
}

function isPartial(p) {
  return PARTIAL_SUFFIXES.some((suffix) => p.toLowerCase().endsWith(suffix));
}

async function waitForStable(filePath, maxWaitMs = 30000) {
  const start = Date.now();
  let prev = -1;
  while (Date.now() - start < maxWaitMs) {
    let size;
    try {
      size = (await fs.promises.stat(filePath)).size;
    } catch {
      return false;
    }
    if (size === prev && size > 0) return true;
    prev = size;
    await new Promise((r) => setTimeout(r, 1000));
  }
  return false;
}

async function readMetadata(filePath) {
  try {
    const mm = await import('music-metadata');
    const meta = await mm.parseFile(filePath, { duration: false });
    const stat = await fs.promises.stat(filePath);
    return {
      artist: meta.common.artist || '',
      title: meta.common.title || '',
      bpm: meta.common.bpm || null,
      key: meta.common.key || null,
      genre: (meta.common.genre && meta.common.genre[0]) || '',
      size: stat.size,
    };
  } catch (e) {
    try {
      const stat = await fs.promises.stat(filePath);
      return {
        artist: '',
        title: '',
        bpm: null,
        key: null,
        genre: '',
        size: stat.size,
      };
    } catch {
      return null;
    }
  }
}

function broadcast(window) {
  if (!window || window.isDestroyed()) return;
  window.webContents.send('watcher:update', {
    expected,
    matched: Object.entries(matchedByIndex).map(([idx, file]) => ({
      trackIndex: Number(idx),
      file,
    })),
    unmatched: Object.values(unmatchedFiles),
  });
}

async function handleAdd(filePath, window) {
  if (processedPaths.has(filePath)) return;
  if (!isAudio(filePath) || isPartial(filePath)) return;
  if (path.basename(filePath).startsWith('.')) return;

  processedPaths.add(filePath);

  const stable = await waitForStable(filePath);
  if (!stable) return;

  const meta = await readMetadata(filePath);
  if (!meta) return;

  const file = {
    id: nextFileId++,
    path: filePath,
    filename: path.basename(filePath),
    ...meta,
  };

  const trackIndex = matchFile(file, expected, matchedByIndex);
  if (trackIndex !== -1) {
    matchedByIndex[trackIndex] = file;
  } else {
    unmatchedFiles[file.id] = file;
  }
  broadcast(window);
}

function startWatcher(expectedTracks, window) {
  stopWatcher();
  expected = Array.isArray(expectedTracks) ? expectedTracks : [];
  matchedByIndex = {};
  unmatchedFiles = {};
  processedPaths = new Set();
  nextFileId = 1;

  const downloadsPath = store.get('downloadsPath');
  if (!fs.existsSync(downloadsPath)) {
    return { error: `Downloads path not found: ${downloadsPath}` };
  }

  watcher = chokidar.watch(downloadsPath, {
    ignored: /(^|[\/\\])\../,
    persistent: true,
    ignoreInitial: true,
    depth: 0,
    awaitWriteFinish: false,
  });
  watcher.on('add', (p) => handleAdd(p, window).catch((e) => console.error(e)));
  watcher.on('change', (p) => handleAdd(p, window).catch(() => {}));
  watcher.on('error', (e) => console.error('watcher error', e));
  broadcast(window);
  return { watching: downloadsPath, expected: expected.length };
}

function stopWatcher() {
  if (watcher) {
    watcher.close();
    watcher = null;
  }
  return { stopped: true };
}

function manualPair(fileId, trackIndex, window) {
  const file = unmatchedFiles[fileId];
  if (!file) return false;
  if (trackIndex < 0 || trackIndex >= expected.length) return false;

  delete unmatchedFiles[fileId];
  if (matchedByIndex[trackIndex]) {
    const existing = matchedByIndex[trackIndex];
    unmatchedFiles[existing.id] = existing;
  }
  matchedByIndex[trackIndex] = file;
  broadcast(window);
  return true;
}

module.exports = { startWatcher, stopWatcher, manualPair };
