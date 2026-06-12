import { useCallback, useEffect, useMemo, useState } from 'react';
import type { MapName } from '@shared/http';
import { displayMapName } from '@shared/http';
import type { ChronicleEvent } from '@shared/protocol';
import type { MapData, PlayerPublic } from '@shared/types';
import { useGameClient } from './hooks/useGameClient';
import { useExistenceMode } from './hooks/useExistenceMode';
import { MapCanvas } from './components/MapCanvas';
import { DPad } from './components/DPad';
import { ActionsPanel } from './components/ActionsPanel';
import { PropertyLedger } from './components/PropertyLedger';
import { ChatSheet } from './components/ChatSheet';
import { TopBar } from './components/TopBar';
import { NearbyList } from './components/NearbyList';
import { ExistenceShell } from './components/ExistenceShell';
import { VisualSmokeReview } from './components/VisualSmokeReview';
import { CharacterBar } from './components/CharacterBar';
import { BackpackSheet } from './components/BackpackSheet';
import { ProofSheet } from './components/ProofSheet';
import { loadConfig } from './config';
import { highCityVisualLandmarksForMap } from './data/highCityVisualLandmarks';
import type {
  AccountSessionStatus,
  CharacterCatalog,
  CharacterCreateInput,
  ConnectionState,
  SessionInfo,
  UiStage,
} from './types';

type ChronicleGroup = { day: string; items: ChronicleEvent[] };

interface StudioProofState {
  activeId: string | null;
  lastSmoke: null | {
    ok: boolean;
    ranAt: string;
    draftId: string;
    worldSpawn?: { x: number; y: number };
    canonicalUnchanged: boolean;
    details: string[];
    error?: string;
  };
}

function dayKey(iso: string): string {
  const ms = Date.parse(iso);
  if (!Number.isFinite(ms)) return 'Unknown';
  const d = new Date(ms);
  return d.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
}

function groupChronicleByDay(events: ChronicleEvent[]): ChronicleGroup[] {
  const buckets = new Map<string, ChronicleEvent[]>();
  for (const ev of events) {
    const key = dayKey(ev.timestamp);
    const list = buckets.get(key) ?? [];
    list.push(ev);
    buckets.set(key, list);
  }

  for (const list of buckets.values()) {
    list.sort((a, b) => Date.parse(b.timestamp) - Date.parse(a.timestamp));
  }

  return Array.from(buckets.entries())
    .map(([day, items]) => ({ day, items }))
    .sort((a, b) => Date.parse(b.items[0]?.timestamp ?? '0') - Date.parse(a.items[0]?.timestamp ?? '0'));
}

type ChronicleRender = { icon: string; text: string };

type LandmarkBox = { x: number; y: number; width: number; height: number };

function landmarkBox(value: unknown): LandmarkBox | null {
  if (!value || typeof value !== 'object') return null;
  const raw = value as Record<string, unknown>;
  const x = typeof raw.x === 'number' ? raw.x : null;
  const y = typeof raw.y === 'number' ? raw.y : null;
  if (x === null || y === null) return null;
  return {
    x,
    y,
    width: typeof raw.width === 'number' ? raw.width : 1,
    height: typeof raw.height === 'number' ? raw.height : 1,
  };
}

function isNearLandmark(player: PlayerPublic | null, map: MapData, key: string, radius = 1): boolean {
  if (!player) return false;
  const mark = landmarkBox((map.landmarks as Record<string, unknown>)[key]);
  if (!mark) return false;
  const minX = mark.x - radius;
  const maxX = mark.x + mark.width - 1 + radius;
  const minY = mark.y - radius;
  const maxY = mark.y + mark.height - 1 + radius;
  return player.x >= minX && player.x <= maxX && player.y >= minY && player.y <= maxY;
}

const NPC_DEFS = [
  { npc_id: 'rookguard_guide', place_id: 'rookguard', label: 'Guide' },
  { npc_id: 'azura_herald',   place_id: 'azura:plaza',      label: 'Herald' },
  { npc_id: 'azura_steward',  place_id: 'azura:guild_hall', label: 'Steward' },
] as const;

function isInPlace(player: PlayerPublic | null, map: MapData, mapName: string, placeId: string): boolean {
  if (!player) return false;
  const colonIdx = placeId.indexOf(':');
  const mapPart = colonIdx === -1 ? placeId : placeId.slice(0, colonIdx);
  const subPlace = colonIdx === -1 ? null : placeId.slice(colonIdx + 1);
  if (mapName.toLowerCase() !== mapPart) return false;
  if (!subPlace) return true;
  const lm = (map.landmarks as Record<string, unknown>)[subPlace];
  const box = landmarkBox(lm);
  if (!box) return false;
  return player.x >= box.x && player.x < box.x + box.width &&
         player.y >= box.y && player.y < box.y + box.height;
}

function renderChronicleEvent(ev: ChronicleEvent): ChronicleRender {
  const details = (ev.details ?? {}) as Record<string, unknown>;
  switch (ev.kind) {
    case 'death':
      return {
        icon: '☠',
        text: `Died at ${ev.zone ?? 'Unknown'} (${ev.x ?? '?'}, ${ev.y ?? '?'})`,
      };
    case 'item_pickup':
      return { icon: '📦', text: `Picked up ${String(details.item_type ?? 'item')}` };
    case 'zone_enter':
      return { icon: '🏛', text: `Entered ${ev.zone ?? 'Unknown'}` };
    case 'combat_kill':
      return {
        icon: '⚔',
        text: `Killed ${String(details.target_name ?? details.target_id ?? 'target')}`,
      };
    case 'tutorial_complete':
      return { icon: '🎓', text: 'Completed tutorial' };
    case 'character_created':
      return { icon: '✨', text: 'Character created' };
    case 'item_lost':
      return { icon: '—', text: '' };
    default:
      return { icon: '•', text: String(ev.kind) };
  }
}

function useNow(interval = 200) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const t = window.setInterval(() => setNow(Date.now()), interval);
    return () => window.clearInterval(t);
  }, [interval]);
  return now;
}

function useMediaQuery(query: string): boolean {
  const read = useCallback(() => window.matchMedia(query).matches, [query]);
  const [matches, setMatches] = useState(read);

  useEffect(() => {
    const media = window.matchMedia(query);
    const update = () => setMatches(media.matches);
    update();
    media.addEventListener('change', update);
    return () => media.removeEventListener('change', update);
  }, [query]);

  return matches;
}

function useViewportSize() {
  const read = useCallback(() => ({
    width: window.innerWidth,
    height: window.innerHeight,
  }), []);
  const [size, setSize] = useState(read);

  useEffect(() => {
    const update = () => setSize(read());
    window.addEventListener('resize', update);
    window.addEventListener('orientationchange', update);
    return () => {
      window.removeEventListener('resize', update);
      window.removeEventListener('orientationchange', update);
    };
  }, [read]);

  return size;
}

type LockableScreenOrientation = ScreenOrientation & {
  lock?: (orientation: 'landscape') => Promise<void>;
};

async function requestLandscapeMode() {
  try {
    if (!document.fullscreenElement && document.documentElement.requestFullscreen) {
      await document.documentElement.requestFullscreen({ navigationUI: 'hide' });
    }
  } catch (error) {
    console.log('[debug-client] fullscreen request unavailable', error);
  }

  try {
    const orientation = screen.orientation as LockableScreenOrientation | undefined;
    await orientation?.lock?.('landscape');
  } catch (error) {
    console.log('[debug-client] landscape lock unavailable', error);
  }
}

function MobileLandscapeGate() {
  return (
    <div className="mobile-rotate-gate" role="dialog" aria-modal="true" aria-label="Landscape required">
      <div className="mobile-rotate-panel">
        <div className="mobile-rotate-icon" aria-hidden="true" />
        <div className="mobile-rotate-title">Landscape required</div>
        <div className="mobile-rotate-copy">Turn the phone sideways for the play surface.</div>
        <button type="button" className="mobile-rotate-button" onClick={() => void requestLandscapeMode()}>
          Enter landscape
        </button>
      </div>
    </div>
  );
}

interface MobilePlayEntryProps {
  session: SessionInfo;
  stage: UiStage['stage'];
  conn: ConnectionState;
  hasWorldPlayer: boolean;
  characterCatalog: CharacterCatalog;
  accountSession: AccountSessionStatus;
  onCreate: (input: CharacterCreateInput) => Promise<{ ok: boolean; error?: string }>;
  onRefreshAccountSession: () => Promise<AccountSessionStatus>;
  onSignOut: () => void;
  onEnterPlay: () => void;
}

function MobilePlayEntry({
  session,
  stage,
  conn,
  hasWorldPlayer,
  characterCatalog,
  accountSession,
  onCreate,
  onRefreshAccountSession,
  onSignOut,
  onEnterPlay,
}: MobilePlayEntryProps) {
  const entryState =
    !hasWorldPlayer ? 'Waiting for world' :
    stage < 1 ? 'Ready to enter' :
    'Ready';

  return (
    <div className="mobile-play-entry" role="region" aria-label="Mobile play entry">
      <div className="mobile-play-entry__header">
        <span>Akalynth</span>
        <strong>{entryState}</strong>
        <i>{conn.phase}</i>
      </div>
      <CharacterBar
        session={session}
        catalog={characterCatalog}
        accountSession={accountSession}
        onCreate={onCreate}
        onRefreshAccountSession={onRefreshAccountSession}
        onSignOut={onSignOut}
      />
      {stage < 1 && (
        <button
          type="button"
          className="mobile-enter-play-btn"
          onClick={onEnterPlay}
          disabled={!hasWorldPlayer}
          aria-label={hasWorldPlayer ? 'Enter play mode' : 'Waiting for world before entering play'}
        >
          {hasWorldPlayer ? 'Enter play' : 'Waiting'}
        </button>
      )}
    </div>
  );
}

interface MobileStatusRailProps {
  name: string | null;
  position: string;
  health: string;
  conn: ConnectionState;
}

function MobileStatusRail({ name, position, health, conn }: MobileStatusRailProps) {
  return (
    <div className="mobile-status-rail" aria-label="Mobile player status">
      <span>{name ?? 'Guest'}</span>
      <strong>{health}</strong>
      <span>{position}</span>
      <i>{conn.phase}</i>
    </div>
  );
}

export default function App() {
  // Hooks must run unconditionally and in a stable order, so call them before any
  // early return (rules of hooks).
  const existenceMode = useExistenceMode();

  const params = new URLSearchParams(window.location.search);
  if (params.has('visual-smoke')) {
    return <VisualSmokeReview />;
  }

  // Existence mode: minimal truth viewer
  if (existenceMode) {
    return <ExistenceShell />;
  }

  // Full debug client
  return <DebugApp />;
}

function DebugApp() {
  const config = useMemo(() => loadConfig(), []);
  const initialMap: MapName = config.defaultMap;
  const studioProofEnabled = import.meta.env.VITE_ENABLE_STUDIO_PROOF === '1';
  const phoneLandscape = useMediaQuery('(max-width: 950px) and (orientation: landscape)');
  const viewport = useViewportSize();
  const [state, api] = useGameClient(initialMap);
  const [chatOpen, setChatOpen] = useState(false);
  const [inventoryOpen, setInventoryOpen] = useState(false);
  const [proofSheetOpen, setProofSheetOpen] = useState(false);
  const [proof, setProof] = useState<StudioProofState | null>(null);
  const [proofRunning, setProofRunning] = useState(false);
  const [proofError, setProofError] = useState<string | null>(null);
  const [deathModalOpen, setDeathModalOpen] = useState(false);
  const now = useNow();
  const toast = state.toast && now < state.toast.expiresAt ? state.toast : null;
  const activePlaytestLabel = proof?.activeId ?? 'canonical';
  const currentMapName = state.world.map.name;
  const currentMapDisplayName = displayMapName(currentMapName);
  const objectiveLabel =
    state.loop?.objective ?? (currentMapDisplayName === 'High City' ? 'Arrive in High City' : 'Enter Rookguard');
  const meHp = state.world.me?.hp;
  const meMaxHp = state.world.me?.max_hp;
  const healthLabel =
    state.world.me?.status === 'dead'
      ? 'Down'
      : typeof meHp === 'number' && typeof meMaxHp === 'number'
        ? `${meHp}/${meMaxHp}`
        : 'Alive';
  const healthPct =
    typeof meHp === 'number' && typeof meMaxHp === 'number' && meMaxHp > 0
      ? Math.max(0, Math.min(100, Math.round((meHp / meMaxHp) * 100)))
      : 100;
  const isDead = state.world.me?.status === 'dead';
  const playerPositionLabel = state.world.me ? `${state.world.me.x},${state.world.me.y}` : '--';
  const showMobilePlayEntry = phoneLandscape && (state.ui.stage < 1 || !state.world.me);
  // Latch a blocking death popup; only the player dismisses it by signing back in.
  useEffect(() => {
    if (isDead) setDeathModalOpen(true);
  }, [isDead]);
  const smokeState = proof?.lastSmoke?.ok ? 'pass' : proof?.lastSmoke ? 'fail' : proofError ? 'offline' : 'idle';
  const smokeLabel =
    smokeState === 'pass' ? 'passed' :
    smokeState === 'fail' ? 'failed' :
    smokeState === 'offline' ? 'offline' :
    'ready';
  const mobileViewport = useMemo(() => {
    if (!phoneLandscape) return undefined;
    return {
      width: Math.max(640, Math.round(viewport.width)),
      height: Math.max(320, Math.round(viewport.height)),
    };
  }, [phoneLandscape, viewport.height, viewport.width]);

  const hasAutoTarget = useMemo(() => {
    if (!state.world.me) return false;
    for (const p of state.world.others.values()) {
      if (p.status !== 'dead') return true;
    }
    return false;
  }, [state.world.me, state.world.others]);

  const attackReady =
    !!state.world.me &&
    now >= state.cooldowns.attackEndsAt &&
    (state.combat.targetId ? true : hasAutoTarget);
  const ritualReady = isNearLandmark(state.world.me, state.world.map, 'runestone_table');
  const ritualHint = ritualReady ? 'Runestone nearby' : 'No runestone nearby';
  const nearLegendStone = isNearLandmark(state.world.me, state.world.map, 'legend_stone', 2);
  const nearbyNpc = NPC_DEFS.find(n =>
    isInPlace(state.world.me, state.world.map, currentMapName, n.place_id)
  ) ?? null;
  const groundItemHere = useMemo(() => {
    if (!state.world.me) return null;
    const { x, y } = state.world.me;
    for (const item of state.groundItems.values()) {
      if (item.x === x && item.y === y) return item;
    }
    return null;
  }, [state.world.me, state.groundItems]);
  const others = useMemo(() => Array.from(state.world.others.values()), [state.world.others]);
  const propertyList = useMemo(() => Array.from(state.properties.values()), [state.properties]);
  const propertyByPlot = useMemo(() => {
    const m = new Map<string, { status: string; owner_name: string | null; listed_price_gold: number | null }>();
    for (const p of propertyList) {
      m.set(p.plot_id, { status: p.status, owner_name: p.owner_name, listed_price_gold: p.listed_price_gold });
    }
    return m;
  }, [propertyList]);
  const worldVisualObjects = useMemo(
    () => highCityVisualLandmarksForMap(state.world.map.name as MapName),
    [state.world.map.name]
  );
  const roster = useMemo(() => others.slice().sort((a, b) => a.name.localeCompare(b.name)), [others]);
  const targetName = useMemo(() => {
    if (!state.combat.targetId) return null;
    return state.world.others.get(state.combat.targetId)?.name ?? null;
  }, [state.combat.targetId, state.world.others]);

  const chronicleGroups = useMemo(() => {
    const events = state.chronicle?.events ?? [];
    const visible = events.filter((ev) => ev.kind !== 'item_lost');
    return groupChronicleByDay(visible);
  }, [state.chronicle?.events]);

  const recap = state.deathRecap;
  const recapEvent = recap?.deathEvent;
  const recapDetails = recapEvent?.details as Record<string, unknown> | undefined;
  const attackerId = typeof recapDetails?.attacker_id === 'string' ? recapDetails.attacker_id : null;
  const killerLabel = attackerId
    ? attackerId.startsWith('mob-')
      ? 'Killed by creature'
      : 'Killed by player'
    : 'Cause unknown';
  const hasCoords =
    typeof recapEvent?.zone === 'string' &&
    typeof recapEvent?.x === 'number' &&
    typeof recapEvent?.y === 'number';
  const locationLabel = hasCoords
    ? `${recapEvent.zone} (${recapEvent.x}, ${recapEvent.y})`
    : 'Unknown';
  const eventId = recapEvent?.evidence_ref?.chronicle_event_id ?? null;

  const copyEventId = useMemo(() => {
    if (eventId === null) return null;
    return () => {
      const text = String(eventId);
      if (navigator.clipboard?.writeText) {
        navigator.clipboard
          .writeText(text)
          .then(() => console.log(`[debug-client] copied event id ${text}`))
          .catch(() => console.log(`[debug-client] failed to copy event id ${text}`));
      } else {
        console.log(`[debug-client] event id ${text}`);
      }
    };
  }, [eventId]);

  useEffect(() => {
    if (!studioProofEnabled) {
      setProof(null);
      setProofError(null);
      return;
    }

    let cancelled = false;
    async function refreshProof() {
      try {
        const response = await fetch(`${config.httpBase}/v1/studio/maps`);
        if (!response.ok) throw new Error(`proof ${response.status}`);
        const data = await response.json() as {
          activePlaytest: null | { id: string };
          lastStudioSmoke?: StudioProofState['lastSmoke'];
        };
        if (cancelled) return;
        setProof({
          activeId: data.activePlaytest?.id ?? null,
          lastSmoke: data.lastStudioSmoke ?? null,
        });
        setProofError(null);
      } catch (error) {
        if (cancelled) return;
        setProof(null);
        setProofError(error instanceof Error ? error.message : String(error));
      }
    }

    void refreshProof();
    const timer = window.setInterval(refreshProof, 5000);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [config.httpBase, studioProofEnabled]);

  async function runProofSmoke() {
    if (!studioProofEnabled) return;
    setProofRunning(true);
    try {
      const response = await fetch(`${config.httpBase}/v1/studio/smoke`, { method: 'POST' });
      const data = await response.json() as NonNullable<StudioProofState['lastSmoke']>;
      setProof({
        activeId: data.draftId,
        lastSmoke: data,
      });
      setProofError(data.ok ? null : data.error ?? 'smoke failed');
    } catch (error) {
      setProofError(error instanceof Error ? error.message : String(error));
    } finally {
      setProofRunning(false);
    }
  }

  return (
    <div className="app-shell">
      <MobileLandscapeGate />
      <TopBar
        stage={state.ui.stage}
        onStageChange={api.setStage}
        map={state.world.map.name as MapName}
        onMapChange={() => {}}
        conn={state.conn}
      />
      {toast && (
        <button
          type="button"
          className="toast"
          onClick={() => api.requestChronicle(10, true)}
        >
          <div className="toast-title">{toast.title}</div>
          {toast.detail && <div className="toast-detail">{toast.detail}</div>}
        </button>
      )}
      {state.recapOpen && (
        <div className="recap-overlay">
          <div className="recap-sheet" role="dialog" aria-live="polite">
            <div className="recap-header">
              <div className="recap-title">Death Recap</div>
              <button type="button" className="recap-close" onClick={api.closeRecap}>
                Close
              </button>
            </div>
            {!recap && <div className="recap-loading">Loading chronicle...</div>}
            {recap && (
              <div className="recap-body">
                <div className="recap-row">Killed by: {killerLabel}</div>
                <div className="recap-row">Location: {locationLabel}</div>
                <div className="recap-row">Time: {recapEvent?.timestamp ?? 'Unknown'}</div>
                <div className="recap-row recap-section">Items lost</div>
                <ul className="recap-list">
                  {recap.lost.length === 0 && <li>None</li>}
                  {recap.lost.map((item) => (
                    <li key={item.kind}>
                      {item.kind}{item.qty > 1 ? ` x${item.qty}` : ''}
                    </li>
                  ))}
                </ul>
                {copyEventId && (
                  <button type="button" className="recap-copy" onClick={copyEventId}>
                    Copy Event ID
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      )}
      {state.chronicleOpen && (
        <div className="chronicle-overlay">
          <div className="chronicle-sheet" role="dialog" aria-live="polite">
            <div className="chronicle-header">
              <div className="chronicle-title">My Chronicle</div>
              <button type="button" className="chronicle-close" onClick={api.closeChronicle}>
                Close
              </button>
            </div>
            {!state.chronicle && <div className="chronicle-loading">Loading chronicle...</div>}
            {state.chronicle && state.chronicle.loading && state.chronicle.events.length === 0 && (
              <div className="chronicle-loading">Loading chronicle...</div>
            )}
            {state.chronicle && !state.chronicle.loading && state.chronicle.events.length === 0 && (
              <div className="chronicle-empty">No events yet.</div>
            )}
            {state.chronicle && state.chronicle.events.length > 0 && (
              <div className="chronicle-body">
                {chronicleGroups.map((group) => (
                  <div key={group.day} className="chronicle-day">
                    <div className="chronicle-day-label">{group.day}</div>
                    <div className="chronicle-list">
                      {group.items.map((ev) => {
                        const { icon, text } = renderChronicleEvent(ev);
                        if (!text) return null;
                        if (ev.kind === 'death') {
                          const gid =
                            typeof ev.evidence_ref?.chronicle_event_id === 'number'
                              ? ev.evidence_ref.chronicle_event_id
                              : null;
                          return (
                            <button
                              key={`${ev.kind}-${ev.timestamp}`}
                              type="button"
                              className="chronicle-row chronicle-row--clickable"
                              onClick={() => api.openRecapFromChronicle({
                                timestamp: ev.timestamp,
                                chronicle_event_id: gid,
                                zone: ev.zone,
                                x: ev.x,
                                y: ev.y,
                              })}
                            >
                              <span className="chronicle-icon">{icon}</span>
                              <span className="chronicle-text">{text}</span>
                            </button>
                          );
                        }
                        return (
                          <div key={`${ev.kind}-${ev.timestamp}`} className="chronicle-row">
                            <span className="chronicle-icon">{icon}</span>
                            <span className="chronicle-text">{text}</span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            )}
            {state.chronicle?.loading && state.chronicle.events.length > 0 && (
              <div className="chronicle-loading">Loading more...</div>
            )}
            {state.chronicle?.hasMore && (
              <button
                type="button"
                className="chronicle-more"
                onClick={api.loadMoreChronicle}
                disabled={state.chronicle.loading}
              >
                Load more
              </button>
            )}
          </div>
        </div>
      )}

      <main className="main">
        <section className="stage stage-map">
          <MapCanvas
            map={state.world.map}
            me={state.world.me}
            others={others}
            viewMode={phoneLandscape ? 'follow-player' : 'full-map'}
            viewportPixels={mobileViewport}
            nowMs={now}
            targetId={state.combat.targetId}
            fx={state.combat.fx}
            onSelectTarget={api.setTarget}
            groundItems={state.groundItems}
            propertyByPlot={propertyByPlot}
            worldVisualObjects={worldVisualObjects}
          />
          <div className="scene-vignette" />
          {!isDead && healthPct <= 30 && (
            <div className="low-hp-vignette" aria-hidden="true" />
          )}
          {deathModalOpen && (
            <div className="death-overlay" role="dialog" aria-modal="true">
              <div className="death-modal">
                <div className="death-overlay-title">You died</div>
                <div className="death-overlay-sub">
                  Your run has ended. Sign back in to return to character select.
                </div>
                <div className="death-modal-actions">
                  <button
                    className="action-btn death-relog-btn"
                    onClick={() => {
                      setDeathModalOpen(false);
                      api.relog();
                    }}
                  >
                    Sign in again
                  </button>
                </div>
              </div>
            </div>
          )}
          <div className="hud hud-primary" aria-label="play status">
            <div className="hud-card hud-card--identity">
              <span className="hud-kicker">Akalynth</span>
              <strong>{state.session.name ?? 'Phone guest'}</strong>
              <span>{currentMapDisplayName}</span>
              <CharacterBar
                session={state.session}
                catalog={api.characterCatalog}
                accountSession={api.accountSession}
                onCreate={api.createCharacter}
                onRefreshAccountSession={api.refreshAccountSession}
                onSignOut={api.signOut}
              />
            </div>
            <div className="hud-card hud-card--stats">
              <div>
                <span>Position</span>
                <strong>{playerPositionLabel}</strong>
              </div>
              <div>
                <span>Health</span>
                <strong>{healthLabel}</strong>
                <div className="hp-bar" aria-hidden="true">
                  <div
                    className={`hp-bar-fill ${healthPct <= 30 ? 'low' : ''}`}
                    style={{ width: `${state.world.me?.status === 'dead' ? 0 : healthPct}%` }}
                  />
                </div>
              </div>
              <div>
                <span>Link</span>
                <strong>{state.conn.phase}</strong>
              </div>
            </div>
          </div>
          {showMobilePlayEntry && (
            <MobilePlayEntry
              session={state.session}
              stage={state.ui.stage}
              conn={state.conn}
              hasWorldPlayer={Boolean(state.world.me)}
              characterCatalog={api.characterCatalog}
              accountSession={api.accountSession}
              onCreate={api.createCharacter}
              onRefreshAccountSession={api.refreshAccountSession}
              onSignOut={api.signOut}
              onEnterPlay={() => api.setStage(1)}
            />
          )}
          {phoneLandscape && (
            <MobileStatusRail
              name={state.session.name}
              position={playerPositionLabel}
              health={healthLabel}
              conn={state.conn}
            />
          )}
          <div className="hud hud-proof" aria-label="studio proof">
            <div className={`proof-chip objective-chip ${state.loop?.complete ? 'proof-chip--pass' : ''}`}>
              <span>Objective</span>
              <strong>{objectiveLabel}</strong>
            </div>
            <div className="proof-chip">
              <span>Playtest</span>
              <strong>{activePlaytestLabel}</strong>
            </div>
            <div className={`proof-chip proof-chip--${smokeState}`}>
              <span>Smoke</span>
              <strong>{smokeLabel}</strong>
            </div>
          </div>
          {state.ui.stage >= 3 && <NearbyList players={roster} />}
          {state.ui.stage >= 3 && propertyList.length > 0 && (
            <PropertyLedger
              properties={propertyList}
              myName={state.session.name}
              gold={state.gold}
              onBuy={api.buyHouse}
              onList={api.listHouse}
              onUnlist={api.unlistHouse}
            />
          )}
          <div
            className="dead-zone"
            onPointerDown={(e) => {
              e.preventDefault();
              api.stopMoves();
            }}
          />
        </section>

        <section className="stage stage-controls" aria-label="touch controls">
          <div className="thumb-zone left">
            <DPad onMove={api.sendMove} onRelease={api.releaseMove} onStopAll={api.stopMoves} />
          </div>
          <div className="thumb-zone right">
            <ActionsPanel
              stage={state.ui.stage}
              compact={phoneLandscape}
              onAttack={api.sendAttack}
              onRitual={api.castRunestone}
              onTalk={api.talkToNpc}
              onPickup={api.pickupItem}
              onStartWork={api.startWork}
              onTickWork={api.tickWork}
              onBuy={api.useSkill}
              onWorldEventAction={api.useSkill}
              onUseItem={(itemId) => api.useSkill('item:use:' + itemId)}
              attackReady={attackReady}
              ritualReady={ritualReady}
              ritualHint={ritualHint}
              nearLegendStone={nearLegendStone}
              nearbyNpc={nearbyNpc}
              groundItemHere={groundItemHere}
              workContract={state.workContract}
              targetName={targetName}
              loop={state.loop}
              objectiveLabel={objectiveLabel}
              inventory={state.inventory}
              gold={state.gold}
            />
          </div>
        </section>

        <section
          className={`stage stage-bottom command-dock proof-${smokeState}`}
        >
          <div className="bottom-actions">
            <button
              className="chat-toggle"
              aria-label="Open chat"
              onClick={() => {
                setInventoryOpen(false);
                setProofSheetOpen(false);
                api.closeChronicle();
                setChatOpen(true);
              }}
            >
              Chat
            </button>
            <button
              className="chronicle-toggle"
              aria-label="Open log"
              onClick={() => {
                setChatOpen(false);
                setInventoryOpen(false);
                setProofSheetOpen(false);
                api.openChronicle();
              }}
            >
              Log
            </button>
            <button
              className="inventory-toggle"
              aria-label="Open backpack"
              onClick={() => {
                setChatOpen(false);
                setProofSheetOpen(false);
                api.closeChronicle();
                setInventoryOpen(true);
              }}
            >
              Pack
            </button>
            <button
              className="proof-toggle"
              aria-label={phoneLandscape ? 'Open proof status' : proofRunning ? 'Running proof' : 'Run proof'}
              onClick={() => {
                if (phoneLandscape) {
                  setChatOpen(false);
                  setInventoryOpen(false);
                  api.closeChronicle();
                  setProofSheetOpen(true);
                  return;
                }
                void runProofSmoke();
              }}
              disabled={!phoneLandscape && (proofRunning || !studioProofEnabled)}
            >
              {proofRunning ? 'Running' : 'Proof'}
            </button>
          </div>
          <div className="status-pills">
            <span className="pill">World synced</span>
            {proof?.lastSmoke?.worldSpawn && (
              <span className="pill proof-pill">Proof {proof.lastSmoke.worldSpawn.x},{proof.lastSmoke.worldSpawn.y}</span>
            )}
            {state.world.me?.status === 'dead' && <span className="pill warning">Dead</span>}
          </div>
        </section>
      </main>

      <ChatSheet
        open={chatOpen}
        messages={state.chat}
        onClose={() => setChatOpen(false)}
        onSend={(msg) => api.sendChat(msg)}
      />
      <BackpackSheet
        open={inventoryOpen}
        inventory={state.inventory}
        onClose={() => setInventoryOpen(false)}
        onUseItem={(itemId) => api.useSkill('item:use:' + itemId)}
      />
      <ProofSheet
        open={proofSheetOpen}
        objectiveLabel={objectiveLabel}
        playtestLabel={activePlaytestLabel}
        smokeLabel={smokeLabel}
        smokeState={smokeState}
        lastSmoke={proof?.lastSmoke ?? null}
        proofError={proofError}
        proofRunning={proofRunning}
        studioProofEnabled={studioProofEnabled}
        onClose={() => setProofSheetOpen(false)}
        onRunProof={() => void runProofSmoke()}
      />
    </div>
  );
}
