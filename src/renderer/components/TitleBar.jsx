import React from 'react';

export default function TitleBar({ onOpenSettings }) {
  return (
    <div
      className="flex items-center justify-between px-3 py-2 border-b border-border bg-bg select-none"
      style={{ WebkitAppRegion: 'drag' }}
    >
      <div className="text-accent text-xs uppercase tracking-[0.2em] font-bold">
        crate digger
      </div>
      <div
        className="flex items-center gap-3"
        style={{ WebkitAppRegion: 'no-drag' }}
      >
        <button
          onClick={onOpenSettings}
          className="text-muted hover:text-fg text-[10px] uppercase tracking-wider"
          title="Settings"
        >
          settings
        </button>
        <button
          onClick={() => window.api.window.minimize()}
          className="text-muted hover:text-fg w-4 h-4 flex items-center justify-center text-sm"
          title="Minimize"
        >
          &#8211;
        </button>
        <button
          onClick={() => window.api.window.close()}
          className="text-muted hover:text-fg w-4 h-4 flex items-center justify-center text-sm"
          title="Close"
        >
          &times;
        </button>
      </div>
    </div>
  );
}
