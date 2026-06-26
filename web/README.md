# Crate Digger — Web app

Paid web SaaS: upload a tracklist screenshot, review the tracks Claude reads,
and watch the Chrome extension fill your Beatport cart in real time.

Stack: Next.js 16 (App Router), Supabase (auth + Postgres + Realtime), Stripe
(subscription), Anthropic Claude (vision OCR). Deployable on Vercel.

## Architecture

```
upload PNG ─▶ /api/extract ─▶ Claude ─▶ tracks
                                          │ review + select
tracks ─▶ /api/queue (service role) ─▶ Supabase queue_items
                                          │ realtime INSERT
Chrome extension ─▶ Beatport cart ─▶ UPDATE queue_items (status)
                                          │ realtime UPDATE
dashboard rows update live
```

Security model:

- The Anthropic key and the Supabase service-role key are server-only. They are
  never sent to the browser or the extension.
- Row-Level Security scopes every row to the logged-in user. The extension may
  only `UPDATE` `queue_items`; all inserts go through server routes with the
  service role.
- Paid features are gated three ways: in `proxy.ts` (formerly middleware), in
  each route handler, and in the RLS policies themselves (`is_subscribed`). A
  cancelled user cannot bypass the paywall by writing straight to Supabase.

## Setup

### 1. Install

```bash
cd web
npm install
```

### 2. Supabase

1. Create a project at https://supabase.com.
2. In the SQL editor, run [`supabase/schema.sql`](supabase/schema.sql).
3. Settings → API: copy the Project URL, the `anon` key, and the
   `service_role` key.
4. Authentication → Providers → Email: keep "Email" enabled (magic link).
   Add `http://localhost:3000/auth/callback` (and your production URL) under
   Authentication → URL Configuration → Redirect URLs.

### 3. Stripe

1. Create a recurring Product/Price ($10/month). Copy the price id
   (`price_...`).
2. Copy your secret key (`sk_test_...`).
3. Create a webhook endpoint pointing at `/api/stripe/webhook` for events
   `checkout.session.completed`, `customer.subscription.created`,
   `customer.subscription.updated`, `customer.subscription.deleted`. Copy the
   signing secret (`whsec_...`). For local testing use the Stripe CLI:

```bash
stripe listen --forward-to localhost:3000/api/stripe/webhook
```

### 4. Environment

Copy `.env.example` to `.env.local` and fill in every value.

```bash
cp .env.example .env.local
```

`NEXT_PUBLIC_EXTENSION_ID` is the id Chrome assigns the unpacked extension
(see [`../extension/README.md`](../extension/README.md)).

### 5. Run

```bash
npm run dev
```

Open http://localhost:3000.

## Deploy (Vercel)

1. Push the repo and import the `web/` directory as the project root in Vercel.
2. Add all the env vars from `.env.local` in the Vercel project settings. Set
   `NEXT_PUBLIC_SITE_URL` to the production URL.
3. Point the Stripe webhook at `https://your-domain/api/stripe/webhook`.
4. Add your production URL to Supabase redirect URLs.
5. Add your production origin to the extension's `externally_connectable`
   matches and reload the extension (see the extension README).

## Rate limiting

`/api/extract` caps each user at `DAILY_EXTRACT_LIMIT` (30) screenshots per
rolling 24h, counted in the `extract_log` table. Adjust in `lib/types.ts`.
