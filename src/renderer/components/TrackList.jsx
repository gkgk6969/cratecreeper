import React, { useState } from 'react';

export default function TrackList({ tracks, onChange }) {
  function toggle(i) {
    onChange(
      tracks.map((t, idx) => (idx === i ? { ...t, selected: !t.selected } : t))
    );
  }
  function update(i, field, value) {
    onChange(
      tracks.map((t, idx) => (idx === i ? { ...t, [field]: value } : t))
    );
  }
  function remove(i) {
    onChange(tracks.filter((_, idx) => idx !== i));
  }

  const count = tracks.filter((t) => t.selected).length;

  return (
    <div className="flex flex-col gap-1">
      <div className="text-[10px] text-muted mb-2 uppercase tracking-wider">
        {count} / {tracks.length} tracks selected
      </div>
      <div className="flex flex-col gap-1 max-h-[360px] overflow-y-auto pr-1">
        {tracks.map((t, i) => (
          <Row
            key={i}
            t={t}
            onToggle={() => toggle(i)}
            onUpdate={(field, value) => update(i, field, value)}
            onRemove={() => remove(i)}
          />
        ))}
      </div>
    </div>
  );
}

function Row({ t, onToggle, onUpdate, onRemove }) {
  const [editing, setEditing] = useState(false);
  return (
    <div
      className={`flex items-center gap-2 px-2 py-1 border border-border ${
        t.selected ? '' : 'opacity-40'
      }`}
    >
      <input
        type="checkbox"
        checked={t.selected}
        onChange={onToggle}
        className="accent-accent shrink-0"
      />
      {editing ? (
        <div className="flex-1 flex gap-1 min-w-0">
          <input
            value={t.artist}
            onChange={(e) => onUpdate('artist', e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && setEditing(false)}
            className="flex-1 min-w-0 bg-transparent border border-border px-1 py-0.5 text-xs outline-none focus:border-accent text-accent"
            autoFocus
          />
          <input
            value={t.title}
            onChange={(e) => onUpdate('title', e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && setEditing(false)}
            onBlur={() => setEditing(false)}
            className="flex-1 min-w-0 bg-transparent border border-border px-1 py-0.5 text-xs outline-none focus:border-accent"
          />
        </div>
      ) : (
        <div
          onClick={() => setEditing(true)}
          className="flex-1 min-w-0 truncate text-xs cursor-text"
          title={`${t.artist} - ${t.title}`}
        >
          <span className="text-accent">{t.artist}</span>
          <span className="text-muted"> - </span>
          <span>{t.title}</span>
        </div>
      )}
      <button
        onClick={onRemove}
        className="text-muted hover:text-red-400 text-xs shrink-0"
        title="Remove"
      >
        x
      </button>
    </div>
  );
}
