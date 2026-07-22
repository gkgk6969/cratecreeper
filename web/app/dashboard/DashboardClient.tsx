'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { createSupabaseBrowserClient } from '@/lib/supabase/browser';
import {
  isExtensionApiAvailable,
  pingExtension,
  pairExtension,
  startQueueInExtension,
} from '@/lib/extension';
import type { QueueItem, TrackState } from '@/lib/types';

type ReviewTrack = {
  artist: string;
  title: string;
  mix?: string;
  selected: boolean;
};

type Phase = 'idle' | 'extracting' | 'review' | 'running';
type ExtStatus = 'checking' | 'missing' | 'unpaired' | 'paired';

const STATE_LABEL: Record<TrackState, string> = {
  pending: 'Queued',
  searching: 'Searching',
  added: 'In cart',
  unconfirmed: 'Likely in cart',
  notfound: 'Not found',
  ambiguous: 'Needs review',
  error: 'Error',
  captcha: 'Captcha — solve in Beatport',
};

const STATE_COLOR: Record<TrackState, string> = {
  pending: 'text-muted',
  searching: 'text-fg',
  added: 'text-accent',
  unconfirmed: 'text-amber-600',
  notfound: 'text-danger',
  ambiguous: 'text-amber-600',
  error: 'text-danger',
  captcha: 'text-danger',
};

// States that mean a track has finished processing (no more work pending).
const TERMINAL_STATES = new Set<TrackState>([
  'added',
  'unconfirmed',
  'notfound',
  'ambiguous',
  'error',
  'captcha',
]);

const BEATPORT_CART_URL = 'https://www.beatport.com/cart';

// Chrome Web Store listing for the cratecreep extension. Override via
// NEXT_PUBLIC_CHROME_STORE_URL if the listing moves.
const CHROME_STORE_URL =
  process.env.NEXT_PUBLIC_CHROME_STORE_URL ??
  'https://chromewebstore.google.com/detail/abnpagmfbleekilgjbkogkidhhfconnl';

export default function DashboardClient({
  userEmail,
  extensionId,
}: {
  userEmail: string;
  extensionId: string;
}) {
  const supabase = useRef(createSupabaseBrowserClient());

  const [phase, setPhase] = useState<Phase>('idle');
  const [error, setError] = useState<string | null>(null);
  const [tracks, setTracks] = useState<ReviewTrack[]>([]);
  const [remaining, setRemaining] = useState<number | null>(null);

  const [extStatus, setExtStatus] = useState<ExtStatus>('checking');
  const [pairing, setPairing] = useState(false);

  const [items, setItems] = useState<QueueItem[]>([]);
  const [beatportReady, setBeatportReady] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // --- Extension detection + auto-pair ------------------------------------
  // Prevents overlapping pair attempts (auto-pair retries on each poll tick).
  const pairingRef = useRef(false);

  const connectExtension = useCallback(
    async (silent = false) => {
      if (pairingRef.current) return;
      pairingRef.current = true;
      setPairing(true);
      if (!silent) setError(null);
      try {
        const { data } = await supabase.current.auth.getSession();
        const session = data.session;
        if (!session) throw new Error('Not signed in');
        const ok = await pairExtension(
          extensionId,
          session.access_token,
          session.refresh_token
        );
        if (!ok) throw new Error('Pairing was rejected by the extension');
        setExtStatus('paired');
      } catch (e) {
        // A silent auto-pair just retries on the next poll; only surface the
        // error when the user explicitly clicked to (re)connect.
        if (!silent) setError(e instanceof Error ? e.message : 'Pairing failed');
      } finally {
        pairingRef.current = false;
        setPairing(false);
      }
    },
    [extensionId]
  );

  const checkExtension = useCallback(async () => {
    if (!extensionId || !isExtensionApiAvailable()) {
      setExtStatus('missing');
      return;
    }
    const res = await pingExtension(extensionId);
    if (!res.ok) {
      setExtStatus('missing');
      return;
    }
    if (res.paired) {
      setExtStatus('paired');
      return;
    }
    setExtStatus('unpaired');
    // Installed but not paired: hand over the session tokens automatically,
    // so the user never has to click "Connect".
    connectExtension(true);
  }, [extensionId, connectExtension]);

  // Poll until paired so the banner reacts on its own when the extension is
  // installed or enabled after the page has loaded - no manual "re-check".
  useEffect(() => {
    if (extStatus === 'paired') return;
    checkExtension();
    const id = setInterval(checkExtension, 2500);
    return () => clearInterval(id);
  }, [extStatus, checkExtension]);

  // --- Upload + extract ---------------------------------------------------
  async function handleFile(file: File) {
    setError(null);
    const reader = new FileReader();
    reader.onload = async () => {
      const dataUrl = reader.result as string;
      setPhase('extracting');
      try {
        const res = await fetch('/api/extract', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ image: dataUrl }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error ?? 'Extraction failed');
        setTracks(
          (data.tracks as Omit<ReviewTrack, 'selected'>[]).map((t) => ({
            ...t,
            selected: true,
          }))
        );
        setRemaining(data.extractsRemaining ?? null);
        setPhase('review');
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Extraction failed');
        setPhase('idle');
      }
    };
    reader.readAsDataURL(file);
  }

  function onDrop(e: React.DragEvent) {
    e.preventDefault();
    const file = e.dataTransfer.files?.[0];
    if (file) handleFile(file);
  }

  // --- Send to Beatport ---------------------------------------------------
  async function sendToBeatport() {
    const selected = tracks.filter((t) => t.selected);
    if (selected.length === 0) return;
    setError(null);
    try {
      const res = await fetch('/api/queue', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          tracks: selected.map(({ artist, title, mix }) => ({
            artist,
            title,
            mix,
          })),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Could not start');

      const sessionId: string = data.sessionId;
      await subscribeToSession(sessionId);
      // Nudge the extension to begin walking this session immediately.
      try {
        await startQueueInExtension(extensionId, sessionId);
      } catch {
        // Extension picks up the new rows via realtime regardless.
      }
      setPhase('running');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not start');
    }
  }

  async function subscribeToSession(sessionId: string) {
    const sb = supabase.current;
    const { data } = await sb
      .from('queue_items')
      .select('*')
      .eq('session_id', sessionId)
      .order('idx');
    setItems((data as QueueItem[]) ?? []);

    sb.channel(`queue-${sessionId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'queue_items',
          filter: `session_id=eq.${sessionId}`,
        },
        (payload) => {
          const row = payload.new as QueueItem;
          setItems((prev) => {
            const next = [...prev];
            const i = next.findIndex((r) => r.id === row.id);
            if (i >= 0) next[i] = row;
            else next.push(row);
            return next.sort((a, b) => a.idx - b.idx);
          });
        }
      )
      .subscribe();
  }

  function reset() {
    setTracks([]);
    setItems([]);
    setPhase('idle');
    setError(null);
    setBeatportReady(false);
  }

  const selectedCount = tracks.filter((t) => t.selected).length;
  const inCartCount = items.filter(
    (i) => i.state === 'added' || i.state === 'unconfirmed'
  ).length;
  const doneCount = items.filter((i) => TERMINAL_STATES.has(i.state)).length;
  const allDone = items.length > 0 && doneCount === items.length;
  const pct = items.length
    ? Math.round((inCartCount / items.length) * 100)
    : 0;

  return (
    <div className="flex flex-col gap-6">
      <ExtensionBanner
        status={extStatus}
        pairing={pairing}
        onConnect={() => connectExtension(false)}
      />

      {error && (
        <div className="border-danger/50 bg-danger/10 text-danger border px-3 py-2 text-xs leading-relaxed">
          {error}
        </div>
      )}

      {phase === 'idle' && (
        <div
          onDragOver={(e) => e.preventDefault()}
          onDrop={onDrop}
          onClick={() => fileInputRef.current?.click()}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              fileInputRef.current?.click();
            }
          }}
          className="border-border hover:border-accent flex h-56 cursor-pointer flex-col items-center justify-center border border-dashed text-center transition-colors"
        >
          <div className="text-fg text-sm font-bold uppercase tracking-wider">
            Drop a tracklist screenshot
          </div>
          <div className="text-muted mt-2 text-xs">
            or click to choose · PNG, JPEG, WebP · max 4MB
          </div>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/png,image/jpeg,image/webp"
            className="sr-only"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) handleFile(f);
              e.target.value = '';
            }}
          />
        </div>
      )}

      {phase === 'extracting' && (
        <div className="border-border flex h-56 flex-col items-center justify-center border">
          <div className="border-accent h-6 w-6 animate-spin rounded-full border-2 border-t-transparent" />
          <div className="text-muted mt-4 text-xs uppercase tracking-wider">
            Reading tracks…
          </div>
        </div>
      )}

      {phase === 'review' && (
        <div className="flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <div className="text-muted text-xs uppercase tracking-wider">
              {tracks.length} tracks found
              {remaining !== null && ` · ${remaining} extracts left today`}
            </div>
            <button
              onClick={reset}
              className="text-muted hover:text-fg text-xs uppercase tracking-wider"
            >
              Start over
            </button>
          </div>

          <ul className="border-border divide-border divide-y border">
            {tracks.map((t, i) => (
              <li key={i} className="flex items-center gap-3 px-3 py-2">
                <input
                  type="checkbox"
                  checked={t.selected}
                  onChange={(e) =>
                    setTracks((prev) =>
                      prev.map((x, j) =>
                        j === i ? { ...x, selected: e.target.checked } : x
                      )
                    )
                  }
                />
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm">
                    <span className="text-accent">{t.artist}</span>
                    <span className="text-muted"> — </span>
                    {t.title}
                    {t.mix && <span className="text-muted"> ({t.mix})</span>}
                  </div>
                </div>
              </li>
            ))}
          </ul>

          {extStatus === 'paired' && (
            <div className="border-amber-500/60 bg-amber-500/10 flex flex-col gap-3 border p-4">
              <div className="flex flex-col gap-1">
                <div className="text-xs font-bold uppercase tracking-wider text-amber-600 dark:text-amber-400">
                  Before you press Go
                </div>
                <div className="text-fg text-sm font-bold leading-snug">
                  You must be signed into Beatport
                </div>
                <div className="text-muted text-xs leading-relaxed">
                  Cratecreep uses your own Beatport account to add tracks. If
                  you&apos;re not logged in, the cart will stay empty.
                </div>
              </div>
              <a
                href="https://www.beatport.com/account/login"
                target="_blank"
                rel="noreferrer"
                className="text-accent text-xs font-bold uppercase tracking-wider underline underline-offset-2"
              >
                Open Beatport and sign in →
              </a>
              <label className="text-fg flex cursor-pointer items-start gap-2 text-xs">
                <input
                  type="checkbox"
                  checked={beatportReady}
                  onChange={(e) => setBeatportReady(e.target.checked)}
                  className="mt-[2px]"
                />
                <span>I&apos;m signed into Beatport and ready to go.</span>
              </label>
            </div>
          )}

          <button
            onClick={sendToBeatport}
            disabled={
              selectedCount === 0 ||
              extStatus !== 'paired' ||
              !beatportReady
            }
            className="bg-accent text-accent-fg py-3 text-sm font-bold uppercase tracking-wider disabled:opacity-30"
          >
            {extStatus !== 'paired'
              ? 'Connect extension to continue'
              : !beatportReady
                ? 'Confirm you are signed into Beatport'
                : `Send ${selectedCount} to Beatport cart`}
          </button>
        </div>
      )}

      {phase === 'running' && (
        <div className="flex flex-col gap-5">
          <div className="border-border bg-panel border p-5">
            <div className="flex items-end justify-between">
              <div>
                <div className="text-muted text-xs uppercase tracking-wider">
                  {allDone ? 'Done' : 'Filling your cart…'}
                </div>
                <div className="mt-1 text-3xl font-bold tabular-nums">
                  {inCartCount}
                  <span className="text-muted text-lg font-normal">
                    {' '}
                    / {items.length}
                  </span>
                  <span className="text-muted ml-2 align-middle text-sm font-normal">
                    in cart
                  </span>
                </div>
              </div>
              <button
                onClick={reset}
                className="text-muted hover:text-fg text-xs uppercase tracking-wider"
              >
                New screenshot
              </button>
            </div>
            <div className="bg-border mt-4 h-2 w-full overflow-hidden rounded-full">
              <div
                className="bg-accent cd-bar-fill h-full rounded-full"
                style={{ width: `${pct}%` }}
              />
            </div>
          </div>

          {allDone && (
            <a
              href={BEATPORT_CART_URL}
              target="_blank"
              rel="noreferrer"
              className="bg-accent text-accent-fg cd-row-in flex items-center justify-between px-4 py-3 text-sm font-bold uppercase tracking-wider"
            >
              <span>Cart ready — review &amp; check out</span>
              <span aria-hidden>→</span>
            </a>
          )}

          <ul className="border-border divide-border divide-y border">
            {items.map((it) => {
              const active = it.state === 'searching';
              return (
                <li
                  key={it.id}
                  className={`cd-row-in flex items-center gap-3 px-3 py-2.5 ${
                    active ? 'bg-panel' : ''
                  }`}
                >
                  <StatusIcon key={it.state} state={it.state} />
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm">
                      <span className="text-accent">{it.artist}</span>
                      <span className="text-muted"> — </span>
                      {it.title}
                      {it.mix && <span className="text-muted"> ({it.mix})</span>}
                    </div>
                    {it.detail && (
                      <div className="text-muted truncate text-[11px]">
                        {it.product_url ? (
                          <a
                            href={it.product_url}
                            target="_blank"
                            rel="noreferrer"
                            className="hover:text-fg underline"
                          >
                            {it.detail}
                          </a>
                        ) : (
                          it.detail
                        )}
                      </div>
                    )}
                  </div>
                  <div
                    className={`shrink-0 text-[11px] uppercase tracking-wider ${STATE_COLOR[it.state]}`}
                  >
                    {STATE_LABEL[it.state]}
                  </div>
                </li>
              );
            })}
          </ul>
        </div>
      )}

      <div className="text-muted text-[11px]">Signed in as {userEmail}</div>
    </div>
  );
}

function StatusIcon({ state }: { state: TrackState }) {
  if (state === 'searching') {
    return (
      <span className="border-accent inline-block h-4 w-4 shrink-0 animate-spin rounded-full border-2 border-t-transparent" />
    );
  }
  if (state === 'added') {
    return (
      <span className="bg-accent text-accent-fg cd-pop inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[12px] font-bold leading-none">
        ✓
      </span>
    );
  }
  if (state === 'unconfirmed') {
    return (
      <span className="cd-pop inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-amber-500 text-[12px] font-bold leading-none text-white">
        ✓
      </span>
    );
  }
  if (state === 'ambiguous') {
    return (
      <span className="inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-amber-500 text-[12px] font-bold leading-none text-white">
        ?
      </span>
    );
  }
  if (state === 'error' || state === 'captcha') {
    return (
      <span className="bg-danger inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[12px] font-bold leading-none text-white">
        !
      </span>
    );
  }
  if (state === 'notfound') {
    return (
      <span className="border-border text-muted inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full border text-[12px] leading-none">
        –
      </span>
    );
  }
  // pending
  return (
    <span className="border-border inline-block h-4 w-4 shrink-0 rounded-full border" />
  );
}

function ExtensionBanner({
  status,
  pairing,
  onConnect,
}: {
  status: ExtStatus;
  pairing: boolean;
  onConnect: () => void;
}) {
  if (status === 'paired') {
    return (
      <div className="border-accent/40 bg-accent/10 text-accent flex items-center justify-between border px-3 py-2 text-xs">
        <span>Extension connected</span>
        <span className="h-2 w-2 rounded-full bg-current" />
      </div>
    );
  }

  if (status === 'checking') {
    return (
      <div className="border-border text-muted flex items-center gap-2 border px-3 py-2 text-xs">
        <span className="border-muted inline-block h-3 w-3 animate-spin rounded-full border-2 border-t-transparent" />
        Looking for the cratecreep extension…
      </div>
    );
  }

  if (status === 'missing') {
    return (
      <div className="border-accent/40 bg-accent/5 flex flex-col gap-4 border p-5">
        <div className="flex flex-col gap-1">
          <div className="text-accent text-[11px] font-bold uppercase tracking-wider">
            One more step
          </div>
          <div className="text-fg text-base font-bold leading-snug">
            Install the cratecreep extension
          </div>
          <div className="text-muted text-xs leading-relaxed">
            You need our Chrome extension installed for cratecreep to work.
          </div>
        </div>
        <a
          href={CHROME_STORE_URL}
          target="_blank"
          rel="noreferrer"
          className="bg-accent text-accent-fg inline-flex items-center justify-center px-4 py-3 text-sm font-bold uppercase tracking-wider transition-opacity hover:opacity-90"
        >
          Add to Chrome →
        </a>
        <div className="text-muted text-[11px] leading-relaxed">
          Once installed, this page hooks up automatically. Refresh if it
          doesn&apos;t.
        </div>
      </div>
    );
  }

  // unpaired — auto-pair is running; offer a manual retry as a fallback.
  return (
    <div className="border-border bg-panel flex items-center justify-between border px-3 py-3 text-xs">
      <span className="text-muted flex items-center gap-2">
        <span className="border-accent inline-block h-3 w-3 animate-spin rounded-full border-2 border-t-transparent" />
        Almost there — approving connection…
      </span>
      <button
        onClick={onConnect}
        disabled={pairing}
        className="text-accent underline disabled:opacity-40"
      >
        Retry
      </button>
    </div>
  );
}
