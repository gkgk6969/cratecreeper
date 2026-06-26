import type { SupabaseClient } from '@supabase/supabase-js';

const ACTIVE_STATUSES = ['active', 'trialing'];

export type SubscriptionRow = {
  status: string;
  current_period_end: string | null;
};

// Defense in depth: every paid route handler re-checks subscription status
// directly (not just middleware). Uses whichever client is passed — the
// user-scoped server client is enough since RLS lets a user read their own row.
export async function getSubscription(
  supabase: SupabaseClient,
  userId: string
): Promise<SubscriptionRow | null> {
  const { data } = await supabase
    .from('subscriptions')
    .select('status, current_period_end')
    .eq('user_id', userId)
    .maybeSingle();
  return data ?? null;
}

export function isActive(sub: SubscriptionRow | null): boolean {
  return !!sub && ACTIVE_STATUSES.includes(sub.status);
}
