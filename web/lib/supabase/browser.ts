import { createBrowserClient } from '@supabase/ssr';

// Browser Supabase client for client components (auth UI, realtime progress,
// and reading the current session to hand off to the extension during pairing).
export function createSupabaseBrowserClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}
