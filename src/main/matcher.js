const sim = require('string-similarity');

function normalize(s) {
  return (s || '')
    .toLowerCase()
    .replace(/\(.*?\)/g, ' ')
    .replace(/\[.*?\]/g, ' ')
    .replace(/\b(original|extended|radio|club|dub|instrumental)\s+mix\b/gi, ' ')
    .replace(/[^a-z0-9 ]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function fileLabel(file) {
  if (file.artist && file.title) return `${file.artist} ${file.title}`;
  return file.filename
    .replace(/\.[^.]+$/, '')
    .replace(/^\d+\s*[-_.]\s*/, '')
    .replace(/[-_]+/g, ' ');
}

function trackLabel(track) {
  return `${track.artist} ${track.title}`;
}

function matchFile(file, expectedTracks, alreadyMatched) {
  if (!Array.isArray(expectedTracks) || expectedTracks.length === 0) return -1;
  const fileNorm = normalize(fileLabel(file));
  if (!fileNorm) return -1;

  let bestIdx = -1;
  let bestScore = 0;
  let secondScore = 0;

  for (let i = 0; i < expectedTracks.length; i++) {
    if (alreadyMatched[i]) continue;
    const trackNorm = normalize(trackLabel(expectedTracks[i]));
    if (!trackNorm) continue;
    const score = sim.compareTwoStrings(fileNorm, trackNorm);
    if (score > bestScore) {
      secondScore = bestScore;
      bestScore = score;
      bestIdx = i;
    } else if (score > secondScore) {
      secondScore = score;
    }
  }

  if (bestScore > 0.7 && bestScore - secondScore > 0.1) return bestIdx;
  return -1;
}

module.exports = { matchFile, normalize };
