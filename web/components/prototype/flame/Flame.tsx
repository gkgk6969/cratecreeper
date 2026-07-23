'use client';

// PROTOTYPE — throwaway. See web/app/prototype/flame/README.md.
//
// Blue-flame primitive. Renders one flame column made of three stacked
// teardrop tongues (deep blue → medium blue → white-hot core) that flicker
// independently. Multiple columns are rendered side-by-side to fill a wider
// area. On top of the tongues we draw:
//   * an always-on radial bloom at the base (ember glow)
//   * a small population of rising "sparks"
// Intensity 0..1 scales tongue height, flicker amplitude, spark rate,
// and bloom brightness.

import { useId, useMemo } from 'react';

export type FlameProps = {
  intensity?: number; // 0..1
  columns?: number; // how many parallel tongues span the container's width
  className?: string;
  style?: React.CSSProperties;
  seed?: number;
};

const clamp01 = (n: number) => Math.max(0, Math.min(1, n));

export function Flame({
  intensity = 0.15,
  columns = 5,
  className,
  style,
  seed = 3,
}: FlameProps) {
  const i = clamp01(intensity);
  const rawId = useId();
  const scopeId = useMemo(
    () => `flame-${rawId.replace(/[^a-zA-Z0-9]/g, '')}`,
    [rawId]
  );

  const tongueScale = 0.55 + i * 0.7;
  const bloomOpacity = 0.35 + i * 0.6;
  const flickerAmplitude = 0.06 + i * 0.14;

  const cols = useMemo(() => {
    const arr: {
      leftPct: number;
      widthPct: number;
      scale: number;
      delayA: number;
      delayB: number;
      delayC: number;
      speed: number;
      hueShift: number;
    }[] = [];
    for (let k = 0; k < columns; k++) {
      const t = (k + 0.5) / columns;
      const centerPct = t * 100;
      const widthPct = (110 / columns) * (0.7 + hash(k, seed) * 0.7);
      arr.push({
        leftPct: centerPct - widthPct / 2,
        widthPct,
        scale: 0.7 + hash(k * 7 + 1, seed) * 0.6,
        delayA: hash(k * 3 + 2, seed) * 2,
        delayB: hash(k * 3 + 5, seed) * 2,
        delayC: hash(k * 3 + 11, seed) * 2,
        speed: 0.35 + hash(k * 2 + 4, seed) * 0.4,
        hueShift: (hash(k * 9 + 13, seed) - 0.5) * 12,
      });
    }
    return arr;
  }, [columns, seed]);

  const sparkCount = Math.round(6 + i * 20);
  const sparks = useMemo(() => {
    const arr: { leftPct: number; delay: number; duration: number; size: number }[] = [];
    for (let k = 0; k < sparkCount; k++) {
      arr.push({
        leftPct: hash(k * 17 + 1, seed + 1) * 100,
        delay: hash(k * 7 + 3, seed + 2) * 4,
        duration: 2.2 + hash(k * 5 + 8, seed + 3) * 2.4,
        size: 1.5 + hash(k * 11 + 6, seed + 4) * 3,
      });
    }
    return arr;
  }, [sparkCount, seed]);

  return (
    <div
      className={className}
      style={{
        pointerEvents: 'none',
        overflow: 'hidden',
        ...style,
      }}
      aria-hidden
    >
      {/* Base bloom — the always-on ember glow, brightest at intensity 1 */}
      <div
        style={{
          position: 'absolute',
          left: '-10%',
          bottom: '-20%',
          width: '120%',
          height: '60%',
          background: `radial-gradient(50% 100% at 50% 100%,
            rgba(147, 197, 253, ${bloomOpacity}) 0%,
            rgba(59, 130, 246, ${bloomOpacity * 0.7}) 30%,
            rgba(29, 78, 216, ${bloomOpacity * 0.4}) 55%,
            rgba(15, 23, 42, 0) 80%)`,
          filter: 'blur(20px)',
        }}
      />

      {/* Flame tongues, one column at a time. Each column stacks three
          teardrop layers with independent flicker so the flame lives. */}
      <div style={{ position: 'absolute', inset: 0 }}>
        {cols.map((c, idx) => (
          <div
            key={idx}
            style={{
              position: 'absolute',
              left: `${c.leftPct}%`,
              bottom: '-8%',
              width: `${c.widthPct}%`,
              height: `${72 * tongueScale * c.scale}%`,
              transformOrigin: '50% 100%',
              filter: 'blur(1px)',
            }}
            className={scopeId + '-col'}
          >
            <Tongue
              tier="outer"
              hueShift={c.hueShift}
              flicker={flickerAmplitude}
              delay={c.delayA}
              speed={c.speed * 1.0}
              scope={scopeId}
            />
            <Tongue
              tier="middle"
              hueShift={c.hueShift}
              flicker={flickerAmplitude * 1.1}
              delay={c.delayB}
              speed={c.speed * 1.35}
              scope={scopeId}
            />
            <Tongue
              tier="core"
              hueShift={c.hueShift}
              flicker={flickerAmplitude * 1.25}
              delay={c.delayC}
              speed={c.speed * 1.7}
              scope={scopeId}
            />
          </div>
        ))}
      </div>

      {/* Rising sparks */}
      <div style={{ position: 'absolute', inset: 0 }}>
        {sparks.map((s, idx) => (
          <span
            key={idx}
            className={scopeId + '-spark'}
            style={{
              position: 'absolute',
              left: `${s.leftPct}%`,
              bottom: '0%',
              width: s.size,
              height: s.size,
              borderRadius: '50%',
              background:
                'radial-gradient(circle, rgba(224,242,254,0.95) 0%, rgba(147,197,253,0.7) 55%, rgba(59,130,246,0) 100%)',
              filter: 'blur(0.6px)',
              animation: `${scopeId}-spark ${s.duration}s ease-out ${s.delay}s infinite`,
              opacity: 0,
            }}
          />
        ))}
      </div>

      <style>{`
        @keyframes ${scopeId}-outer {
          0%, 100% { transform: scaleX(1) scaleY(1) translateY(0); opacity: 0.65; }
          50%     { transform: scaleX(${1 - flickerAmplitude * 0.5}) scaleY(${1 + flickerAmplitude * 0.9}) translateY(-2%); opacity: 0.8; }
        }
        @keyframes ${scopeId}-middle {
          0%, 100% { transform: scaleX(1) scaleY(1) translateY(0); opacity: 0.85; }
          40%     { transform: scaleX(${1 - flickerAmplitude}) scaleY(${1 + flickerAmplitude * 1.3}) translateY(-3%); opacity: 1; }
        }
        @keyframes ${scopeId}-core {
          0%, 100% { transform: scaleX(1) scaleY(1) translateY(0); opacity: 0.9; }
          45%     { transform: scaleX(${1 - flickerAmplitude * 1.4}) scaleY(${1 + flickerAmplitude * 1.7}) translateY(-4%); opacity: 1; }
        }
        @keyframes ${scopeId}-spark {
          0%   { opacity: 0; transform: translate(0, 0) scale(1); }
          10%  { opacity: 1; }
          80%  { opacity: 0.5; }
          100% { opacity: 0; transform: translate(0, -${140 + i * 60}px) scale(0.4); }
        }
      `}</style>
    </div>
  );
}

function Tongue({
  tier,
  hueShift,
  flicker,
  delay,
  speed,
  scope,
}: {
  tier: 'outer' | 'middle' | 'core';
  hueShift: number;
  flicker: number;
  delay: number;
  speed: number;
  scope: string;
}) {
  void flicker;
  const params =
    tier === 'outer'
      ? {
          width: '100%',
          height: '100%',
          background: `radial-gradient(50% 65% at 50% 100%,
            hsla(${215 + hueShift}, 90%, 55%, 0.95) 0%,
            hsla(${220 + hueShift}, 95%, 45%, 0.75) 40%,
            hsla(${225 + hueShift}, 90%, 30%, 0) 90%)`,
          blur: 8,
          zIndex: 1,
        }
      : tier === 'middle'
        ? {
            width: '65%',
            height: '80%',
            background: `radial-gradient(50% 70% at 50% 100%,
              hsla(${205 + hueShift}, 100%, 72%, 1) 0%,
              hsla(${215 + hueShift}, 100%, 60%, 0.85) 45%,
              hsla(${225 + hueShift}, 100%, 40%, 0) 90%)`,
            blur: 3,
            zIndex: 2,
          }
        : {
            width: '38%',
            height: '58%',
            background: `radial-gradient(50% 75% at 50% 100%,
              rgba(255,255,255,0.95) 0%,
              hsla(${200 + hueShift}, 100%, 85%, 0.8) 40%,
              hsla(${210 + hueShift}, 100%, 65%, 0) 95%)`,
            blur: 1.4,
            zIndex: 3,
          };

  return (
    <div
      style={{
        position: 'absolute',
        left: `${(100 - parseFloat(params.width)) / 2}%`,
        bottom: '-4%',
        width: params.width,
        height: params.height,
        background: params.background,
        borderRadius: '50% 50% 42% 42% / 82% 82% 18% 18%',
        filter: `blur(${params.blur}px)`,
        mixBlendMode: 'screen',
        zIndex: params.zIndex,
        transformOrigin: '50% 100%',
        animation: `${scope}-${tier} ${speed.toFixed(2)}s ease-in-out ${delay.toFixed(2)}s infinite alternate`,
      }}
    />
  );
}

// Tiny deterministic hash so each column has stable but varied parameters
// without relying on Math.random (which would re-roll on every render).
function hash(k: number, seed: number): number {
  const x = Math.sin(k * 12.9898 + seed * 78.233) * 43758.5453;
  return x - Math.floor(x);
}
