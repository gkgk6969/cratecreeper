import React, { useEffect, useRef, useState } from 'react';

export default function DropZone({ onImage }) {
  const fileRef = useRef(null);
  const [dragOver, setDragOver] = useState(false);

  useEffect(() => {
    function onPaste(e) {
      const items = Array.from(e.clipboardData?.items ?? []);
      const item = items.find((i) => i.type.startsWith('image/'));
      if (item) {
        const file = item.getAsFile();
        if (file) {
          readFile(file);
          return;
        }
      }
      window.api.clipboard.readImage().then((dataUrl) => {
        if (dataUrl) onImage(dataUrl);
      });
    }
    window.addEventListener('paste', onPaste);
    return () => window.removeEventListener('paste', onPaste);
  }, []);

  function readFile(file) {
    const reader = new FileReader();
    reader.onload = (ev) => onImage(ev.target.result);
    reader.readAsDataURL(file);
  }

  function onDrop(e) {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file && file.type.startsWith('image/')) readFile(file);
  }

  return (
    <div className="flex flex-col items-center justify-center h-full">
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={onDrop}
        onClick={() => fileRef.current?.click()}
        className={`flex flex-col items-center justify-center w-full h-72 border-2 border-dashed cursor-pointer transition-colors ${
          dragOver
            ? 'border-accent text-accent bg-accent/5'
            : 'border-border text-muted hover:border-accent hover:text-accent'
        }`}
      >
        <div className="text-3xl mb-2 leading-none">+</div>
        <div className="text-xs uppercase tracking-wider">drop screenshot</div>
        <div className="text-[10px] mt-2 opacity-50">or paste with cmd+v</div>
        <input
          type="file"
          accept="image/png,image/jpeg,image/webp"
          ref={fileRef}
          onChange={(e) => e.target.files?.[0] && readFile(e.target.files[0])}
          className="hidden"
        />
      </div>
      <div className="mt-4 text-[10px] text-muted text-center max-w-[280px] leading-relaxed">
        screenshot a tracklist (Spotify, YouTube, anywhere). I'll extract the
        tracks, open them on Beatport or Bandcamp, watch your downloads, and
        build a Rekordbox crate.
      </div>
    </div>
  );
}
