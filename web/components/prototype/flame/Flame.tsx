'use client';

// PROTOTYPE — throwaway. See web/app/prototype/flame/README.md.
//
// Shared blue-flame primitive. Renders one organic, softly-flickering blue
// flame that scales its bloom, wobble, and vertical reach with `intensity`.
// Composition:
//   * SVG `<filter>` combining feTurbulence + feDisplacementMap for organic
//     wobble, plus feGaussianBlur + feColorMatrix "gooey" trick that fuses
//     the internal blobs into a single molten shape with hard silhouette.
//   * Absolutely-positioned radial-gradient blobs rise and fade on staggered
//     keyframes. Below the "gooey" filter they read as licking flames.
//   * Bottom bloom radial gradient provides the always-on base glow.

import { useId, useMemo } from 'react';

export type FlameProps = {
  intensity?: number; // 0..1
  className?: string; // positioning wrapper
  style?: React.CSSProperties;
  seed?: number; // per-variant so filters don't share turbulence seeds
};

const clamp01 = (n: number) => Math.max(0, Math.min(1, n));

export function Flame({
  intensity = 0.15,
  className,
  style,
  seed = 3,
}: FlameProps) {
  const i = clamp01(intensity);
  const rawId = useId();
  const filterId = useMemo(
    () => `flame-filter-${rawId.replace(/[^a-zA-Z0-9]/g, '')}`,
    [rawId]
  );

  // Higher intensity → wilder displacement + more contrast in the gooey merge.
  const displacementScale = 6 + i * 42;
  const goo = 12 + i * 10;
  const flameHeight = 40 + i * 60; // % of container
  const flameWidth = 60 + i * 40;
  const glowOpacity = 0.35 + i * 0.5;

  // Twelve blobs with per-blob offsets. Rendered under the gooey filter, they
  // merge into a coherent flame shape.
  const blobs = useMemo(() => {
    const out: {
      leftPct: number;
      delayS: number;
      durationS: number;
      sizePx: number;
      hue: number;
    }[] = [];
    for (let k = 0; k < 14; k++) {
      out.push({
        leftPct: 8 + (k * 6.5) % 84 + ((k * 13) % 5) - 2,
        delayS: (k * 0.31) % 3.2,
        durationS: 1.9 + ((k * 0.17) % 1.6),
        sizePx: 60 + ((k * 23) % 90),
        hue: 210 + ((k * 5) % 30),
      });
    }
    return out;
  }, []);

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
      {/* Inline filter definitions. Each Flame instance gets its own id so
          filters don't collide when multiple flames render on one page. */}
      <svg
        style={{ position: 'absolute', width: 0, height: 0 }}
        aria-hidden
        focusable="false"
      >
        <defs>
          <filter id={filterId} x="-20%" y="-20%" width="140%" height="140%">
            <feTurbulence
              type="fractalNoise"
              baseFrequency="0.012 0.035"
              numOctaves={2}
              seed={seed}
            >
              <animate
                attributeName="baseFrequency"
                dur="9s"
                values="0.012 0.035; 0.02 0.055; 0.012 0.035"
                repeatCount="indefinite"
              />
            </feTurbulence>
            <feDisplacementMap
              in="SourceGraphic"
              scale={displacementScale}
            />
            <feGaussianBlur stdDeviation="7" />
            <feColorMatrix
              type="matrix"
              values={`1 0 0 0 0
                       0 1 0 0 0
                       0 0 1 0 0
                       0 0 0 ${goo} -6`}
            />
          </filter>
        </defs>
      </svg>

      {/* Always-on base bloom — reads even at intensity 0 as an ember glow. */}
      <div
        style={{
          position: 'absolute',
          left: '50%',
          bottom: 0,
          width: '120%',
          height: '55%',
          transform: 'translateX(-50%)',
          background:
            'radial-gradient(60% 100% at 50% 100%, rgba(37, 99, 235, ' +
            glowOpacity +
            ') 0%, rgba(59, 130, 246, ' +
            glowOpacity * 0.6 +
            ') 30%, rgba(29, 78, 216, 0) 70%)',
          filter: 'blur(24px)',
        }}
      />

      {/* Gooey flame body */}
      <div
        style={{
          position: 'absolute',
          left: `${(100 - flameWidth) / 2}%`,
          bottom: '-4%',
          width: `${flameWidth}%`,
          height: `${flameHeight}%`,
          filter: `url(#${filterId})`,
          mixBlendMode: 'screen',
        }}
      >
        {blobs.map((b, idx) => (
          <span
            key={idx}
            style={{
              position: 'absolute',
              left: `${b.leftPct}%`,
              bottom: `-${b.sizePx / 4}px`,
              width: `${b.sizePx}px`,
              height: `${b.sizePx * 1.4}px`,
              borderRadius: '50%',
              background: `radial-gradient(circle at 50% 60%,
                hsla(${b.hue}, 100%, 78%, 0.95) 0%,
                hsla(${b.hue + 10}, 100%, 60%, 0.85) 35%,
                hsla(${b.hue + 25}, 100%, 45%, 0.35) 65%,
                hsla(${b.hue + 30}, 100%, 30%, 0) 100%)`,
              animation: `flame-rise ${b.durationS}s ease-out ${b.delayS}s infinite`,
              opacity: 0,
            }}
          />
        ))}
      </div>

      {/* Highlight tip — a hotter white-blue core that sits above the wobble
          filter, giving the flame a bright center visible even at low intensity. */}
      <div
        style={{
          position: 'absolute',
          left: '50%',
          bottom: `${8 + i * 22}%`,
          width: `${20 + i * 20}%`,
          height: `${20 + i * 30}%`,
          transform: 'translateX(-50%)',
          background:
            'radial-gradient(50% 60% at 50% 65%, rgba(219, 234, 254, 0.9) 0%, rgba(147, 197, 253, 0.6) 40%, rgba(59, 130, 246, 0) 100%)',
          filter: 'blur(10px)',
          mixBlendMode: 'screen',
        }}
      />

      <style jsx>{`
        @keyframes flame-rise {
          0% {
            opacity: 0;
            transform: translateY(0) scale(1);
          }
          30% {
            opacity: 1;
          }
          70% {
            opacity: 0.6;
          }
          100% {
            opacity: 0;
            transform: translateY(-140%) scale(0.6);
          }
        }
      `}</style>
    </div>
  );
}
