'use client';

// PROTOTYPE — Variant C: Left torch.
// Vertical flame column pinned to the left edge of the viewport. Narrow, tall,
// present on every screen. Its height (and secondary glow) grows with the
// cart-fill intensity — a torch that burns brighter as tracks add.

import { Flame } from './Flame';

export function VariantC({ intensity }: { intensity: number }) {
  const heightVh = 55 + intensity * 40;
  const widthPx = 180 + intensity * 60;
  return (
    <div
      style={{
        position: 'fixed',
        left: 0,
        bottom: 0,
        width: `${widthPx}px`,
        height: `${heightVh}vh`,
        zIndex: 0,
        pointerEvents: 'none',
      }}
      aria-hidden
    >
      <Flame
        intensity={0.3 + intensity * 0.7}
        seed={33}
        className="absolute inset-0"
      />
    </div>
  );
}

export const VARIANT_C_META = {
  key: 'C',
  label: 'Left torch',
  blurb: 'Tall narrow flame pinned to the left edge. Grows taller as cart fills.',
};
