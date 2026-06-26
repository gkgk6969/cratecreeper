import React from 'react';

const STORES = [
  { id: 'beatport', label: 'Beatport' },
  { id: 'bandcamp', label: 'Bandcamp' },
];

export default function StoreSelector({ storeId, onChange }) {
  return (
    <div className="flex gap-2 mt-3">
      {STORES.map((s) => (
        <button
          key={s.id}
          onClick={() => onChange(s.id)}
          className={`flex-1 py-2 text-xs uppercase tracking-wider border transition-colors ${
            storeId === s.id
              ? 'border-accent text-accent'
              : 'border-border text-muted hover:border-fg hover:text-fg'
          }`}
        >
          {s.label}
        </button>
      ))}
    </div>
  );
}
