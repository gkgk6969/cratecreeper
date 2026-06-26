const { spawn } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { app } = require('electron');
const store = require('./store');
const { extractWithClaude } = require('./claude-vision');

function getOcrBinaryPath() {
  if (app.isPackaged) {
    return path.join(process.resourcesPath, 'resources', 'ocr', 'apple-ocr');
  }
  return path.join(__dirname, '..', '..', 'resources', 'ocr', 'apple-ocr');
}

async function dataUrlToTempFile(dataUrl) {
  const match = dataUrl.match(/^data:image\/([\w+]+);base64,(.+)$/);
  if (!match) throw new Error('Invalid image data URL');
  let ext = match[1].toLowerCase();
  if (ext === 'jpeg') ext = 'jpg';
  const buf = Buffer.from(match[2], 'base64');
  const tmpPath = path.join(os.tmpdir(), `cratedigger-${Date.now()}.${ext}`);
  await fs.promises.writeFile(tmpPath, buf);
  return tmpPath;
}

function runAppleOcr(imagePath) {
  return new Promise((resolve, reject) => {
    const bin = getOcrBinaryPath();
    if (!fs.existsSync(bin)) {
      return reject(new Error('apple-ocr binary not found at ' + bin));
    }
    const child = spawn(bin, [imagePath]);
    let stdout = '';
    let stderr = '';
    child.stdout.on('data', (d) => (stdout += d.toString()));
    child.stderr.on('data', (d) => (stderr += d.toString()));
    child.on('error', reject);
    child.on('close', (code) => {
      if (code !== 0) {
        return reject(new Error(`apple-ocr exited ${code}: ${stderr}`));
      }
      try {
        const arr = JSON.parse(stdout.trim() || '[]');
        resolve(Array.isArray(arr) ? arr : []);
      } catch (e) {
        reject(new Error(`apple-ocr returned invalid JSON: ${stdout.slice(0, 200)}`));
      }
    });
  });
}

function cleanUnicode(s) {
  if (!s) return s;
  return s
    .replace(/[\u2014\u2013]/g, '-')
    .replace(/[\u2018\u2019\u02BC]/g, "'")
    .replace(/[\u201C\u201D]/g, '"')
    .replace(/\u2026/g, '...')
    .replace(/[\u00A0]/g, ' ')
    .replace(/[\u2022\u00B7\u2027]/g, '-')
    .replace(/[^\x20-\x7E]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

const NOISE_PATTERNS = [
  /^\d{1,3}$/,
  /^\d{1,2}:\d{2}(:\d{2})?$/,
  /^[\d,.]+\s*(plays|likes|views|reposts|listeners|monthly listeners)$/i,
  /^\d+[kKmM]?$/,
  /^(play|pause|share|like|save|added|follow|following|download|cancel|done|edit|more|menu)$/i,
  /^(now playing|playing|queue|liked songs|recently played|made for you|recommended|popular|top tracks|tracks|songs|playlist|album|artists?)$/i,
  /^(spotify|apple music|youtube|youtube music|soundcloud|tidal|deezer|amazon music|bandcamp|beatport|traxsource)$/i,
  /^(home|search|library|browse|radio)$/i,
  /^[\d:.\s]+$/,
  /^\d{1,2}\s*(min|hr|h|m|sec|s)\b/i,
];

function isNoiseLine(line) {
  if (!line) return true;
  const trimmed = line.trim();
  if (trimmed.length < 3) return true;
  return NOISE_PATTERNS.some((re) => re.test(trimmed));
}

const TRACK_NUM_RE = /^\s*(\d{1,3})\s*[\.\)\-:]\s*/;
const TRAILING_DURATION_RE = /\s+\d{1,2}:\d{2}(?::\d{2})?\s*$/;

function stripDecorations(line) {
  return line
    .replace(TRACK_NUM_RE, '')
    .replace(TRAILING_DURATION_RE, '')
    .trim();
}

function parseLineToTrack(line) {
  const sepPatterns = [
    { re: /\s+[-–—]\s+/, swap: false },
    { re: /\s+\|\s+/, swap: false },
    { re: /\s+by\s+/i, swap: true },
  ];
  for (const { re, swap } of sepPatterns) {
    const parts = line.split(re);
    if (parts.length >= 2) {
      let artist = parts[0].trim();
      let title = parts.slice(1).join(' ').trim();
      if (swap) [artist, title] = [title, artist];
      artist = cleanUnicode(artist);
      title = cleanUnicode(title);
      if (artist && title && artist.length > 1 && title.length > 1) {
        return { artist, title };
      }
    }
  }
  return null;
}

function looksLikeArtist(text) {
  // Very rough heuristic for unmatched-second-line ambiguity.
  // Artist lines tend to be shorter and have fewer parens/brackets.
  if (text.length < 40 && !/[\(\)\[\]]/.test(text)) return true;
  return false;
}

function isHeader(item, allItems) {
  // First item that's significantly larger than median = likely page header
  if (allItems.length < 4) return false;
  const heights = allItems.map((i) => i.h || 0).sort((a, b) => a - b);
  const median = heights[Math.floor(heights.length / 2)];
  return (item.h || 0) > median * 1.8;
}

function parseItems(rawItems) {
  // Normalize: support both old string-array format and new object format
  const items = rawItems
    .map((it, idx) => {
      if (typeof it === 'string') {
        return { text: it, x: 0, y: 1 - idx * 0.001, w: 1, h: 0.02, confidence: 1, idx };
      }
      return {
        text: it.text || '',
        x: Number(it.x) || 0,
        y: Number(it.y) || 0,
        w: Number(it.w) || 0,
        h: Number(it.h) || 0,
        confidence: Number(it.confidence) || 0,
        idx,
      };
    })
    .filter((i) => i.text && i.text.length > 0);

  // Sort top to bottom (Vision uses bottom-left origin, normalized 0-1, so high y = top)
  items.sort((a, b) => b.y - a.y);

  // Clean each line + drop noise + drop probable headers
  const cleaned = items
    .map((it) => ({ ...it, text: cleanUnicode(stripDecorations(it.text)) }))
    .filter((it) => !isNoiseLine(it.text))
    .filter((it, _, arr) => !isHeader(it, arr));

  if (cleaned.length === 0) return [];

  // Pass 1: every line that contains an inline separator becomes a track
  const tracks = [];
  const consumed = new Set();
  cleaned.forEach((it, i) => {
    const t = parseLineToTrack(it.text);
    if (t) {
      tracks.push({ ...t, _y: it.y, _h: it.h });
      consumed.add(i);
    }
  });

  // Pass 2: pair adjacent leftover lines as title+artist (or artist+title)
  // Use bounding-box height to decide which is title (taller = title)
  const leftover = cleaned.filter((_, i) => !consumed.has(i));
  for (let i = 0; i < leftover.length - 1; i += 2) {
    const a = leftover[i];
    const b = leftover[i + 1];
    if (!a || !b) break;
    let title, artist;
    if ((a.h || 0) >= (b.h || 0) * 1.05) {
      title = a.text;
      artist = b.text;
    } else if ((b.h || 0) >= (a.h || 0) * 1.05) {
      title = b.text;
      artist = a.text;
    } else if (looksLikeArtist(b.text) && !looksLikeArtist(a.text)) {
      title = a.text;
      artist = b.text;
    } else {
      // Default: Spotify/Apple Music/SoundCloud convention is Title above Artist
      title = a.text;
      artist = b.text;
    }
    title = cleanUnicode(title);
    artist = cleanUnicode(artist);
    if (artist && title && artist.length > 1 && title.length > 1) {
      tracks.push({ artist, title, _y: a.y });
    }
  }

  // If we ended with a single leftover, and previous tracks all share the same artist, append it
  if (leftover.length % 2 === 1 && tracks.length >= 2) {
    const last = leftover[leftover.length - 1];
    const allSame = tracks.every((t) => t.artist === tracks[0].artist);
    if (allSame && last.text.length > 1) {
      tracks.push({ artist: tracks[0].artist, title: cleanUnicode(last.text) });
    }
  }

  // De-dupe (artist+title key)
  const seen = new Set();
  const result = [];
  for (const t of tracks) {
    const key = `${t.artist.toLowerCase()}|${t.title.toLowerCase()}`;
    if (seen.has(key)) continue;
    seen.add(key);
    result.push({ artist: t.artist, title: t.title });
  }

  return result;
}

async function extractTracks(imageDataUrl) {
  const settings = store.getAll();
  const tmpFile = await dataUrlToTempFile(imageDataUrl);

  // Priority: Claude (when API key is set) → Apple Vision fallback.
  // Apple's heuristic parser hallucinates tracks from headers/genre tags
  // (e.g. "PLATFORM", "Original Mix" as title). Claude with a tight prompt
  // produces clean structured tracks that actually match Beatport searches.
  // We only fall back to Apple when there's no API key, Claude failed, or
  // Claude returned an empty array (rate-limit, malformed image, etc.).

  let claudeErr = null;
  try {
    if (settings.apiKey) {
      try {
        const raw = await extractWithClaude(imageDataUrl, settings.apiKey);
        const cleaned = raw
          .map((t) => {
            const artist = cleanUnicode(t.artist);
            const title = cleanUnicode(t.title);
            const mix = t.mix ? cleanUnicode(t.mix) : '';
            const out = { artist, title };
            if (mix) out.mix = mix;
            return out;
          })
          .filter((t) => t.artist && t.title);
        console.log(`[ocr] Claude Vision -> ${cleaned.length} tracks parsed`);
        if (cleaned.length >= 1) {
          return { tracks: cleaned, source: 'claude', total: cleaned.length };
        }
        claudeErr = 'Claude returned 0 tracks';
      } catch (e) {
        claudeErr = e.message;
        console.error('Claude Vision failed:', e.message);
      }
    }

    // Fallback: Apple Vision + heuristic parser.
    try {
      const items = await runAppleOcr(tmpFile);
      const tracks = parseItems(items);
      console.log(
        `[ocr] Apple Vision fallback: ${items.length} text items -> ${tracks.length} tracks parsed`
      );
      if (tracks.length >= 1) {
        return { tracks, source: 'apple', total: tracks.length };
      }
      throw new Error(
        `Apple Vision parsed 0 tracks from ${items.length} text items`
      );
    } catch (e) {
      const prefix = claudeErr ? `Claude failed (${claudeErr}); ` : '';
      throw new Error(
        prefix + `Apple Vision fallback failed: ${e.message}. ` +
          (settings.apiKey
            ? ''
            : 'Add an Anthropic API key in Settings for better extraction.')
      );
    }
  } finally {
    fs.promises.unlink(tmpFile).catch(() => {});
  }
}

module.exports = { extractTracks, parseItems };
