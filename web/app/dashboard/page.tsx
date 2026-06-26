import { redirect } from 'next/navigation';
import Link from 'next/link';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { getSubscription, isActive } from '@/lib/subscription';
import DashboardClient from './DashboardClient';
import SubscribeButton from './SubscribeButton';

export default async function DashboardPage() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect('/login');

  const sub = await getSubscription(supabase, user.id);

  return (
    <main className="mx-auto flex min-h-screen max-w-2xl flex-col px-6 py-10">
      <header className="mb-8 flex items-center justify-between">
        <div className="flex items-baseline gap-2">
          <a
            href="https://gatekeep.app"
            target="_blank"
            rel="noreferrer"
            className="text-accent text-sm font-bold uppercase tracking-[0.3em]"
          >
            Gatekeep
          </a>
          <span className="text-muted text-xs uppercase tracking-wider">
            Crate Digger
          </span>
        </div>
        <nav className="flex items-center gap-4">
          <Link
            href="/account"
            className="text-muted hover:text-fg text-xs uppercase tracking-wider"
          >
            Account
          </Link>
        </nav>
      </header>

      {isActive(sub) ? (
        <DashboardClient
          userEmail={user.email ?? ''}
          extensionId={process.env.NEXT_PUBLIC_EXTENSION_ID ?? ''}
        />
      ) : (
        <section className="border-border bg-panel border p-8">
          <h1 className="text-2xl font-bold">Start your free trial</h1>
          <p className="text-muted mt-2 text-sm leading-relaxed">
            Crate Digger is $10/month after a 7-day free trial. Unlimited
            tracklists, cancel anytime.
          </p>
          <div className="mt-6">
            <SubscribeButton />
          </div>
        </section>
      )}
    </main>
  );
}
