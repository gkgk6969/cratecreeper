import React, { useEffect, useState } from 'react';

export default function DownloadWatcher({ expected, onDone, onCancel }) {
  const [matched, setMatched] = useState({});
  const [unmatched, setUnmatched] = useState([]);
  const [pairingFile, setPairingFile] = useState(null);

  useEffect(() => {
    const off = window.api.watcher.onUpdate((payload) => {
      const m = {};
      (payload.matched || []).forEach((p) => {
        m[p.trackIndex] = p.file;
      });
      setMatched(m);
      setUnmatched(payload.unmatched || []);
    });
    return () => off && off();
  }, []);

  const matchedCount = Object.keys(matched).length;

  useEffect(() => {
    if (matchedCount > 0 && matchedCount === expected.length) {
      handleDone();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [matchedCount, expected.length]);

  async function handlePairFile(trackIndex) {
    if (!pairingFile) return;
    await window.api.watcher.manualPair(pairingFile, trackIndex);
    setPairingFile(null);
  }

  function handleDone() {
    const list = expected
      .map((t, i) => {
        const f = matched[i];
        if (!f) return null;
        return {
          artist: f.artist || t.artist,
          title: f.title || t.title,
          path: f.path,
          size: f.size,
          bpm: f.bpm,
          key: f.key,
          genre: f.genre,
        };
      })
      .filter(Boolean);
    onDone(list);
  }

  return (
    <div className="flex flex-col gap-2 h-full">
      <div className="text-[10px] uppercase tracking-wider text-muted">
        watching downloads &middot; {matchedCount} / {expected.length} matched
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto flex flex-col gap-3 pr-1">
        <div className="border border-border">
          {expected.map((t, i) => {
            const f = matched[i];
            const clickable = pairingFile && !f;
            return (
              <div
                key={i}
                onClick={() => clickable && handlePairFile(i)}
                className={`flex items-center gap-2 px-2 py-1 border-b border-border last:border-b-0 ${
                  clickable ? 'cursor-pointer hover:bg-accent/10' : ''
                }`}
              >
                <span
                  className={`w-3 text-center text-xs ${
                    f ? 'text-accent' : 'text-muted'
                  }`}
                >
                  {f ? '\u2713' : '\u00B7'}
                </span>
                <span className="flex-1 truncate text-xs">
                  <span className="text-accent">{t.artist}</span>
                  <span className="text-muted"> - </span>
                  <span>{t.title}</span>
                </span>
                {f && f.bpm && (
                  <span className="text-[10px] text-muted shrink-0">
                    {Math.round(f.bpm)}bpm
                  </span>
                )}
              </div>
            );
          })}
        </div>

        {unmatched.length > 0 && (
          <div>
            <div className="text-[10px] uppercase tracking-wider text-muted mb-1">
              unmatched files (click to pair)
            </div>
            <div className="border border-border">
              {unmatched.map((f) => (
                <div
                  key={f.id}
                  onClick={() =>
                    setPairingFile(pairingFile === f.id ? null : f.id)
                  }
                  className={`px-2 py-1 border-b border-border last:border-b-0 cursor-pointer text-xs truncate ${
                    pairingFile === f.id
                      ? 'bg-accent/10 text-accent'
                      : 'hover:bg-white/5'
                  }`}
                  title={f.path}
                >
                  {f.artist && f.title
                    ? `${f.artist} - ${f.title}`
                    : f.filename}
                </div>
              ))}
            </div>
            {pairingFile && (
              <div className="text-[10px] text-accent mt-1">
                click an unmatched track above to pair
              </div>
            )}
          </div>
        )}
      </div>

      <div className="flex gap-2 mt-2">
        <button
          onClick={handleDone}
          disabled={matchedCount === 0}
          className="flex-1 py-2 bg-accent text-black font-bold uppercase text-xs tracking-wider disabled:opacity-30 disabled:bg-border disabled:text-muted disabled:cursor-not-allowed"
        >
          Done ({matchedCount})
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
