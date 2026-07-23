'use client';

// PROTOTYPE — floating variant switcher pill. Dev-only.

import { useEffect } from 'react';

export type SwitcherVariant = { key: string; label: string };

export function PrototypeSwitcher({
  variants,
  current,
  onChange,
}: {
  variants: SwitcherVariant[];
  current: string;
  onChange: (key: string) => void;
}) {
  useEffect(() => {
    if (process.env.NODE_ENV === 'production') return;
    function onKey(e: KeyboardEvent) {
      const el = document.activeElement as HTMLElement | null;
      if (el && ['INPUT', 'TEXTAREA'].includes(el.tagName)) return;
      if (el && el.isContentEditable) return;
      const idx = variants.findIndex((v) => v.key === current);
      if (e.key === 'ArrowLeft') {
        e.preventDefault();
        onChange(variants[(idx - 1 + variants.length) % variants.length].key);
      } else if (e.key === 'ArrowRight') {
        e.preventDefault();
        onChange(variants[(idx + 1) % variants.length].key);
      }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [variants, current, onChange]);

  if (process.env.NODE_ENV === 'production') return null;

  const currentMeta = variants.find((v) => v.key === current) ?? variants[0];
  const idx = variants.findIndex((v) => v.key === currentMeta.key);
  const prev = variants[(idx - 1 + variants.length) % variants.length];
  const next = variants[(idx + 1) % variants.length];

  return (
    <div
      style={{
        position: 'fixed',
        bottom: 20,
        left: '50%',
        transform: 'translateX(-50%)',
        zIndex: 50,
        display: 'flex',
        alignItems: 'center',
        gap: 4,
        padding: '6px 8px',
        borderRadius: 999,
        background: 'rgba(15, 27, 45, 0.92)',
        color: 'white',
        boxShadow: '0 6px 24px rgba(0,0,0,0.25)',
        fontFamily: 'ui-sans-serif, system-ui, sans-serif',
        fontSize: 13,
      }}
    >
      <button
        onClick={() => onChange(prev.key)}
        aria-label="Previous variant"
        style={{
          width: 32,
          height: 32,
          borderRadius: 999,
          background: 'transparent',
          color: 'white',
          border: 0,
          cursor: 'pointer',
        }}
      >
        ←
      </button>
      <div style={{ padding: '0 10px', fontWeight: 600 }}>
        {currentMeta.key} — {currentMeta.label}
      </div>
      <button
        onClick={() => onChange(next.key)}
        aria-label="Next variant"
        style={{
          width: 32,
          height: 32,
          borderRadius: 999,
          background: 'transparent',
          color: 'white',
          border: 0,
          cursor: 'pointer',
        }}
      >
        →
      </button>
    </div>
  );
}
