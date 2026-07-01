# cratecreep — Chrome extension

Walks a logged-in Beatport tab and adds each queued track to your cart. It
talks to the cratecreep web app over Supabase Realtime — there is no desktop
app or local server anymore.

## Install (unpacked, for development)

1. Edit [`config.js`](config.js) and set `SUPABASE_URL` and `SUPABASE_ANON_KEY`
   to match your Supabase project (the same public values the web app uses as
   `NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_ANON_KEY`). These are safe
   to ship in a client; RLS protects the data.
2. Open `chrome://extensions`, enable Developer mode, click "Load unpacked",
   and select this `extension/` folder.
3. Copy the extension id Chrome shows. Put it in the web app's
   `NEXT_PUBLIC_EXTENSION_ID` so the dashboard can message the extension.

## Pairing

1. Sign in to the web app and open the dashboard.
2. Click "Connect extension". The dashboard hands the extension your Supabase
   access + refresh tokens via `externally_connectable` messaging. The
   extension stores them, opens a Realtime channel, and the popup shows your
   email.

The extension never receives the service-role key or the Anthropic key.

## Production domains

`manifest.json` ships with only `http://localhost:3000/*` in
`externally_connectable.matches`. Add your deployed origin (a concrete host,
e.g. `https://crate-digger.example.com/*`) and reload the extension.

> Chrome rejects wildcard hosts on a public suffix (e.g. `https://*.vercel.app/*`),
> so use your specific subdomain, not a wildcard.

## How it works

- The web app inserts `queue_items` rows server-side. The extension is
  subscribed to Realtime `INSERT` events for your rows and loads the full
  session in order before starting.
- For each track it searches Beatport, clicks the first inline cart button, and
  writes the result back with an `UPDATE` (the only write RLS allows the
  extension to make).
- A 3–7s randomized delay between tracks mimics human browsing to avoid
  Beatport's bot detection. On a captcha it pauses so you can solve it, then
  resumes from the same track.

## Known limitations

- Beatport DOM changes can break the cart-click logic until the extension is
  updated. The cart pipeline lives in `content/beatport.js`.
- First-hit matching may occasionally grab the wrong remix. The dashboard shows
  the matched product per track so you can verify before checking out.
- You always complete the purchase yourself on Beatport.
