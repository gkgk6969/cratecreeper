'use client';

import { useState } from 'react';
import Link from 'next/link';
import { createSupabaseBrowserClient } from '@/lib/supabase/browser';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function sendLink(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    const supabase = createSupabaseBrowserClient();
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: {
        emailRedirectTo: `${window.location.origin}/auth/callback`,
      },
    });
    setLoading(false);
    if (error) {
      setError(error.message);
      return;
    }
    setSent(true);
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-sm flex-col justify-center px-6">
      <div className="mb-10 flex items-baseline gap-2">
        <a
          href="https://gatekeep.app"
          target="_blank"
          rel="noreferrer"
          className="text-accent text-sm font-bold uppercase tracking-[0.3em]"
        >
          Gatekeep
        </a>
        <Link
          href="/"
          className="text-muted hover:text-fg text-xs uppercase tracking-wider"
        >
          Crate Digger
        </Link>
      </div>

      {sent ? (
        <div className="border-border bg-panel border p-6">
          <div className="font-bold">Check your email</div>
          <p className="text-muted mt-2 text-sm leading-relaxed">
            We sent a sign-in link to <span className="text-fg">{email}</span>.
            Open it on this device to continue.
          </p>
        </div>
      ) : (
        <form onSubmit={sendLink} className="flex flex-col gap-4">
          <label className="text-muted text-xs uppercase tracking-wider">
            Email
          </label>
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com"
            className="border-border focus:border-accent w-full border bg-transparent p-3 text-sm outline-none"
          />
          {error && <div className="text-danger text-xs">{error}</div>}
          <button
            type="submit"
            disabled={loading}
            className="bg-accent text-accent-fg py-3 text-sm font-bold uppercase tracking-wider disabled:opacity-40"
          >
            {loading ? 'Sending…' : 'Send sign-in link'}
          </button>
          <p className="text-muted text-[11px] leading-relaxed">
            We use passwordless sign-in. No password to remember.
          </p>
        </form>
      )}
    </main>
  );
}
