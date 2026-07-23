'use client';

// PROTOTYPE — Variant B: Central pyre.
// The flame is the primary progress visualization on the dashboard: a big
// centered pillar replacing the progress bar. On other pages, a small ember
// medallion tucks into the header so the flame is still "there" but demure.

import { Flame } from './Flame';

export function VariantBDashboardHero({ intensity }: { intensity: number }) {
  const size = 260 + intensity * 60;
  return (
    <div
      className="mx-auto"
      style={{
        position: 'relative',
        width: '100%',
        height: `${size}px`,
      }}
    >
      <Flame
        intensity={0.15 + intensity * 0.85}
        seed={22}
        columns={7}
        className="absolute inset-0"
      />
    </div>
  );
}

export function VariantBHeaderEmber({ intensity }: { intensity: number }) {
  return (
    <div
      style={{
        position: 'relative',
        width: 56,
        height: 56,
      }}
      aria-hidden
    >
      <Flame
        intensity={0.35 + intensity * 0.4}
        seed={22}
        columns={2}
        className="absolute inset-0"
      />
    </div>
  );
}

export const VARIANT_B_META = {
  key: 'B',
  label: 'Central pyre',
  blurb:
    'Flame IS the progress bar on the dashboard. A small ember lives in the header on every other screen.',
};
