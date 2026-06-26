/**
 * Creates (or updates) a Chrome Web Store reviewer test account:
 * - Supabase Auth user with email + password (no magic link needed)
 * - Active subscription row
 *
 * Usage: node scripts/setup-chrome-reviewer.mjs
 * Reads SUPABASE_* from ../.env.local
 */

import { readFileSync, writeFileSync, mkdirSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import { createClient } from '@supabase/supabase-js';
import { randomBytes } from 'crypto';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ENV_PATH = join(__dirname, '../.env.local');
const REVIEWER_EMAIL = 'cratecreeper.chromereview@gmail.com';
const SITE_URL = 'https://cratecreeper-kh9c.vercel.app';

function loadEnv(path) {
  const env = {};
  for (const line of readFileSync(path, 'utf8').split('\n')) {
    const t = line.trim();
    if (!t || t.startsWith('#')) continue;
    const i = t.indexOf('=');
    if (i === -1) continue;
    env[t.slice(0, i).trim()] = t.slice(i + 1).trim();
  }
  return env;
}

function genPassword() {
  return randomBytes(12).toString('base64url');
}

async function main() {
  const env = loadEnv(ENV_PATH);
  const url = env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) {
    console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in web/.env.local');
    process.exit(1);
  }

  const admin = createClient(url, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  let password = genPassword();
  let userId = null;

  const { data: listed } = await admin.auth.admin.listUsers({ perPage: 200 });
  const existing = listed?.users?.find((u) => u.email === REVIEWER_EMAIL);

  if (existing) {
    userId = existing.id;
    const { error } = await admin.auth.admin.updateUserById(userId, {
      password,
      email_confirm: true,
    });
    if (error) throw error;
    console.log('Updated existing reviewer user password.');
  } else {
    const { data, error } = await admin.auth.admin.createUser({
      email: REVIEWER_EMAIL,
      password,
      email_confirm: true,
    });
    if (error) throw error;
    userId = data.user.id;
    console.log('Created reviewer user.');
  }

  const { error: subErr } = await admin.from('subscriptions').upsert(
    {
      user_id: userId,
      status: 'active',
      current_period_end: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString(),
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'user_id' }
  );
  if (subErr) throw subErr;
  console.log('Subscription set to active.');

  const instructions = `Chrome Web Store — Test instructions (paste into dashboard)
Generated: ${new Date().toISOString()}

=== USERNAME ===
${REVIEWER_EMAIL}

=== PASSWORD ===
${password}

=== ADDITIONAL INSTRUCTIONS ===
1. Go to ${SITE_URL}/login
2. Click "Sign in with password" and enter the username and password above.
   This test account has an active subscription (no payment required).
3. Install the extension from the submitted package. Open the dashboard —
   the extension auto-pairs when connected (status dot turns green).
4. Log into beatport.com in the same Chrome profile (free account is fine).
   Cart adds require a Beatport session; searches still run without one.
5. Upload a tracklist screenshot (any image with a few "Artist - Title" lines).
6. Start the queue. The extension opens Beatport in a background tab and
   processes each track. The dashboard shows per-track status.
7. No purchase is required. Reviewers only need to verify search + cart
   automation and dashboard feedback.

Privacy policy: ${SITE_URL}/privacy
`;

  const outDir = join(__dirname, '../../store-assets');
  mkdirSync(outDir, { recursive: true });
  const outPath = join(outDir, 'chrome-review-test-instructions.txt');
  writeFileSync(outPath, instructions, 'utf8');
  console.log(`\nWrote ${outPath}`);
  console.log('\n--- COPY BELOW INTO CHROME WEB STORE ---\n');
  console.log(instructions);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
