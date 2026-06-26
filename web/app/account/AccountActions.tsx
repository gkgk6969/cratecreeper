'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createSupabaseBrowserClient } from '@/lib/supabase/browser';

export default function AccountActions({ hasBilling }: { hasBilling: boolean }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function openPortal() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/stripe/portal', { method: 'POST' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Could not open billing');
      window.location.href = data.url;
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not open billing');
      setLoading(false);
    }
  }

  async function signOut() {
    const supabase = createSupabaseBrowserClient();
    await supabase.auth.signOut();
    router.push('/');
    router.refresh();
  }

  return (
    <div className="mt-6 flex flex-col gap-3">
      {hasBilling && (
        <button
          onClick={openPortal}
          disabled={loading}
          className="border-border hover:border-accent border px-4 py-3 text-sm uppercase tracking-wider disabled:opacity-40"
        >
          {loading ? 'Opening…' : 'Manage billing'}
        </button>
      )}
      <button
        onClick={signOut}
        className="text-muted hover:text-danger text-xs uppercase tracking-wider"
      >
        Sign out
      </button>
      {error && <div className="text-danger text-xs">{error}</div>}
    </div>
  );
}
