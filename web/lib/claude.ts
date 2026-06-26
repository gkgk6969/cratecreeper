// Vision-based tracklist extraction via Anthropic Claude.
// Ported verbatim (prompt + parsing) from src/main/claude-vision.js so the web
// app produces identical results to the desktop app. Server-side only — the
// Anthropic key never reaches the browser or the extension.

export type ExtractedTrack = {
  artist: string;
  title: string;
  mix?: string;
};

const SYSTEM_PROMPT = [
  'You are reading a screenshot of a music tracklist (DJ set, playlist, Beatport/Spotify search, etc.).',
  'Return ONLY a JSON array of objects: [{"artist": string, "title": string, "mix"?: string}]. No markdown, no commentary, no code fences.',
  '',
  'RULES:',
  '1. One object per song. The artist is who made it; the title is the song name.',
  '2. Separate the version/mix from the title into the OPTIONAL `mix` field (without parentheses), never leave it in the title. This applies to BOTH formats:',
  '   a. Parenthetical: "Burning Blue (Mariah Remix)" -> {"title": "Burning Blue", "mix": "Mariah Remix"}.',
  '   b. Spotify-style trailing dash (very common): a " - <Version>" suffix where <Version> ends in or contains Mix / Remix / Edit / Version / Dub / VIP / Bootleg / Rework / Flip / Instrumental / Acoustic / Live. Example: "Supadrug - Underground Mix" -> {"title": "Supadrug", "mix": "Underground Mix"}; "Leave Your Life - Dance Mix" -> {"title": "Leave Your Life", "mix": "Dance Mix"}; "My City\'s On Fire - U&I Remix" -> {"title": "My City\'s On Fire", "mix": "U&I Remix"}.',
  '   Do NOT treat a " - " that separates a collaborating artist or a normal subtitle as a mix; only pull it out when the suffix names a version/edit as described.',
  '3. Multiple artists are comma-joined into ONE string in the artist field, e.g. "Sasha, Maya Jane Coles". Never put extra artists in the title.',
  '4. SKIP column headers and table labels: BPM, KEY, GENRE, LABEL, LENGTH, RELEASED, ARTIST, TITLE, TRACK, #, RATING, PRICE.',
  '5. SKIP standalone genre/event/festival/section names like "PLATFORM", "Boiler Room", "House", "Techno", "Electronic", "Trance", "Drum & Bass", "Top 100", "New Releases" unless they appear in the proper "Artist - Title" position with a real song name.',
  '6. SKIP UI/navigation labels: Now Playing, Queue, Liked Songs, Library, Recently Played, Made For You, Recommended, Play, Pause, Share, Save, Add, Download, More, Menu, Search, Home, Browse.',
  '7. SKIP timestamps (1:23, 1:23:45), play counts ("12.3K plays"), dates, prices ($2.09, AU$2.09).',
  '8. Use plain ASCII only. Replace curly quotes with straight ones, em/en dashes with hyphen-minus.',
  '9. If a row is ambiguous or you cannot confidently identify both artist and title, SKIP it. Fewer correct tracks is better than many wrong ones.',
  '10. Preserve original capitalization of artist and title (do not lower-case).',
].join('\n');

function cleanUnicode(s: string): string {
  if (!s) return s;
  return s
    .replace(/[\u2014\u2013]/g, '-')
    .replace(/[\u2018\u2019\u02BC]/g, "'")
    .replace(/[\u201C\u201D]/g, '"')
    .replace(/\u2026/g, '...')
    .replace(/[\u00A0]/g, ' ')
    .replace(/[^\x20-\x7E]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

export async function extractWithClaude(
  imageBase64: string,
  mediaType: string
): Promise<ExtractedTrack[]> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error('ANTHROPIC_API_KEY is not configured');

  const body = {
    model: 'claude-sonnet-4-6',
    max_tokens: 2048,
    messages: [
      {
        role: 'user',
        content: [
          {
            type: 'image',
            source: { type: 'base64', media_type: mediaType, data: imageBase64 },
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
  const text: string = data?.content?.[0]?.text ?? '';
  const cleaned = text
    .trim()
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/```\s*$/, '')
    .trim();

  let arr: unknown;
  try {
    arr = JSON.parse(cleaned);
  } catch {
    throw new Error("Claude didn't return valid JSON: " + text.slice(0, 200));
  }
  if (!Array.isArray(arr)) throw new Error('Claude response not an array');

  return arr
    .filter(
      (t): t is { artist: string; title: string; mix?: unknown } =>
        !!t && typeof t.artist === 'string' && typeof t.title === 'string'
    )
    .map((t) => {
      const artist = cleanUnicode(t.artist);
      const title = cleanUnicode(t.title);
      const mix =
        typeof t.mix === 'string' && t.mix.trim() ? cleanUnicode(t.mix) : undefined;
      return mix ? { artist, title, mix } : { artist, title };
    })
    .filter((t) => t.artist && t.title);
}

// Validate an uploaded image data URL. Returns the base64 payload + media type,
// or throws with a user-facing message. Caps size before it ever hits Claude.
const MAX_BYTES = 4 * 1024 * 1024; // 4MB
const ALLOWED = new Set(['image/png', 'image/jpeg', 'image/webp']);

export function parseImageDataUrl(dataUrl: unknown): {
  base64: string;
  mediaType: string;
} {
  if (typeof dataUrl !== 'string') {
    throw new Error('No image provided');
  }
  const match = dataUrl.match(/^data:(image\/[\w+]+);base64,(.+)$/);
  if (!match) throw new Error('Invalid image format');

  let mediaType = match[1].toLowerCase();
  if (mediaType === 'image/jpg') mediaType = 'image/jpeg';
  if (!ALLOWED.has(mediaType)) {
    throw new Error('Unsupported image type. Use PNG, JPEG, or WebP.');
  }

  const base64 = match[2];
  // base64 length * 3/4 approximates decoded byte count.
  const approxBytes = Math.floor((base64.length * 3) / 4);
  if (approxBytes > MAX_BYTES) {
    throw new Error('Image too large. Max 4MB.');
  }

  return { base64, mediaType };
}
