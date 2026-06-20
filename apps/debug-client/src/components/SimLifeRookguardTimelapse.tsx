import { useEffect, useMemo, useRef, useState } from 'react';
import type {
  SimLifeFrame,
  SimLifeRookguardGameplanStep,
  SimLifeSnapshotResponse,
  SimLifeSpeed,
} from '@shared/http';
import { loadConfig } from '../config';
import seedMapJson from '../../../../data/map-training/rookguard/rookguard.seed-map.json';
import assetRegisterJson from '../../../../data/map-training/rookguard/rookguard.asset-register.json';

interface TrainingObject {
  id: string;
  role: string;
  asset_id: string;
  x: number;
  y: number;
  footprint: [number, number];
}

interface SeedMap {
  lane: string;
  status: string;
  width: number;
  height: number;
  spawn: { x: number; y: number };
  tutorial_gate: { x: number; y: number };
  legend: Record<string, string>;
  layers: { ground: string[] };
  objects: TrainingObject[];
}

interface AssetDef {
  id: string;
  visual_atom: string;
  category: string;
  layer: 'ground' | 'object';
  blocks_training_path: boolean;
  description: string;
}

interface AssetRegister {
  lane: string;
  status: string;
  allowed_assets: AssetDef[];
}

interface TileInfo {
  x: number;
  y: number;
  symbol: string;
  groundAsset: AssetDef;
  objects: TrainingObject[];
  blocked: boolean;
}

interface VisualAnchor {
  minute: number;
  label: string;
  role: string;
  planIndex: number;
  fallback: { x: number; y: number };
  matchIntent?: string;
  visibleAction: string;
  receiptAction: string;
}

interface VisibleMarker {
  id: string;
  label: string;
  kind: 'player' | 'guide' | 'steward' | 'slime' | 'gate';
  x: number;
  y: number;
  muted?: boolean;
}

const seedMap = seedMapJson as unknown as SeedMap;
const assetRegister = assetRegisterJson as unknown as AssetRegister;

const ASSETS_BY_ID = new Map(assetRegister.allowed_assets.map((asset) => [asset.id, asset]));

const OBJECT_LABEL: Record<string, string> = {
  spawn: 'SP',
  first_instruction_sign: 'S1',
  direction_sign: 'QB',
  tutorial_gate: 'GT',
  chronicle_marker: 'CH',
  small_house: 'HS',
  cave_mouth: 'CV',
  training_dummy: 'TD',
  training_yard_fence: 'FN',
};

const VISUAL_ANCHORS: VisualAnchor[] = [
  {
    minute: 0,
    label: '00:00',
    role: 'spawn',
    planIndex: 0,
    fallback: seedMap.spawn,
    visibleAction: 'Player ghost appears at the Rookguard spawn and the first instruction sign is already in view.',
    receiptAction: 'presence_entered',
  },
  {
    minute: 5,
    label: '05:00',
    role: 'movement',
    planIndex: 0,
    fallback: { x: 5, y: 2 },
    matchIntent: 'complete_movement_lesson',
    visibleAction: 'Movement proof lands: the player ghost reaches the first server-authoritative tutorial point.',
    receiptAction: 'tutorial_step_complete',
  },
  {
    minute: 10,
    label: '10:00',
    role: 'chat',
    planIndex: 1,
    fallback: { x: 8, y: 2 },
    matchIntent: 'complete_chat_lesson',
    visibleAction: 'Chat proof is visible as a receipt tick before the Tem segment begins.',
    receiptAction: 'chat',
  },
  {
    minute: 15,
    label: '15:00',
    role: 'Tem',
    planIndex: 2,
    fallback: { x: 12, y: 2 },
    matchIntent: 'complete_tem_lesson',
    visibleAction: 'Tem proof closes: issued, answered, and completed without client-side authority.',
    receiptAction: 'tem_challenge_passed',
  },
  {
    minute: 20,
    label: '20:00',
    role: 'runestone',
    planIndex: 3,
    fallback: { x: 4, y: 4 },
    matchIntent: 'cast_rookguard_runestone',
    visibleAction: 'The harmless runestone beat is framed as flavor and receipt proof, not power.',
    receiptAction: 'runestone_cast',
  },
  {
    minute: 25,
    label: '25:00',
    role: 'training slime',
    planIndex: 5,
    fallback: { x: 14, y: 14 },
    matchIntent: 'defeat_training_slime',
    visibleAction: 'Training slime practice becomes visible in the yard before Codex vocation and gate proof.',
    receiptAction: 'mob_kill',
  },
  {
    minute: 30,
    label: '30:00',
    role: 'gate',
    planIndex: 5,
    fallback: seedMap.tutorial_gate,
    matchIntent: 'complete_rookguard',
    visibleAction: 'The gate marker closes the route: training, vocation, and tutorial receipts are enough to leave.',
    receiptAction: 'tutorial_completed',
  },
];

function key(x: number, y: number): string {
  return `${x},${y}`;
}

function shortHash(value: string | undefined): string {
  return value ? `${value.slice(0, 10)}...${value.slice(-6)}` : 'pending';
}

function formatMinute(minute: number): string {
  const totalSeconds = Math.round(minute * 60);
  const mm = Math.floor(totalSeconds / 60).toString().padStart(2, '0');
  const ss = (totalSeconds % 60).toString().padStart(2, '0');
  return `${mm}:${ss}`;
}

function buildObjectCells(objects: TrainingObject[]): Map<string, TrainingObject[]> {
  const cells = new Map<string, TrainingObject[]>();
  for (const obj of objects) {
    const [width, height] = obj.footprint;
    for (let dy = 0; dy < height; dy += 1) {
      for (let dx = 0; dx < width; dx += 1) {
        const cellKey = key(obj.x + dx, obj.y + dy);
        const list = cells.get(cellKey) ?? [];
        list.push(obj);
        cells.set(cellKey, list);
      }
    }
  }
  return cells;
}

const OBJECTS_BY_CELL = buildObjectCells(seedMap.objects);

function buildTiles(): TileInfo[] {
  const tiles: TileInfo[] = [];
  for (let y = 0; y < seedMap.height; y += 1) {
    const row = seedMap.layers.ground[y];
    for (let x = 0; x < seedMap.width; x += 1) {
      const symbol = row[x];
      const assetId = seedMap.legend[symbol];
      const groundAsset = ASSETS_BY_ID.get(assetId);
      if (!groundAsset) continue;
      const objects = OBJECTS_BY_CELL.get(key(x, y)) ?? [];
      const blocked = groundAsset.blocks_training_path || objects.some((obj) => ASSETS_BY_ID.get(obj.asset_id)?.blocks_training_path);
      tiles.push({ x, y, symbol, groundAsset, objects, blocked });
    }
  }
  return tiles;
}

const TRAINING_TILES = buildTiles();

function frameAtOrBefore(frames: SimLifeFrame[], elapsedMs: number): SimLifeFrame | null {
  let active: SimLifeFrame | null = null;
  for (const frame of frames) {
    if (frame.elapsed_ms <= elapsedMs && (!active || frame.elapsed_ms >= active.elapsed_ms)) {
      active = frame;
    }
  }
  return active;
}

function frameForAnchor(frames: SimLifeFrame[], anchor: VisualAnchor): SimLifeFrame | null {
  if (anchor.matchIntent) {
    const matching = frames.find((frame) => frame.intent === anchor.matchIntent);
    if (matching) return matching;
  }
  return frameAtOrBefore(frames, anchor.minute * 60_000);
}

function planStepForMinute(
  plan: SimLifeRookguardGameplanStep[],
  minute: number,
): SimLifeRookguardGameplanStep | null {
  return plan.find((step) => minute >= step.from_minute && (minute < step.to_minute || (minute === 30 && step.to_minute === 30))) ?? null;
}

function latestAgentFrame(frames: SimLifeFrame[], agentId: string, elapsedMs: number): SimLifeFrame | null {
  return frameAtOrBefore(frames.filter((frame) => frame.agent_id === agentId), elapsedMs);
}

function useSimLifeSnapshot() {
  const config = useMemo(() => loadConfig(), []);
  const [snapshot, setSnapshot] = useState<SimLifeSnapshotResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setError(null);
    fetch(`${config.httpBase}/v1/sim/snapshot`, { signal: controller.signal })
      .then(async (res) => {
        const body = await res.json();
        if (!res.ok || !body?.ok) throw new Error(body?.error ?? `HTTP ${res.status}`);
        setSnapshot(body as SimLifeSnapshotResponse);
      })
      .catch((err: unknown) => {
        if ((err as Error).name === 'AbortError') return;
        setError(err instanceof Error ? err.message : String(err));
      })
      .finally(() => setLoading(false));
    return () => controller.abort();
  }, [config.httpBase]);

  return { snapshot, loading, error, httpBase: config.httpBase };
}

function markersForMinute(frames: SimLifeFrame[], minute: number): VisibleMarker[] {
  const elapsedMs = minute * 60_000;
  const newcomer = latestAgentFrame(frames, 'sim:rookguard:newcomer:1', elapsedMs);
  const guide = latestAgentFrame(frames, 'sim:rookguard:guide:1', elapsedMs);
  const playerPos = newcomer ? { x: newcomer.x, y: newcomer.y } : seedMap.spawn;
  const guidePos = guide ? { x: guide.x, y: guide.y } : { x: 7, y: 15 };

  return [
    { id: 'player-ghost', label: 'PG', kind: 'player', ...playerPos },
    { id: 'guide', label: 'GD', kind: 'guide', ...guidePos, muted: minute < 15 },
    { id: 'steward', label: 'ST', kind: 'steward', x: 15, y: 4, muted: minute < 24 },
    { id: 'training-slime', label: 'SL', kind: 'slime', x: 14, y: 14, muted: minute < 25 },
    { id: 'gate', label: 'GT', kind: 'gate', x: seedMap.tutorial_gate.x, y: seedMap.tutorial_gate.y, muted: minute < 28 },
  ];
}

function groupMarkersByCell(markers: VisibleMarker[]): Map<string, VisibleMarker[]> {
  const grouped = new Map<string, VisibleMarker[]>();
  for (const marker of markers) {
    const cellKey = key(marker.x, marker.y);
    const list = grouped.get(cellKey) ?? [];
    list.push(marker);
    grouped.set(cellKey, list);
  }
  return grouped;
}

export function SimLifeRookguardTimelapse() {
  const { snapshot, loading, error, httpBase } = useSimLifeSnapshot();
  const [minute, setMinute] = useState(0);
  const [speed, setSpeed] = useState<SimLifeSpeed>(0);
  const [selectedCell, setSelectedCell] = useState<TileInfo | null>(() => TRAINING_TILES.find((tile) => tile.x === seedMap.spawn.x && tile.y === seedMap.spawn.y) ?? null);
  const lastTickRef = useRef<number | null>(null);

  const rookguardFrames = useMemo(
    () => (snapshot?.timeline ?? []).filter((frame) => frame.map === 'Rookguard').sort((a, b) => a.elapsed_ms - b.elapsed_ms),
    [snapshot?.timeline],
  );

  const anchor = VISUAL_ANCHORS.find((item) => Math.abs(item.minute - minute) < 0.001) ?? null;
  const activeFrame = anchor ? frameForAnchor(rookguardFrames, anchor) : frameAtOrBefore(rookguardFrames, minute * 60_000);
  const activePlan = snapshot?.rookguard_0_30_gameplan
    ? anchor
      ? snapshot.rookguard_0_30_gameplan[anchor.planIndex] ?? null
      : planStepForMinute(snapshot.rookguard_0_30_gameplan, minute)
    : null;
  const activeVisualAction = anchor?.visibleAction ?? activeFrame?.label ?? 'Spawn frame waiting for simulated receipts.';
  const activeReceiptAction = anchor?.receiptAction ?? activeFrame?.receipt.action ?? activePlan?.receipt_actions[0] ?? 'pending';
  const markersByCell = groupMarkersByCell(markersForMinute(rookguardFrames, minute));

  useEffect(() => {
    if (speed === 0) {
      lastTickRef.current = null;
      return undefined;
    }
    const id = window.setInterval(() => {
      const now = performance.now();
      const last = lastTickRef.current ?? now;
      lastTickRef.current = now;
      const deltaMinutes = ((now - last) * speed) / 60_000;
      setMinute((current) => {
        const next = current + deltaMinutes;
        if (next >= 30) {
          setSpeed(0);
          return 30;
        }
        return next;
      });
    }, 200);
    return () => window.clearInterval(id);
  }, [speed]);

  const statusLabel = loading ? 'loading snapshot' : error ? 'snapshot offline' : snapshot?.mode ?? 'ready';
  const mapSummary = snapshot?.maps.find((map) => map.name === 'Rookguard');

  return (
    <div className="sim-life-shell">
      <header className="sim-life-header">
        <div>
          <span className="sim-life-eyebrow">AKALYNTH_SIM_VISIBLE_ROOKGUARD_TIMELAPSE_V1</span>
          <h1>Rookguard Sim Life Timelapse</h1>
        </div>
        <div className="sim-life-header__meta">
          <span>{statusLabel}</span>
          <strong>training-only visual lane</strong>
        </div>
      </header>

      <main className="sim-life-main">
        <section className="sim-life-map-panel" aria-label="Rookguard 32x32 training map timelapse">
          <div className="sim-life-toolbar">
            <div>
              <strong>{formatMinute(minute)}</strong>
              <span>{anchor?.role ?? activePlan?.title ?? 'timeline scrub'}</span>
            </div>
            <div className="sim-life-speed" aria-label="Sim speed controls">
              {([0, 1, 10, 100] as SimLifeSpeed[]).map((value) => (
                <button
                  key={value}
                  type="button"
                  className={speed === value ? 'is-active' : ''}
                  onClick={() => setSpeed(value)}
                  aria-label={value === 0 ? 'Pause timelapse' : `Play timelapse at ${value}x`}
                >
                  {value === 0 ? 'pause' : `${value}x`}
                </button>
              ))}
            </div>
          </div>

          <div className="sim-life-map-wrap">
            <div
              className="sim-life-map"
              style={{ gridTemplateColumns: `repeat(${seedMap.width}, minmax(0, 1fr))` }}
              data-training-status={seedMap.status}
            >
              {TRAINING_TILES.map((tile) => {
                const object = tile.objects[0];
                const cellMarkers = markersByCell.get(key(tile.x, tile.y)) ?? [];
                const selected = selectedCell?.x === tile.x && selectedCell.y === tile.y;
                return (
                  <button
                    key={key(tile.x, tile.y)}
                    type="button"
                    className={[
                      'sim-life-tile',
                      `sim-life-tile--${tile.symbol}`,
                      tile.blocked ? 'sim-life-tile--blocked' : '',
                      selected ? 'is-selected' : '',
                    ].filter(Boolean).join(' ')}
                    title={`${tile.x},${tile.y} ${tile.groundAsset.id}${object ? ` ${object.asset_id}` : ''}`}
                    onClick={() => setSelectedCell(tile)}
                  >
                    {object && (
                      <span className={`sim-life-object sim-life-object--${object.role}`} aria-label={`${object.role} ${object.asset_id}`}>
                        {OBJECT_LABEL[object.role] ?? 'OB'}
                      </span>
                    )}
                    {cellMarkers.map((marker) => (
                      <span
                        key={marker.id}
                        className={`sim-life-agent sim-life-agent--${marker.kind}${marker.muted ? ' is-muted' : ''}`}
                        aria-label={marker.id}
                      >
                        {marker.label}
                      </span>
                    ))}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="sim-life-scrubber">
            <input
              type="range"
              min={0}
              max={30}
              step={0.25}
              value={minute}
              onChange={(event) => {
                setSpeed(0);
                setMinute(Number(event.currentTarget.value));
              }}
              aria-label="Rookguard 0 to 30 minute timelapse scrubber"
            />
            <div className="sim-life-milestones" aria-label="Rookguard 0-30 minute visual frames">
              {VISUAL_ANCHORS.map((item) => (
                <button
                  key={item.minute}
                  type="button"
                  className={Math.abs(item.minute - minute) < 0.001 ? 'is-active' : ''}
                  onClick={() => {
                    setSpeed(0);
                    setMinute(item.minute);
                  }}
                >
                  <span>{item.label}</span>
                  <strong>{item.role}</strong>
                </button>
              ))}
            </div>
            <div className="sim-life-receipt-rail" aria-label="Receipt ticks">
              {rookguardFrames.map((frame) => (
                <button
                  key={`${frame.frame}-${frame.receipt.event_hash}`}
                  type="button"
                  className={activeFrame?.frame === frame.frame ? 'is-active' : ''}
                  style={{ left: `${Math.min(100, (frame.elapsed_ms / (30 * 60_000)) * 100)}%` }}
                  title={`${formatMinute(frame.elapsed_ms / 60_000)} ${frame.receipt.action}: ${frame.label}`}
                  onClick={() => {
                    setSpeed(0);
                    setMinute(Math.min(30, frame.elapsed_ms / 60_000));
                  }}
                />
              ))}
            </div>
          </div>
        </section>

        <aside className="sim-life-side">
          <section className="sim-life-panel sim-life-panel--proof">
            <h2>Frame Proof</h2>
            <dl>
              <dt>visible action</dt>
              <dd>{activeVisualAction}</dd>
              <dt>server state touched</dt>
              <dd>{activePlan?.server_state_touched.join(', ') ?? 'waiting for sim snapshot'}</dd>
              <dt>receipt action</dt>
              <dd>{activeReceiptAction}</dd>
              <dt>receipt hash</dt>
              <dd>{shortHash(activeFrame?.receipt.event_hash)}</dd>
            </dl>
          </section>

          <section className="sim-life-panel">
            <h2>Selected Tile</h2>
            {selectedCell ? (
              <dl>
                <dt>xy</dt>
                <dd>{selectedCell.x},{selectedCell.y}</dd>
                <dt>ground asset</dt>
                <dd>{selectedCell.groundAsset.id}</dd>
                <dt>object asset</dt>
                <dd>{selectedCell.objects.map((obj) => obj.asset_id).join(', ') || 'none'}</dd>
                <dt>blocked</dt>
                <dd>{selectedCell.blocked ? 'yes' : 'no'}</dd>
              </dl>
            ) : (
              <p>Pick a tile to inspect asset IDs.</p>
            )}
          </section>

          <section className="sim-life-panel">
            <h2>Map Register</h2>
            <div className="sim-life-register">
              {assetRegister.allowed_assets.map((asset) => (
                <div key={asset.id} className="sim-life-register__row">
                  <span className={`sim-life-swatch sim-life-swatch--${asset.category}`} />
                  <strong>{asset.category}</strong>
                  <code>{asset.id}</code>
                  <em>{asset.blocks_training_path ? 'blocked' : 'walkable'}</em>
                </div>
              ))}
            </div>
          </section>

          <section className="sim-life-panel">
            <h2>0-30 Plan</h2>
            <div className="sim-life-plan">
              {(snapshot?.rookguard_0_30_gameplan ?? []).map((step) => {
                const active = activePlan === step;
                return (
                  <button
                    key={`${step.from_minute}-${step.to_minute}`}
                    type="button"
                    className={active ? 'is-active' : ''}
                    onClick={() => {
                      setSpeed(0);
                      setMinute(step.from_minute);
                    }}
                  >
                    <span>{step.from_minute}-{step.to_minute}m</span>
                    <strong>{step.title}</strong>
                    <small>{step.receipt_actions.join(', ')}</small>
                  </button>
                );
              })}
              {!snapshot && <p>Snapshot source: {httpBase}/v1/sim/snapshot{error ? ` (${error})` : ''}</p>}
            </div>
          </section>

          <section className="sim-life-panel sim-life-panel--boundary">
            <h2>Boundary</h2>
            <p>
              Display-only training lane. Uses simulated receipts, the source training map bundle,
              and shared snapshot types. It does not mutate gameplay state.
            </p>
            <p>
              Rookguard source: {mapSummary ? `${mapSummary.width}x${mapSummary.height}` : `${seedMap.width}x${seedMap.height}`} training map,
              spawn {seedMap.spawn.x},{seedMap.spawn.y}, gate {seedMap.tutorial_gate.x},{seedMap.tutorial_gate.y}.
            </p>
          </section>
        </aside>
      </main>
    </div>
  );
}
