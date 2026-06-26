'use client';

import { useState } from 'react';

export default function SubscribeButton() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function startCheckout() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/stripe/checkout', { method: 'POST' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Checkout failed');
      window.location.href = data.url;
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Checkout failed');
      setLoading(false);
    }
  }

  return (
    <div>
      <button
        onClick={startCheckout}
        disabled={loading}
        className="bg-accent text-accent-fg px-6 py-3 text-sm font-bold uppercase tracking-wider disabled:opacity-40"
      >
        {loading ? 'Redirecting…' : 'Start free trial'}
      </button>
      {error && <div className="text-danger mt-3 text-xs">{error}</div>}
    </div>
  );
}
