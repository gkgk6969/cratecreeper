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

  // --- Extension detection ------------------------------------------------
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
    setExtStatus(res.paired ? 'paired' : 'unpaired');
  }, [extensionId]);

  useEffect(() => {
    checkExtension();
  }, [checkExtension]);

  async function connectExtension() {
    setPairing(true);
    setError(null);
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
      setError(e instanceof Error ? e.message : 'Pairing failed');
    } finally {
      setPairing(false);
    }
  }

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
        onConnect={connectExtension}
        onRecheck={checkExtension}
      />

      {error && (
        <div className="border-danger/50 bg-danger/10 text-danger border px-3 py-2 text-xs leading-relaxed">
          {error}
        </div>
      )}

      {phase === 'idle' && (
        <label
          onDragOver={(e) => e.preventDefault()}
          onDrop={onDrop}
          className="border-border hover:border-accent flex h-56 cursor-pointer flex-col items-center justify-center border border-dashed text-center transition-colors"
        >
          <div className="text-fg text-sm font-bold uppercase tracking-wider">
            Drop a tracklist screenshot
          </div>
          <div className="text-muted mt-2 text-xs">
            or click to choose · PNG, JPEG, WebP · max 4MB
          </div>
          <input
            type="file"
            accept="image/png,image/jpeg,image/webp"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) handleFile(f);
            }}
          />
        </label>
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

          <button
            onClick={sendToBeatport}
            disabled={selectedCount === 0 || extStatus !== 'paired'}
            className="bg-accent text-accent-fg py-3 text-sm font-bold uppercase tracking-wider disabled:opacity-30"
          >
            {extStatus === 'paired'
              ? `Send ${selectedCount} to Beatport cart`
              : 'Connect extension to continue'}
          </button>
          {extStatus === 'paired' && (
            <p className="text-muted text-[11px] leading-relaxed">
              Make sure Beatport is open and you are logged in. The extension
              will walk through each track in a single tab.
            </p>
          )}
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
  onRecheck,
}: {
  status: ExtStatus;
  pairing: boolean;
  onConnect: () => void;
  onRecheck: () => void;
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
      <div className="border-border text-muted border px-3 py-2 text-xs">
        Checking for the Crate Digger extension…
      </div>
    );
  }

  if (status === 'missing') {
    return (
      <div className="border-border bg-panel flex items-center justify-between border px-3 py-3 text-xs">
        <div className="text-muted leading-relaxed">
          Crate Digger extension not detected. Install it in Chrome, then
          <button onClick={onRecheck} className="text-accent ml-1 underline">
            re-check
          </button>
          .
        </div>
      </div>
    );
  }

  // unpaired
  return (
    <div className="border-border bg-panel flex items-center justify-between border px-3 py-3 text-xs">
      <span className="text-muted">Extension installed but not connected.</span>
      <button
        onClick={onConnect}
        disabled={pairing}
        className="bg-accent text-accent-fg px-3 py-1 text-[11px] font-bold uppercase tracking-wider disabled:opacity-40"
      >
        {pairing ? 'Connecting…' : 'Connect extension'}
      </button>
    </div>
  );
}
