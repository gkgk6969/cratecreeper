import React, { useEffect, useState } from 'react';
import TitleBar from './components/TitleBar.jsx';
import DropZone from './components/DropZone.jsx';
import TrackList from './components/TrackList.jsx';
import StoreSelector from './components/StoreSelector.jsx';
import DownloadWatcher from './components/DownloadWatcher.jsx';
import CartProgress from './components/CartProgress.jsx';
import Settings from './components/Settings.jsx';

const STATES = {
  IDLE: 'idle',
  EXTRACTING: 'extracting',
  TRACKS: 'tracks',
  BROWSING: 'browsing',
  WATCHING: 'watching',
  NAMING: 'naming',
  DONE: 'done',
};

export default function App() {
  const [state, setState] = useState(STATES.IDLE);
  const [showSettings, setShowSettings] = useState(false);
  const [error, setError] = useState(null);
  const [tracks, setTracks] = useState([]);
  const [storeId, setStoreId] = useState('beatport');
  const [matchedTracks, setMatchedTracks] = useState([]);
  const [playlistName, setPlaylistName] = useState('');
  const [outputResult, setOutputResult] = useState(null);
  const [extractSource, setExtractSource] = useState(null);
  const [bridgeConnected, setBridgeConnected] = useState(false);

  useEffect(() => {
    window.api.settings.get().then((s) => {
      if (s.defaultStore) setStoreId(s.defaultStore);
    });
    window.api.bridge.getState().then((s) => setBridgeConnected(!!s.connected));
    const off = window.api.bridge.onConnection(({ connected }) =>
      setBridgeConnected(connected)
    );
    return () => off && off();
  }, []);

  async function handleImage(dataUrl) {
    setError(null);
    setState(STATES.EXTRACTING);
    try {
      const result = await window.api.ocr.extract(dataUrl);
      if (!result.tracks || result.tracks.length === 0) {
        throw new Error(
          "Couldn't read any tracks from this screenshot. Try a clearer image."
        );
      }
      setExtractSource(result.source);
      setTracks(result.tracks.map((t) => ({ ...t, selected: true })));
      setState(STATES.TRACKS);
    } catch (e) {
      setError(e.message || 'Extraction failed.');
      setState(STATES.IDLE);
    }
  }

  async function handleAutoAddViaExtension() {
    const selected = tracks.filter((t) => t.selected);
    if (selected.length === 0) return;
    setError(null);
    try {
      await window.api.bridge.setQueue(
        selected.map(({ artist, title }) => ({ artist, title }))
      );
      setState(STATES.BROWSING);
    } catch (e) {
      setError(e.message);
    }
  }

  async function handleOpenTabsManually() {
    const selected = tracks.filter((t) => t.selected);
    if (selected.length === 0) return;
    setError(null);
    try {
      await window.api.watcher.start(
        selected.map(({ artist, title }) => ({ artist, title }))
      );
      await window.api.stores.open(selected, storeId);
      setState(STATES.WATCHING);
    } catch (e) {
      setError(e.message);
    }
  }

  async function handleContinueFromBrowsing() {
    const selected = tracks.filter((t) => t.selected);
    try {
      await window.api.bridge.cancelQueue();
      await window.api.watcher.start(
        selected.map(({ artist, title }) => ({ artist, title }))
      );
      setState(STATES.WATCHING);
    } catch (e) {
      setError(e.message);
    }
  }

  function handleProceedToNaming(matched) {
    setMatchedTracks(matched);
    setState(STATES.NAMING);
  }

  async function handleGenerate() {
    setError(null);
    try {
      const result = await window.api.xml.generate(matchedTracks, playlistName);
      setOutputResult(result);
      await window.api.watcher.stop();
      setState(STATES.DONE);
    } catch (e) {
      setError(e.message || 'XML generation failed.');
    }
  }

  async function reset() {
    await window.api.watcher.stop();
    await window.api.bridge.cancelQueue();
    setTracks([]);
    setMatchedTracks([]);
    setPlaylistName('');
    setOutputResult(null);
    setError(null);
    setExtractSource(null);
    setState(STATES.IDLE);
  }

  const selectedCount = tracks.filter((t) => t.selected).length;

  return (
    <div className="flex flex-col h-full relative">
      <TitleBar onOpenSettings={() => setShowSettings(true)} />
      <div className="flex-1 overflow-y-auto p-4 flex flex-col">
        {error && (
          <div className="mb-3 p-2 border border-red-700/60 bg-red-900/10 text-red-400 text-[11px] leading-relaxed">
            {error}
          </div>
        )}

        {state === STATES.IDLE && (
          <div className="flex-1 flex">
            <DropZone onImage={handleImage} />
          </div>
        )}

        {state === STATES.EXTRACTING && (
          <div className="flex-1 flex flex-col items-center justify-center">
            <Spinner />
            <div className="mt-4 text-muted text-[11px] uppercase tracking-wider">
              reading tracks...
            </div>
          </div>
        )}

        {state === STATES.TRACKS && (
          <div className="flex flex-col gap-3">
            <TrackList tracks={tracks} onChange={setTracks} />
            {extractSource && (
              <div className="text-[10px] text-muted -mt-1">
                via {extractSource === 'apple' ? 'Apple Vision' : 'Claude'}
              </div>
            )}
            <StoreSelector storeId={storeId} onChange={setStoreId} />

            {bridgeConnected && storeId === 'beatport' ? (
              <button
                onClick={handleAutoAddViaExtension}
                disabled={selectedCount === 0}
                className="w-full py-2 bg-accent text-black font-bold uppercase text-xs tracking-wider disabled:opacity-30 disabled:bg-border disabled:text-muted disabled:cursor-not-allowed"
              >
                Auto-add to cart ({selectedCount})
              </button>
            ) : (
              <button
                onClick={handleOpenTabsManually}
                disabled={selectedCount === 0}
                className="w-full py-2 bg-accent text-black font-bold uppercase text-xs tracking-wider disabled:opacity-30 disabled:bg-border disabled:text-muted disabled:cursor-not-allowed"
              >
                Open in {storeId} ({selectedCount} tabs)
              </button>
            )}

            {bridgeConnected && storeId === 'beatport' && (
              <button
                onClick={handleOpenTabsManually}
                className="w-full py-1 text-muted hover:text-fg text-[10px] uppercase tracking-wider"
              >
                or open tabs manually
              </button>
            )}

            {!bridgeConnected && storeId === 'beatport' && (
              <div className="text-[10px] text-muted text-center -mt-1">
                install the bridge extension to auto-add to cart
              </div>
            )}

            <button
              onClick={reset}
              className="w-full py-1 text-muted hover:text-fg text-[10px] uppercase tracking-wider"
            >
              cancel
            </button>
          </div>
        )}

        {state === STATES.BROWSING && (
          <div className="flex-1 flex flex-col">
            <CartProgress
              tracks={tracks.filter((t) => t.selected)}
              onContinue={handleContinueFromBrowsing}
              onCancel={reset}
            />
          </div>
        )}

        {state === STATES.WATCHING && (
          <div className="flex-1 flex flex-col">
            <DownloadWatcher
              expected={tracks.filter((t) => t.selected)}
              onDone={handleProceedToNaming}
              onCancel={reset}
            />
          </div>
        )}

        {state === STATES.NAMING && (
          <div className="flex flex-col gap-3 flex-1 justify-center">
            <div className="text-[10px] text-muted uppercase tracking-wider">
              name this crate
            </div>
            <input
              type="text"
              value={playlistName}
              onChange={(e) => setPlaylistName(e.target.value)}
              placeholder={`CrateDig_${new Date()
                .toISOString()
                .slice(0, 10)
                .replace(/-/g, '')}`}
              className="bg-transparent border border-border p-2 text-fg outline-none focus:border-accent text-sm"
              autoFocus
            />
            <div className="text-[10px] text-muted">
              {matchedTracks.length} track{matchedTracks.length === 1 ? '' : 's'}{' '}
              ready to export
            </div>
            <button
              onClick={handleGenerate}
              className="py-2 bg-accent text-black font-bold uppercase text-xs tracking-wider"
            >
              Generate XML
            </button>
            <button
              onClick={reset}
              className="py-1 text-muted hover:text-fg text-[10px] uppercase tracking-wider"
            >
              cancel
            </button>
          </div>
        )}

        {state === STATES.DONE && outputResult && (
          <div className="flex flex-col gap-3 flex-1 justify-center text-center">
            <div className="text-accent text-2xl uppercase tracking-widest">
              done
            </div>
            <div className="text-fg font-bold">{outputResult.playlistName}</div>
            <div className="text-muted text-xs">
              {outputResult.count} track{outputResult.count === 1 ? '' : 's'}
            </div>
            <div className="text-muted text-[10px] break-all px-2">
              {outputResult.path}
            </div>
            <button
              onClick={() => window.api.shell.openInFinder(outputResult.path)}
              className="py-2 border border-accent text-accent uppercase text-xs tracking-wider hover:bg-accent/10"
            >
              Open in Finder
            </button>
            <div className="text-muted text-[10px] mt-2 leading-relaxed">
              Rekordbox &rarr; File &rarr; Import Playlist &rarr; select the XML
            </div>
            <button
              onClick={reset}
              className="py-2 bg-accent text-black font-bold uppercase text-xs tracking-wider mt-2"
            >
              New Screenshot
            </button>
          </div>
        )}
      </div>
      {showSettings && <Settings onClose={() => setShowSettings(false)} />}
    </div>
  );
}

function Spinner() {
  return (
    <div className="w-6 h-6 border-2 border-accent border-t-transparent rounded-full animate-spin" />
  );
}
