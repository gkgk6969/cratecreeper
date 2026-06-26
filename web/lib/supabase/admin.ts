import { createClient } from '@supabase/supabase-js';

// Service-role Supabase client. Bypasses RLS — use ONLY in server-side route
// handlers, never in client code or the extension. Used for the writes that
// RLS deliberately forbids clients from doing: inserting queue_items / sessions
// / extract_log, and upserting subscriptions from the Stripe webhook.
export function createSupabaseAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      auth: { autoRefreshToken: false, persistSession: false },
    }
  );
}
