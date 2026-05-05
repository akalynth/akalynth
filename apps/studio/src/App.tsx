import { useEffect, useMemo, useState } from 'react';
import { TileCode, type MapData } from '@shared/types';
import { validateDraftId, validateMapData } from '@shared/map-validation';

interface MapEntry {
  id: string;
  name: string;
  readOnly: boolean;
  width: number;
  height: number;
  spawn: { x: number; y: number };
  active?: boolean;
}

interface StudioMapsResponse {
  maps: MapEntry[];
  activePlaytest: null | {
    id: string;
    name: string;
    readOnly: boolean;
    activatedAt: string;
  };
  lastStudioSmoke: null | StudioSmokeResult;
}

interface StudioSmokeResult {
  ok: boolean;
  ranAt: string;
  draftId: string;
  worldSpawn?: { x: number; y: number };
  canonicalUnchanged: boolean;
  details: string[];
  error?: string;
}

type Mode = 'paint' | 'spawn';

const SERVER_PORT = 3000;
const TILE_SIZE = 24;

const TILE_LABELS = [
  { code: TileCode.Grass, label: 'grass', color: '#245c2a' },
  { code: TileCode.Stone, label: 'stone', color: '#555d6d' },
  { code: TileCode.Wall, label: 'wall', color: '#141c29' },
  { code: TileCode.Water, label: 'water', color: '#145279' },
  { code: TileCode.Door, label: 'door', color: '#a77735' },
  { code: TileCode.TutorialMove, label: 'tutorial move', color: '#2c8a38' },
  { code: TileCode.TutorialChat, label: 'tutorial chat', color: '#267996' },
  { code: TileCode.TutorialTem, label: 'tutorial tem', color: '#8d2a55' },
  { code: TileCode.GateToAzura, label: 'gate', color: '#7644a8' },
];

function apiBase() {
  const configured = import.meta.env.VITE_STUDIO_API_BASE;
  if (configured) return configured.replace(/\/$/, '');
  return `${window.location.protocol}//${window.location.hostname}:${SERVER_PORT}`;
}

function cloneMap(map: MapData): MapData {
  return JSON.parse(JSON.stringify(map)) as MapData;
}

function mapTileColor(code: number) {
  return TILE_LABELS.find((tile) => tile.code === code)?.color ?? '#111827';
}

export function App() {
  const [baseUrl] = useState(apiBase);
  const [maps, setMaps] = useState<MapEntry[]>([]);
  const [selectedId, setSelectedId] = useState('Rookguard');
  const [sourceReadOnly, setSourceReadOnly] = useState(true);
  const [draftId, setDraftId] = useState('phone-test');
  const [map, setMap] = useState<MapData | null>(null);
  const [mode, setMode] = useState<Mode>('paint');
  const [tile, setTile] = useState<number>(TileCode.Grass);
  const [zoom, setZoom] = useState(1);
  const [message, setMessage] = useState('');
  const [painting, setPainting] = useState(false);
  const [activePlaytest, setActivePlaytest] = useState<StudioMapsResponse['activePlaytest']>(null);
  const [lastSmoke, setLastSmoke] = useState<StudioSmokeResult | null>(null);
  const [smokeRunning, setSmokeRunning] = useState(false);

  const validation = useMemo(() => {
    const errors = map ? [...validateMapData(map).errors] : ['No map loaded'];
    const idResult = validateDraftId(draftId);
    if (!idResult.ok) errors.push(...idResult.errors);
    return errors;
  }, [draftId, map]);

  async function loadList() {
    const response = await fetch(`${baseUrl}/v1/studio/maps`);
    const data = (await response.json()) as StudioMapsResponse;
    setMaps(data.maps);
    setActivePlaytest(data.activePlaytest);
    setLastSmoke(data.lastStudioSmoke);
  }

  async function loadMap(id: string) {
    const response = await fetch(`${baseUrl}/v1/studio/maps/${encodeURIComponent(id)}`);
    if (!response.ok) throw new Error(`Map load failed: ${response.status}`);
    const data = await response.json() as { id: string; map: MapData; readOnly: boolean };
    setSelectedId(data.id);
    setSourceReadOnly(data.readOnly);
    setMap(cloneMap(data.map));
    if (!data.readOnly) setDraftId(data.id);
    setMessage(data.readOnly ? 'Canonical maps are read-only. Save creates/updates a local draft.' : 'Draft loaded.');
  }

  useEffect(() => {
    void loadList().then(() => loadMap('Rookguard')).catch((error) => setMessage(String(error)));
  }, []);

  function editCell(index: number) {
    setMap((current) => {
      if (!current) return current;
      const x = index % current.width;
      const y = Math.floor(index / current.width);
      const next = cloneMap(current);
      if (mode === 'spawn') {
        next.spawn = { x, y };
      } else {
        next.tiles[index] = tile;
      }
      return next;
    });
  }

  async function saveDraft() {
    if (!map) return;
    const idResult = validateDraftId(draftId);
    if (!idResult.ok) {
      setMessage(idResult.errors.join('; '));
      return;
    }
    const mapResult = validateMapData(map);
    if (!mapResult.ok) {
      setMessage(mapResult.errors.join('; '));
      return;
    }
    const response = await fetch(`${baseUrl}/v1/studio/maps/${encodeURIComponent(draftId)}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(map),
    });
    if (!response.ok) {
      const body = await response.text();
      setMessage(`Save failed: ${body}`);
      return;
    }
    await loadList();
    setSelectedId(draftId);
    setSourceReadOnly(false);
    setMessage(`Saved draft ${draftId}`);
  }

  async function playtestDraft() {
    const id = sourceReadOnly ? draftId : selectedId;
    const idResult = validateDraftId(id);
    if (!idResult.ok) {
      setMessage('Playtest requires a saved draft ID.');
      return;
    }
    const response = await fetch(`${baseUrl}/v1/studio/playtest`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id }),
    });
    if (!response.ok) {
      const body = await response.text();
      setMessage(`Playtest failed: ${body}`);
      return;
    }
    await loadList();
    setMessage(`Playtest active: ${id}. Open the debug client to play.`);
  }

  async function runSmoke() {
    setSmokeRunning(true);
    setMessage('Running Studio smoke.');
    try {
      const response = await fetch(`${baseUrl}/v1/studio/smoke`, { method: 'POST' });
      const data = (await response.json()) as StudioSmokeResult;
      setLastSmoke(data);
      await loadList();
      setMessage(data.ok ? 'Studio smoke passed.' : `Studio smoke failed: ${data.error ?? 'unknown error'}`);
    } catch (error) {
      setMessage(`Studio smoke failed: ${String(error)}`);
    } finally {
      setSmokeRunning(false);
    }
  }

  const canonicalCount = maps.filter((entry) => entry.readOnly).length;
  const draftCount = maps.filter((entry) => !entry.readOnly).length;

  return (
    <main className="studio-shell">
      <header className="studio-top">
        <div>
          <h1>Akalynth Studio</h1>
          <p>Canonical maps are read-only. Save creates/updates a local draft.</p>
        </div>
        <a className="play-link" href={`${window.location.protocol}//${window.location.hostname}:5173/`}>Open Playtest</a>
      </header>

      <section className="controls">
        <label>
          Source map
          <select value={selectedId} onChange={(event) => void loadMap(event.target.value)}>
            {maps.map((entry) => (
              <option key={entry.id} value={entry.id}>
                {entry.id}{entry.readOnly ? ' (read-only)' : ' (draft)'}{entry.active ? ' active' : ''}
              </option>
            ))}
          </select>
        </label>
        <label>
          Draft ID
          <input value={draftId} onChange={(event) => setDraftId(event.target.value)} placeholder="phone-test" />
        </label>
        <div className="segmented">
          <button className={mode === 'paint' ? 'active' : ''} onClick={() => setMode('paint')}>Paint</button>
          <button className={mode === 'spawn' ? 'active' : ''} onClick={() => setMode('spawn')}>Spawn</button>
        </div>
        <div className="zoom-row">
          <button onClick={() => setZoom((value) => Math.max(0.5, value - 0.25))}>-</button>
          <span>{Math.round(zoom * 100)}%</span>
          <button onClick={() => setZoom((value) => Math.min(3, value + 0.25))}>+</button>
        </div>
      </section>

      <section className="palette" aria-label="tile palette">
        {TILE_LABELS.map((entry) => (
          <button
            key={entry.code}
            className={tile === entry.code ? 'tile-choice active' : 'tile-choice'}
            style={{ '--tile-color': entry.color } as React.CSSProperties}
            onClick={() => {
              setTile(entry.code);
              setMode('paint');
            }}
          >
            <span />
            {entry.label}
          </button>
        ))}
      </section>

      <section className="workspace">
        <div className="map-scroll">
          {map && (
            <div
              className="map-grid"
              style={{
                gridTemplateColumns: `repeat(${map.width}, ${TILE_SIZE}px)`,
                width: map.width * TILE_SIZE,
                transform: `scale(${zoom})`,
              }}
              onPointerLeave={() => setPainting(false)}
              onPointerUp={() => setPainting(false)}
            >
              {map.tiles.map((code, index) => {
                const x = index % map.width;
                const y = Math.floor(index / map.width);
                const isSpawn = map.spawn.x === x && map.spawn.y === y;
                return (
                  <button
                    key={index}
                    className={isSpawn ? 'map-cell spawn' : 'map-cell'}
                    style={{ background: mapTileColor(code) }}
                    onPointerDown={(event) => {
                      event.preventDefault();
                      setPainting(true);
                      editCell(index);
                    }}
                    onPointerEnter={() => {
                      if (painting) editCell(index);
                    }}
                    title={`${x},${y}`}
                  >
                    {isSpawn ? 'S' : ''}
                  </button>
                );
              })}
            </div>
          )}
        </div>

        <aside className="side-panel">
          <div className="button-row">
            <button onClick={() => void saveDraft()}>Save draft</button>
            <button onClick={() => void playtestDraft()}>Playtest draft</button>
          </div>
          <section className="proof-panel">
            <div className="proof-head">
              <h2>Smoke</h2>
              <button onClick={() => void runSmoke()} disabled={smokeRunning}>
                {smokeRunning ? 'Running' : 'Run smoke'}
              </button>
            </div>
            <dl className="proof-grid">
              <div>
                <dt>Active</dt>
                <dd>{activePlaytest ? activePlaytest.id : 'none'}</dd>
              </div>
              <div>
                <dt>Maps</dt>
                <dd>{canonicalCount} read-only / {draftCount} drafts</dd>
              </div>
              <div>
                <dt>Last</dt>
                <dd className={lastSmoke?.ok ? 'proof-pass' : lastSmoke ? 'proof-fail' : ''}>
                  {lastSmoke ? (lastSmoke.ok ? 'passed' : 'failed') : 'not run'}
                </dd>
              </div>
              <div>
                <dt>Time</dt>
                <dd>{lastSmoke ? new Date(lastSmoke.ranAt).toLocaleTimeString() : '-'}</dd>
              </div>
              <div>
                <dt>Draft</dt>
                <dd>{lastSmoke?.draftId ?? '-'}</dd>
              </div>
              <div>
                <dt>Spawn</dt>
                <dd>{lastSmoke?.worldSpawn ? `${lastSmoke.worldSpawn.x},${lastSmoke.worldSpawn.y}` : '-'}</dd>
              </div>
            </dl>
            {lastSmoke?.details.length ? <p className="proof-detail">{lastSmoke.details.join(' | ')}</p> : null}
            {lastSmoke?.error ? <p className="proof-error">{lastSmoke.error}</p> : null}
          </section>
          {message && <p className="message">{message}</p>}
          <h2>Validate</h2>
          <ul className={validation.length ? 'errors' : 'ok'}>
            {validation.length ? validation.map((error) => <li key={error}>{error}</li>) : <li>Map and draft ID are valid.</li>}
          </ul>
          <h2>JSON preview</h2>
          <textarea readOnly value={map ? JSON.stringify(map, null, 2) : ''} />
        </aside>
      </section>
    </main>
  );
}
