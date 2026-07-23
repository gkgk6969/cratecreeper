'use client';

// PROTOTYPE — Variant A: Ambient horizon.
// Full-viewport fixed layer behind all content. The flame is atmospheric,
// licking up from the bottom of the browser window on every screen. Cart-fill
// intensity scales the whole layer.

import { Flame } from './Flame';

export function VariantA({ intensity }: { intensity: number }) {
  const heightVh = 45 + intensity * 40;
  return (
    <div
      style={{
        position: 'fixed',
        left: 0,
        right: 0,
        bottom: 0,
        height: `${heightVh}vh`,
        zIndex: 0,
        pointerEvents: 'none',
      }}
      aria-hidden
    >
      <Flame
        intensity={0.25 + intensity * 0.75}
        seed={11}
        className="absolute inset-0"
      />
    </div>
  );
}

export const VARIANT_A_META = {
  key: 'A',
  label: 'Ambient horizon',
  blurb: 'Full-width flame licks up from the bottom of every screen.',
};
