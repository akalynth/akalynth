import { useEffect, useMemo, useState } from 'react';
import type { MapName } from '@shared/http';
import type { ChronicleEvent } from '@shared/protocol';
import type { MapData, PlayerPublic } from '@shared/types';
import { useGameClient } from './hooks/useGameClient';
import { useExistenceMode } from './hooks/useExistenceMode';
import { MapCanvas } from './components/MapCanvas';
import { DPad } from './components/DPad';
import { ActionsPanel } from './components/ActionsPanel';
import { ChatSheet } from './components/ChatSheet';
import { TopBar } from './components/TopBar';
import { NearbyList } from './components/NearbyList';
import { ExistenceShell } from './components/ExistenceShell';
import { loadConfig } from './config';

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

export default function App() {
  const existenceMode = useExistenceMode();

  // Existence mode: minimal truth viewer
  if (existenceMode) {
    return <ExistenceShell />;
  }

  // Full debug client
  return <DebugApp />;
}

function DebugApp() {
  const initialMap: MapName = 'Rookguard';
  const config = useMemo(() => loadConfig(), []);
  const studioProofEnabled = import.meta.env.VITE_ENABLE_STUDIO_PROOF === '1';
  const [state, api] = useGameClient(initialMap);
  const [chatOpen, setChatOpen] = useState(false);
  const [proof, setProof] = useState<StudioProofState | null>(null);
  const [proofRunning, setProofRunning] = useState(false);
  const [proofError, setProofError] = useState<string | null>(null);
  const now = useNow();
  const toast = state.toast && now < state.toast.expiresAt ? state.toast : null;
  const activePlaytestLabel = proof?.activeId ?? 'canonical';
  const objectiveLabel = state.loop?.objective ?? 'Enter Rookguard';
  const healthLabel = state.world.me?.status === 'dead' ? 'Down' : 'Alive';
  const smokeState = proof?.lastSmoke?.ok ? 'pass' : proof?.lastSmoke ? 'fail' : proofError ? 'offline' : 'idle';
  const smokeLabel =
    smokeState === 'pass' ? 'passed' :
    smokeState === 'fail' ? 'failed' :
    smokeState === 'offline' ? 'offline' :
    'ready';

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
  const currentMapName = state.world.map.name;
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
            nowMs={now}
            targetId={state.combat.targetId}
            fx={state.combat.fx}
            onSelectTarget={api.setTarget}
          />
          <div className="scene-vignette" />
          <div className="hud hud-primary" aria-label="play status">
            <div className="hud-card hud-card--identity">
              <span className="hud-kicker">Akalynth</span>
              <strong>{state.session.name ?? 'Phone guest'}</strong>
              <span>{state.world.map.name}</span>
            </div>
            <div className="hud-card hud-card--stats">
              <div>
                <span>Position</span>
                <strong>{state.world.me ? `${state.world.me.x},${state.world.me.y}` : '--'}</strong>
              </div>
              <div>
                <span>Health</span>
                <strong>{healthLabel}</strong>
              </div>
              <div>
                <span>Link</span>
                <strong>{state.conn.phase}</strong>
              </div>
            </div>
          </div>
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
              onAttack={api.sendAttack}
              onRitual={api.castRunestone}
              onTalk={api.talkToNpc}
              onPickup={api.pickupItem}
              onStartWork={api.startWork}
              onTickWork={api.tickWork}
              attackReady={attackReady}
              ritualReady={ritualReady}
              ritualHint={ritualHint}
              nearLegendStone={nearLegendStone}
              nearbyNpc={nearbyNpc}
              groundItemHere={groundItemHere}
              workContract={state.workContract}
              targetName={targetName}
              loop={state.loop}
            />
          </div>
        </section>

        <section
          className={`stage stage-bottom command-dock proof-${smokeState}`}
          style={{
            display: 'block',
            left: '0.55rem',
            maxWidth: 'calc(100vw - 1.1rem)',
            right: 'auto',
            width: 'calc(100vw - 1.1rem)',
          }}
        >
          <div
            className="bottom-actions"
            style={{
              display: 'grid',
              gap: '0.42rem',
              gridTemplateColumns: 'repeat(3, minmax(0, 1fr))',
              minWidth: 0,
              width: '100%',
            }}
          >
            <button
              className="chat-toggle"
              aria-label="Open chat"
              style={{ minWidth: 0, width: '100%' }}
              onClick={() => setChatOpen(true)}
            >
              Chat
            </button>
            <button
              className="chronicle-toggle"
              aria-label="Open chronicle"
              style={{ minWidth: 0, width: '100%' }}
              onClick={api.openChronicle}
            >
              Log
            </button>
            <button
              className="proof-toggle"
              aria-label={proofRunning ? 'Running proof' : 'Run proof'}
              style={{ minWidth: 0, width: '100%' }}
              onClick={() => void runProofSmoke()}
              disabled={proofRunning || !studioProofEnabled}
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
    </div>
  );
}
