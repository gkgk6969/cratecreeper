const fs = require('fs');
const path = require('path');
const { create } = require('xmlbuilder2');
const store = require('./store');

function toFileUri(absPath) {
  const segments = absPath.split('/').map((s) => encodeURIComponent(s));
  return `file://localhost${segments.join('/')}`;
}

function defaultPlaylistName() {
  const d = new Date();
  const pad = (n) => String(n).padStart(2, '0');
  return `CrateDig_${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}_${pad(d.getHours())}${pad(d.getMinutes())}`;
}

function sanitizeFilename(name) {
  return name.replace(/[\/\\:*?"<>|]/g, '_').trim();
}

async function generateRekordboxXml(tracks, playlistNameInput) {
  const validTracks = (Array.isArray(tracks) ? tracks : []).filter((t) => t && t.path);
  if (validTracks.length === 0) {
    throw new Error('No tracks to export. Pair at least one downloaded file first.');
  }

  const playlistName = (playlistNameInput || '').trim() || defaultPlaylistName();
  const safeName = sanitizeFilename(playlistName);
  const outputDir = store.get('xmlOutputPath');
  await fs.promises.mkdir(outputDir, { recursive: true });
  const outputPath = path.join(outputDir, `${safeName}.xml`);

  const doc = create({ version: '1.0', encoding: 'UTF-8' });
  const root = doc.ele('DJ_PLAYLISTS', { Version: '1.0.0' });
  root.ele('PRODUCT', {
    Name: 'CrateDigger',
    Version: '1.0.0',
    Company: 'CrateDigger',
  });

  const collection = root.ele('COLLECTION', { Entries: String(validTracks.length) });
  validTracks.forEach((t, i) => {
    const attrs = {
      TrackID: String(i + 1),
      Name: t.title || '',
      Artist: t.artist || '',
      Location: toFileUri(t.path),
      Size: String(t.size || 0),
    };
    if (t.genre) attrs.Genre = t.genre;
    if (t.key) attrs.Tonality = t.key;
    if (t.bpm) attrs.AverageBpm = Number(t.bpm).toFixed(2);
    collection.ele('TRACK', attrs);
  });

  const playlists = root.ele('PLAYLISTS');
  const rootNode = playlists.ele('NODE', { Type: '0', Name: 'ROOT', Count: '1' });
  const crate = rootNode.ele('NODE', {
    Name: playlistName,
    Type: '1',
    KeyType: '0',
    Entries: String(validTracks.length),
  });
  validTracks.forEach((_, i) => {
    crate.ele('TRACK', { Key: String(i + 1) });
  });

  const xml = doc.end({ prettyPrint: true });
  await fs.promises.writeFile(outputPath, xml, 'utf-8');

  return { path: outputPath, count: validTracks.length, playlistName };
}

module.exports = { generateRekordboxXml };
