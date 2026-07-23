'use client';

// PROTOTYPE — throwaway. Three variants of the "blue flame that grows with
// cart-fill" concept. See README.md next to this file for the question the
// prototype is answering.

import { useEffect, useMemo, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { VariantA, VARIANT_A_META } from '@/components/prototype/flame/VariantA';
import {
  VariantBDashboardHero,
  VariantBHeaderEmber,
  VARIANT_B_META,
} from '@/components/prototype/flame/VariantB';
import { VariantC, VARIANT_C_META } from '@/components/prototype/flame/VariantC';
import { PrototypeSwitcher } from '@/components/prototype/flame/PrototypeSwitcher';

type Screen = 'dashboard' | 'account' | 'login';

const VARIANTS = [VARIANT_A_META, VARIANT_B_META, VARIANT_C_META];

export default function FlamePrototypePage() {
  const router = useRouter();
  const params = useSearchParams();
  const variant = (params.get('variant') ?? 'A').toUpperCase();
  const [screen, setScreen] = useState<Screen>('dashboard');
  const [filled, setFilled] = useState(3);
  const [autoplay, setAutoplay] = useState(false);
  const total = 12;
  const intensity = filled / total;

  useEffect(() => {
    if (!autoplay) return;
    const id = setInterval(() => {
      setFilled((f) => (f >= total ? 0 : f + 1));
    }, 900);
    return () => clearInterval(id);
  }, [autoplay]);

  function setVariant(key: string) {
    const next = new URLSearchParams(params);
    next.set('variant', key);
    router.replace(`?${next.toString()}`);
  }

  return (
    <div
      style={{
        position: 'relative',
        minHeight: '100vh',
        overflow: 'hidden',
      }}
    >
      {variant === 'A' && <VariantA intensity={intensity} />}
      {variant === 'C' && <VariantC intensity={intensity} />}

      <div style={{ position: 'relative', zIndex: 1 }}>
        <TopBar
          screen={screen}
          onScreen={setScreen}
          filled={filled}
          total={total}
          onFilled={setFilled}
          autoplay={autoplay}
          onAutoplay={setAutoplay}
          headerEmber={
            variant === 'B' && screen !== 'dashboard' ? (
              <VariantBHeaderEmber intensity={intensity} />
            ) : null
          }
        />

        <div style={{ maxWidth: 900, margin: '0 auto', padding: '48px 24px 120px' }}>
          {screen === 'dashboard' && (
            <DashboardMock
              filled={filled}
              total={total}
              variant={variant}
              intensity={intensity}
            />
          )}
          {screen === 'account' && <AccountMock />}
          {screen === 'login' && <LoginMock />}
        </div>
      </div>

      <PrototypeSwitcher
        variants={VARIANTS}
        current={variant}
        onChange={setVariant}
      />
    </div>
  );
}

function TopBar({
  screen,
  onScreen,
  filled,
  total,
  onFilled,
  autoplay,
  onAutoplay,
  headerEmber,
}: {
  screen: Screen;
  onScreen: (s: Screen) => void;
  filled: number;
  total: number;
  onFilled: (n: number) => void;
  autoplay: boolean;
  onAutoplay: (b: boolean) => void;
  headerEmber: React.ReactNode;
}) {
  const btn = (s: Screen, label: string) => (
    <button
      onClick={() => onScreen(s)}
      style={{
        padding: '6px 12px',
        border: `1px solid ${screen === s ? '#2563eb' : '#dbe4f0'}`,
        background: screen === s ? '#2563eb' : 'transparent',
        color: screen === s ? 'white' : '#0f1b2d',
        borderRadius: 999,
        fontSize: 12,
        fontWeight: 600,
        letterSpacing: 0.4,
        textTransform: 'uppercase',
        cursor: 'pointer',
      }}
    >
      {label}
    </button>
  );
  return (
    <div
      style={{
        position: 'sticky',
        top: 0,
        background: 'rgba(255,255,255,0.85)',
        backdropFilter: 'blur(8px)',
        WebkitBackdropFilter: 'blur(8px)',
        borderBottom: '1px solid #dbe4f0',
        padding: '12px 20px',
        display: 'flex',
        alignItems: 'center',
        gap: 20,
        zIndex: 2,
      }}
    >
      <div
        style={{
          fontWeight: 700,
          letterSpacing: 3,
          color: '#2563eb',
          fontSize: 12,
        }}
      >
        GATEKEEP <span style={{ color: '#5b6b7f' }}>CRATECREEP</span>
      </div>
      <div style={{ display: 'flex', gap: 6 }}>
        {btn('dashboard', 'Dashboard')}
        {btn('account', 'Account')}
        {btn('login', 'Login')}
      </div>
      <div style={{ marginLeft: 'auto', display: 'flex', gap: 12, alignItems: 'center' }}>
        {headerEmber}
        <span style={{ fontSize: 12, color: '#5b6b7f' }}>
          {filled} / {total} in cart
        </span>
        <input
          type="range"
          min={0}
          max={total}
          value={filled}
          onChange={(e) => onFilled(Number(e.target.value))}
          style={{ width: 140 }}
          aria-label="Simulated cart fill"
        />
        <button
          onClick={() => onAutoplay(!autoplay)}
          style={{
            padding: '6px 12px',
            border: '1px solid #dbe4f0',
            background: autoplay ? '#0f1b2d' : 'transparent',
            color: autoplay ? 'white' : '#0f1b2d',
            borderRadius: 999,
            fontSize: 12,
            fontWeight: 600,
            cursor: 'pointer',
          }}
        >
          {autoplay ? '■ Stop' : '▶ Play'}
        </button>
      </div>
    </div>
  );
}

function DashboardMock({
  filled,
  total,
  variant,
  intensity,
}: {
  filled: number;
  total: number;
  variant: string;
  intensity: number;
}) {
  const inCart = filled;
  const remaining = total - filled;
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <div
        style={{
          border: '1px solid #dbe4f0',
          background: 'rgba(244, 247, 251, 0.85)',
          padding: 20,
        }}
      >
        <div style={{ fontSize: 12, color: '#5b6b7f', letterSpacing: 1, textTransform: 'uppercase' }}>
          {filled === total ? 'Done' : 'Filling your cart…'}
        </div>

        {variant === 'B' ? (
          <div style={{ marginTop: 12 }}>
            <VariantBDashboardHero intensity={intensity} />
            <div style={{ textAlign: 'center', marginTop: 8, fontSize: 32, fontWeight: 700 }}>
              {inCart}
              <span style={{ color: '#5b6b7f', fontSize: 18, fontWeight: 400 }}> / {total} in cart</span>
            </div>
          </div>
        ) : (
          <>
            <div style={{ marginTop: 4, fontSize: 32, fontWeight: 700 }}>
              {inCart}
              <span style={{ color: '#5b6b7f', fontSize: 18, fontWeight: 400 }}> / {total} in cart</span>
            </div>
            <div
              style={{
                marginTop: 12,
                height: 6,
                background: '#dbe4f0',
                position: 'relative',
              }}
            >
              <div
                style={{
                  position: 'absolute',
                  inset: 0,
                  width: `${(inCart / total) * 100}%`,
                  background: '#2563eb',
                  transition: 'width 0.5s',
                }}
              />
            </div>
          </>
        )}
      </div>

      <ul style={{ border: '1px solid #dbe4f0', padding: 0, margin: 0, listStyle: 'none' }}>
        {Array.from({ length: total }).map((_, i) => {
          const state = i < inCart ? 'added' : i === inCart ? 'searching' : 'pending';
          return (
            <li
              key={i}
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                padding: '10px 14px',
                borderTop: i === 0 ? 0 : '1px solid #dbe4f0',
                fontSize: 14,
              }}
            >
              <span>
                <span style={{ color: '#2563eb' }}>Artist {i + 1}</span>
                <span style={{ color: '#5b6b7f' }}> — </span>
                Track {i + 1}
              </span>
              <span
                style={{
                  fontSize: 11,
                  letterSpacing: 1,
                  textTransform: 'uppercase',
                  color: state === 'added' ? '#2563eb' : state === 'searching' ? '#0f1b2d' : '#5b6b7f',
                }}
              >
                {state === 'added' ? 'In cart' : state === 'searching' ? 'Searching' : 'Queued'}
              </span>
            </li>
          );
        })}
      </ul>
      <div style={{ fontSize: 11, color: '#5b6b7f' }}>{remaining} tracks left · mock data</div>
    </div>
  );
}

function AccountMock() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      <h1 style={{ fontSize: 24, fontWeight: 700 }}>Account</h1>
      <div style={{ border: '1px solid #dbe4f0', padding: 20 }}>
        <div style={{ fontSize: 12, color: '#5b6b7f', letterSpacing: 1, textTransform: 'uppercase' }}>
          Plan
        </div>
        <div style={{ marginTop: 4, fontSize: 20, fontWeight: 700 }}>Free beta</div>
        <div style={{ marginTop: 6, fontSize: 13, color: '#5b6b7f' }}>
          10 screenshots per day. Paid plan when we come out of beta.
        </div>
      </div>
      <div style={{ border: '1px solid #dbe4f0', padding: 20 }}>
        <div style={{ fontSize: 12, color: '#5b6b7f', letterSpacing: 1, textTransform: 'uppercase' }}>
          Email
        </div>
        <div style={{ marginTop: 4, fontSize: 16 }}>you@example.com</div>
      </div>
    </div>
  );
}

function LoginMock() {
  return (
    <div style={{ maxWidth: 360, margin: '80px auto', display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={{ fontSize: 12, color: '#5b6b7f', letterSpacing: 2, textTransform: 'uppercase' }}>
        Email
      </div>
      <input
        type="email"
        placeholder="you@example.com"
        style={{
          padding: 12,
          border: '1px solid #dbe4f0',
          background: 'transparent',
          fontSize: 14,
        }}
      />
      <button
        style={{
          padding: 14,
          background: '#2563eb',
          color: 'white',
          border: 0,
          fontWeight: 700,
          letterSpacing: 1,
          textTransform: 'uppercase',
          cursor: 'pointer',
        }}
      >
        Send sign-in code
      </button>
    </div>
  );
}
