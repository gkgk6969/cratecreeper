import { redirect } from 'next/navigation';
import Link from 'next/link';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { getGatekeepAppStoreUrl } from '@/lib/gatekeep';
import DashboardClient from './DashboardClient';

export default async function DashboardPage() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect('/login');

  return (
    <main className="mx-auto flex min-h-screen max-w-2xl flex-col px-6 py-10">
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
          <span className="text-muted text-xs uppercase tracking-wider">
            cratecreep
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

      <DashboardClient
        userEmail={user.email ?? ''}
        extensionId={process.env.NEXT_PUBLIC_EXTENSION_ID ?? ''}
      />
    </main>
  );
}
