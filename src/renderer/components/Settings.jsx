import React, { useEffect, useState } from 'react';

export default function Settings({ onClose }) {
  const [settings, setSettings] = useState(null);

  useEffect(() => {
    window.api.settings.get().then(setSettings);
  }, []);

  async function update(key, value) {
    setSettings((s) => ({ ...s, [key]: value }));
    await window.api.settings.set(key, value);
  }

  async function pickFolder(key) {
    const folder = await window.api.settings.pickFolder();
    if (folder) update(key, folder);
  }

  if (!settings) return null;

  return (
    <div className="absolute inset-0 bg-bg overflow-y-auto" style={{ top: 36 }}>
      <div className="p-4 flex flex-col gap-4">
        <div className="flex justify-between items-center">
          <div className="text-accent text-sm uppercase tracking-wider">
            settings
          </div>
          <button
            onClick={onClose}
            className="text-muted hover:text-fg text-[10px] uppercase tracking-wider"
          >
            close
          </button>
        </div>

        <Field label="Anthropic API key (Claude OCR fallback)">
          <input
            type="password"
            value={settings.apiKey}
            onChange={(e) => update('apiKey', e.target.value)}
            placeholder="sk-ant-..."
            className="w-full bg-transparent border border-border p-2 text-xs outline-none focus:border-accent"
          />
        </Field>

        <Field label="Prefer local OCR (Apple Vision)">
          <button
            onClick={() => update('preferLocalOcr', !settings.preferLocalOcr)}
            className={`px-3 py-1 text-xs uppercase tracking-wider border w-fit ${
              settings.preferLocalOcr
                ? 'border-accent text-accent'
                : 'border-border text-muted'
            }`}
          >
            {settings.preferLocalOcr ? 'on' : 'off'}
          </button>
          <div className="text-[10px] text-muted mt-1">
            on: try Apple Vision first, Claude as fallback. off: always Claude.
          </div>
        </Field>

        <Field label="Downloads folder">
          <div className="flex gap-2">
            <input
              type="text"
              value={settings.downloadsPath}
              onChange={(e) => update('downloadsPath', e.target.value)}
              className="flex-1 bg-transparent border border-border p-2 text-xs outline-none focus:border-accent"
            />
            <button
              onClick={() => pickFolder('downloadsPath')}
              className="px-3 py-1 text-[10px] uppercase tracking-wider border border-border text-muted hover:text-accent hover:border-accent"
            >
              pick
            </button>
          </div>
        </Field>

        <Field label="XML output folder">
          <div className="flex gap-2">
            <input
              type="text"
              value={settings.xmlOutputPath}
              onChange={(e) => update('xmlOutputPath', e.target.value)}
              className="flex-1 bg-transparent border border-border p-2 text-xs outline-none focus:border-accent"
            />
            <button
              onClick={() => pickFolder('xmlOutputPath')}
              className="px-3 py-1 text-[10px] uppercase tracking-wider border border-border text-muted hover:text-accent hover:border-accent"
            >
              pick
            </button>
          </div>
        </Field>

        <Field label="Default store">
          <div className="flex gap-2">
            {['beatport', 'bandcamp'].map((s) => (
              <button
                key={s}
                onClick={() => update('defaultStore', s)}
                className={`flex-1 py-2 text-xs uppercase tracking-wider border ${
                  settings.defaultStore === s
                    ? 'border-accent text-accent'
                    : 'border-border text-muted'
                }`}
              >
                {s}
              </button>
            ))}
          </div>
        </Field>
      </div>
    </div>
  );
}

function Field({ label, children }) {
  return (
    <div className="flex flex-col gap-1">
      <label className="text-[10px] text-muted uppercase tracking-wider">
        {label}
      </label>
      {children}
    </div>
  );
}
