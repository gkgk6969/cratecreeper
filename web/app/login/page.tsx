'use client';

import { useState } from 'react';
import Link from 'next/link';
import { createSupabaseBrowserClient } from '@/lib/supabase/browser';
import { getGatekeepAppStoreUrl } from '@/lib/gatekeep';

type Stage = 'email' | 'code' | 'password';

export default function LoginPage() {
  const [stage, setStage] = useState<Stage>('email');
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function signInWithPassword(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    const supabase = createSupabaseBrowserClient();
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setLoading(false);
    if (error) {
      setError(error.message);
      return;
    }
    window.location.href = '/dashboard';
  }

  // Sends a 6-digit code (no magic link click flow) so Gmail's link scanner
  // can't burn the token before the user actually opens it.
  async function sendCode(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    const supabase = createSupabaseBrowserClient();
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: { shouldCreateUser: true },
    });
    setLoading(false);
    if (error) {
      setError(error.message);
      return;
    }
    setStage('code');
  }

  async function verifyCode(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    const supabase = createSupabaseBrowserClient();
    const { error } = await supabase.auth.verifyOtp({
      email,
      token: code.trim(),
      type: 'email',
    });
    setLoading(false);
    if (error) {
      setError(error.message);
      return;
    }
    window.location.href = '/dashboard';
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-sm flex-col justify-center px-6">
      <div className="mb-10 flex items-baseline gap-2">
        <a
          href={getGatekeepAppStoreUrl()}
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
          cratecreep
        </Link>
      </div>

      {stage === 'code' ? (
        <form onSubmit={verifyCode} className="flex flex-col gap-4">
          <div className="text-muted text-sm leading-relaxed">
            We sent a 6-digit code to{' '}
            <span className="text-fg font-medium">{email}</span>.
          </div>
          <label className="text-muted text-xs uppercase tracking-wider">
            Code
          </label>
          <input
            type="text"
            inputMode="numeric"
            autoComplete="one-time-code"
            required
            maxLength={6}
            value={code}
            onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
            placeholder="123456"
            className="border-border focus:border-accent w-full border bg-transparent p-3 text-center text-lg tracking-[0.5em] outline-none"
          />
          {error && <div className="text-danger text-xs">{error}</div>}
          <button
            type="submit"
            disabled={loading || code.length < 6}
            className="bg-accent text-accent-fg py-3 text-sm font-bold uppercase tracking-wider disabled:opacity-40"
          >
            {loading ? 'Verifying…' : 'Sign in'}
          </button>
          <button
            type="button"
            onClick={() => {
              setStage('email');
              setCode('');
              setError(null);
            }}
            className="text-muted hover:text-fg text-[11px] underline"
          >
            Use a different email
          </button>
        </form>
      ) : stage === 'password' ? (
        <form onSubmit={signInWithPassword} className="flex flex-col gap-4">
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
          <label className="text-muted text-xs uppercase tracking-wider">
            Password
          </label>
          <input
            type="password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="current-password"
            className="border-border focus:border-accent w-full border bg-transparent p-3 text-sm outline-none"
          />
          {error && <div className="text-danger text-xs">{error}</div>}
          <button
            type="submit"
            disabled={loading}
            className="bg-accent text-accent-fg py-3 text-sm font-bold uppercase tracking-wider disabled:opacity-40"
          >
            {loading ? 'Signing in…' : 'Sign in'}
          </button>
          <button
            type="button"
            onClick={() => {
              setStage('email');
              setError(null);
            }}
            className="text-muted hover:text-fg text-[11px] underline"
          >
            Use email code instead
          </button>
        </form>
      ) : (
        <form onSubmit={sendCode} className="flex flex-col gap-4">
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
            {loading ? 'Sending…' : 'Send 6-digit code'}
          </button>
          <p className="text-muted text-[11px] leading-relaxed">
            We&apos;ll email you a code to sign in. No password to remember.
          </p>
          <button
            type="button"
            onClick={() => {
              setStage('password');
              setError(null);
            }}
            className="text-muted hover:text-fg text-[11px] underline"
          >
            Sign in with password
          </button>
        </form>
      )}
    </main>
  );
}
