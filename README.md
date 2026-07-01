# cratecreep

> **The product is now the web app in [`web/`](web/).** Upload a tracklist
> screenshot, review the tracks, and the Chrome extension fills your Beatport
> cart. See [`web/README.md`](web/README.md) to run it and
> [`extension/README.md`](extension/README.md) to install + pair the extension.
>
> The Electron desktop app below is kept as a local dev/test harness. The
> Chrome extension now pairs with the web app over Supabase Realtime, not with
> the desktop bridge.

Mac desktop app for DJs. Screenshot a tracklist → tracks identified → store tabs opened → downloads watched → Rekordbox XML generated. Whole workflow compressed into ~2 minutes.

## What it does

1. Drop or paste a screenshot of a tracklist (Spotify, YouTube, anywhere)
2. Local OCR (Apple Vision) extracts artist + title for each track. Falls back to Claude Vision if you set an API key.
3. One click opens every track as a search tab on Beatport or Bandcamp
4. App watches your Downloads folder while you buy + download
5. Files are fuzzy-matched back to the expected tracks. Unmatched files can be paired manually.
6. Generates a Rekordbox-compatible XML playlist you can import into Rekordbox.

## Requirements

- macOS 12+ (Apple Vision OCR uses `VNRecognizeTextRequest`)
- Node 18+
- `swiftc` (ships with Xcode Command Line Tools — `xcode-select --install`)
- (Optional) Anthropic API key for Claude Vision fallback

## Install + run (dev)

```bash
npm install
npm run dev
```

`postinstall` builds the `apple-ocr` Swift binary. If that fails (no swiftc, non-Mac, etc.) the app still runs but local OCR is unavailable — set an Anthropic API key in Settings and it'll use Claude Vision.

## Build a Mac app

```bash
npm run build
```

Outputs a `.dmg` to `release/`.

> Note: not code-signed by default. macOS will block the first launch — right-click the app, choose Open, then confirm. To sign + notarize, configure `electron-builder` with your Apple Developer credentials.

## Settings

Click `settings` in the title bar:

- **Anthropic API key** — only needed if you turn off local OCR or local OCR can't read the screenshot
- **Prefer local OCR** — on by default
- **Downloads folder** — where to watch (default `~/Downloads`)
- **XML output folder** — where playlists are saved (default `~/Music/CrateDigger`)
- **Default store** — Beatport or Bandcamp

## How matching works

When a new audio file lands in your Downloads folder, cratecreep:

1. Reads the ID3 tags (artist, title, BPM, key, genre) via `music-metadata`
2. Falls back to filename if tags are missing
3. Compares against expected tracks using string-similarity (Dice coefficient)
4. Auto-matches when score > 0.7 AND the best match beats the runner-up by > 0.1
5. Otherwise the file shows up as "unmatched" — click the file, then click an empty track to pair manually

## Chrome extension (auto-add to Beatport cart)

The companion Chrome extension in [extension/](extension/) auto-adds Beatport
tracks to your cart using your logged-in browser session. It now pairs with the
web app over Supabase Realtime; the old local WebSocket bridge to this desktop
app has been removed. See [extension/README.md](extension/README.md) for setup
and pairing.

## Importing into Rekordbox

1. In Rekordbox: **File → Import Playlist → Select the XML**
2. Tracks will appear in a new playlist with the name you chose. BPM/key are imported if present in the file tags; otherwise Rekordbox analyses on its own.

## Project structure

```
src/
  main/                  # Electron main process (Node)
    main.js              # entry, BrowserWindow, IPC handlers
    store.js             # electron-store wrapper for settings
    ocr.js               # local OCR + parser, Claude fallback orchestration
    claude-vision.js     # Claude API call
    open-stores.js       # builds store URLs, opens with shell.openExternal
    file-watcher.js      # chokidar on Downloads
    matcher.js           # fuzzy match files -> expected tracks
    xml-generator.js     # Rekordbox XML
  preload.js             # contextBridge -> window.api
  renderer/
    App.jsx              # state machine
    components/          # UI pieces
    styles/globals.css   # Tailwind + dark theme
resources/
  ocr/AppleOCR.swift     # Apple Vision CLI source
  ocr/apple-ocr          # compiled binary (built on install)
```

## Out of scope (for now)

- Windows / Linux
- Code signing / notarization
- Auto-purchase or login automation
- Cloud sync, accounts, telemetry
- Other DJ software (Serato, Traktor, Engine DJ)
