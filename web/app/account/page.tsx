import { redirect } from 'next/navigation';
import Link from 'next/link';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { getSubscription } from '@/lib/subscription';
import { getGatekeepAppStoreUrl } from '@/lib/gatekeep';
import AccountActions from './AccountActions';

export default async function AccountPage() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect('/login');

  const sub = await getSubscription(supabase, user.id);

  const statusLabel =
    sub?.status === 'active'
      ? 'Active'
      : sub?.status === 'trialing'
        ? 'Free trial'
        : sub?.status === 'past_due'
          ? 'Payment due'
          : sub?.status === 'canceled'
            ? 'Cancelled'
            : 'Free beta';

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col px-6 py-10">
      <header className="mb-8 flex items-center justify-between">
        <div className="flex items-baseline gap-2">
          <a
            href={getGatekeepAppStoreUrl()}
            target="_blank"
            rel="noreferrer"
            className="text-accent text-sm font-bold uppercase tracking-[0.3em]"
          >
            Gatekeep
          </a>
          <Link
            href="/dashboard"
            className="text-muted hover:text-fg text-xs uppercase tracking-wider"
          >
            cratecreep
          </Link>
        </div>
        <Link
          href="/dashboard"
          className="text-muted hover:text-fg text-xs uppercase tracking-wider"
        >
          Dashboard
        </Link>
      </header>

      <h1 className="text-2xl font-bold">Account</h1>

      <dl className="border-border mt-6 divide-y divide-border border">
        <Row label="Email" value={user.email ?? '—'} />
        <Row label="Plan" value={statusLabel} />
        {sub?.current_period_end && (
          <Row
            label="Renews"
            value={new Date(sub.current_period_end).toLocaleDateString()}
          />
        )}
      </dl>

      <AccountActions hasBilling={!!sub} />
    </main>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between px-3 py-3 text-sm">
      <dt className="text-muted text-xs uppercase tracking-wider">{label}</dt>
      <dd>{value}</dd>
    </div>
  );
}
