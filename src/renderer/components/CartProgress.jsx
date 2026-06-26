import React, { useEffect, useState } from 'react';

const STATE_LABELS = {
  pending: { icon: '\u00B7', color: 'text-muted', label: 'queued' },
  searching: { icon: '\u25CB', color: 'text-fg', label: 'searching' },
  added: { icon: '\u2713', color: 'text-accent', label: 'in cart' },
  ambiguous: { icon: '?', color: 'text-yellow-400', label: 'review' },
  notfound: { icon: 'x', color: 'text-red-400', label: 'not found' },
  error: { icon: '!', color: 'text-red-400', label: 'error' },
  captcha: { icon: '\u26A0', color: 'text-yellow-400', label: 'captcha' },
};

export default function CartProgress({ tracks, onContinue, onCancel }) {
  const [connected, setConnected] = useState(false);
  const [statuses, setStatuses] = useState({});

  useEffect(() => {
    let mounted = true;
    window.api.bridge.getState().then((s) => {
      if (!mounted) return;
      setConnected(s.connected);
      setStatuses(s.statuses || {});
    });
    const offConn = window.api.bridge.onConnection(({ connected }) => {
      setConnected(connected);
    });
    const offStatus = window.api.bridge.onStatus(({ trackId, ...rest }) => {
      setStatuses((prev) => ({ ...prev, [trackId]: rest }));
    });
    return () => {
      mounted = false;
      offConn && offConn();
      offStatus && offStatus();
    };
  }, []);

  const counts = tracks.reduce(
    (acc, _, i) => {
      const s = statuses[i]?.state || 'pending';
      acc[s] = (acc[s] || 0) + 1;
      return acc;
    },
    {}
  );
  const added = counts.added || 0;
  const ambiguous = counts.ambiguous || 0;
  const notfound = counts.notfound || 0;
  const captcha = counts.captcha || 0;
  const inflight = (counts.searching || 0) + (counts.pending || 0) + captcha;
  const canContinue = inflight === 0;

  return (
    <div className="flex flex-col gap-2 h-full">
      <div className="flex items-center justify-between">
        <div className="text-[10px] uppercase tracking-wider text-muted">
          extension {connected ? '\u2022 connected' : '\u2022 not connected'}
        </div>
        <div
          className={`w-2 h-2 rounded-full ${
            connected ? 'bg-accent' : 'bg-red-500/60'
          }`}
        />
      </div>

      {!connected && (
        <div className="border border-border p-2 text-[11px] leading-relaxed text-muted">
          install the bridge extension first.{' '}
          <span className="text-accent">extension/README.md</span> has the
          load-unpacked steps. then make sure you are logged in to Beatport.
        </div>
      )}

      <div className="text-[10px] uppercase tracking-wider text-muted mt-1">
        {added} / {tracks.length} in cart
        {ambiguous > 0 ? ` \u00B7 ${ambiguous} review` : ''}
        {notfound > 0 ? ` \u00B7 ${notfound} missed` : ''}
        {captcha > 0 && (
          <span className="text-yellow-400">
            {' \u00B7 '}{captcha} captcha
          </span>
        )}
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto border border-border">
        {tracks.map((t, i) => {
          const s = statuses[i] || { state: 'pending' };
          const meta = STATE_LABELS[s.state] || STATE_LABELS.pending;
          return (
            <div
              key={i}
              className="flex items-center gap-2 px-2 py-1 border-b border-border last:border-b-0"
            >
              <span className={`w-3 text-center text-xs ${meta.color}`}>
                {meta.icon}
              </span>
              <span className="flex-1 truncate text-xs">
                <span className="text-accent">{t.artist}</span>
                <span className="text-muted"> - </span>
                <span>{t.title}</span>
              </span>
              {s.productUrl && (
                <a
                  href="#"
                  onClick={(e) => {
                    e.preventDefault();
                    window.open(s.productUrl);
                  }}
                  className="text-[10px] text-muted hover:text-accent shrink-0"
                >
                  view
                </a>
              )}
              <span className={`text-[10px] ${meta.color} shrink-0`}>
                {meta.label}
              </span>
            </div>
          );
        })}
      </div>

      <div className="flex gap-2 mt-2">
        <button
          onClick={onContinue}
          disabled={!canContinue || added === 0}
          className="flex-1 py-2 bg-accent text-black font-bold uppercase text-xs tracking-wider disabled:opacity-30 disabled:bg-border disabled:text-muted disabled:cursor-not-allowed"
        >
          Continue ({added})
        </button>
        <button
          onClick={onCancel}
          className="py-2 px-3 text-muted hover:text-fg text-[10px] uppercase tracking-wider"
        >
          cancel
        </button>
      </div>
    </div>
  );
}
