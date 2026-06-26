// Vision-based tracklist extraction via Anthropic Claude.
// Returns an array of { artist, title, mix? } objects.
//
// Tight prompt is critical: a generic "extract songs" instruction lets Claude
// pick up column headers (BPM, KEY), genre tags (PLATFORM, electronic), and
// stuff mix-names ("Original Mix") into the title field — exactly the noise
// the local Apple Vision parser also produces. The rules below were derived
// from observed failure modes (PLATFORM/Original Mix bleeding into rows).

const SYSTEM_PROMPT = [
  'You are reading a screenshot of a music tracklist (DJ set, playlist, Beatport/Spotify search, etc.).',
  'Return ONLY a JSON array of objects: [{"artist": string, "title": string, "mix"?: string}]. No markdown, no commentary, no code fences.',
  '',
  'RULES:',
  '1. One object per song. The artist is who made it; the title is the song name.',
  '2. If the title has "(Original Mix)" / "(Club Mix)" / "(Extended Mix)" / "(<Name> Remix)" / "(VIP)" etc., put that bracketed text in the OPTIONAL `mix` field WITHOUT the parentheses, NOT in the title. Example: "Burning Blue (Mariah Remix)" -> {"title": "Burning Blue", "mix": "Mariah Remix"}.',
  '3. Multiple artists are comma-joined into ONE string in the artist field, e.g. "Sasha, Maya Jane Coles". Never put extra artists in the title.',
  '4. SKIP column headers and table labels: BPM, KEY, GENRE, LABEL, LENGTH, RELEASED, ARTIST, TITLE, TRACK, #, RATING, PRICE.',
  '5. SKIP standalone genre/event/festival/section names like "PLATFORM", "Boiler Room", "House", "Techno", "Electronic", "Trance", "Drum & Bass", "Top 100", "New Releases" unless they appear in the proper "Artist - Title" position with a real song name.',
  '6. SKIP UI/navigation labels: Now Playing, Queue, Liked Songs, Library, Recently Played, Made For You, Recommended, Play, Pause, Share, Save, Add, Download, More, Menu, Search, Home, Browse.',
  '7. SKIP timestamps (1:23, 1:23:45), play counts ("12.3K plays"), dates, prices ($2.09, AU$2.09).',
  '8. Use plain ASCII only. Replace curly quotes with straight ones, em/en dashes with hyphen-minus.',
  '9. If a row is ambiguous or you cannot confidently identify both artist and title, SKIP it. Fewer correct tracks is better than many wrong ones.',
  '10. Preserve original capitalization of artist and title (do not lower-case).',
].join('\n');

async function extractWithClaude(imageDataUrl, apiKey) {
  const match = imageDataUrl.match(/^data:image\/([\w+]+);base64,(.+)$/);
  if (!match) throw new Error('Invalid image data URL');
  let ext = match[1].toLowerCase();
  if (ext === 'jpg') ext = 'jpeg';
  const mediaType = `image/${ext}`;
  const base64 = match[2];

  const body = {
    model: 'claude-sonnet-4-6',
    max_tokens: 2048,
    messages: [
      {
        role: 'user',
        content: [
          {
            type: 'image',
            source: { type: 'base64', media_type: mediaType, data: base64 },
          },
          { type: 'text', text: SYSTEM_PROMPT },
        ],
      },
    ],
  };

  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Claude API ${res.status}: ${errText.slice(0, 300)}`);
  }
  const data = await res.json();
  const text = data?.content?.[0]?.text ?? '';
  const cleaned = text
    .trim()
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/```\s*$/, '')
    .trim();
  let arr;
  try {
    arr = JSON.parse(cleaned);
  } catch (e) {
    throw new Error("Claude didn't return valid JSON: " + text.slice(0, 200));
  }
  if (!Array.isArray(arr)) throw new Error('Claude response not an array');
  return arr
    .filter(
      (t) => t && typeof t.artist === 'string' && typeof t.title === 'string'
    )
    .map((t) => ({
      artist: t.artist.trim(),
      title: t.title.trim(),
      mix: typeof t.mix === 'string' && t.mix.trim() ? t.mix.trim() : undefined,
    }))
    .filter((t) => t.artist && t.title);
}

module.exports = { extractWithClaude };
