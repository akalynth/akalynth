import { useEffect, useMemo, useState } from 'react';
import type { MapName } from '@shared/http';
import type { ChronicleEvent } from '@shared/protocol';
import { useGameClient } from './hooks/useGameClient';
import { useExistenceMode } from './hooks/useExistenceMode';
import { MapCanvas } from './components/MapCanvas';
import { DPad } from './components/DPad';
import { ActionsPanel } from './components/ActionsPanel';
import { ChatSheet } from './components/ChatSheet';
import { TopBar } from './components/TopBar';
import { NearbyList } from './components/NearbyList';
import { ExistenceShell } from './components/ExistenceShell';

type ChronicleGroup = { day: string; items: ChronicleEvent[] };

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
  const [state, api] = useGameClient(initialMap);
  const [chatOpen, setChatOpen] = useState(false);
  const now = useNow();
  const toast = state.toast && now < state.toast.expiresAt ? state.toast : null;

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
          <div className="hud">
            <div className="hud-card">
              <div>Map: {state.world.map.name}</div>
              <div>
                You: {state.world.me ? `${state.world.me.x}, ${state.world.me.y}` : 'connecting…'}
              </div>
              <div>Nearby: {others.length}</div>
              <div>Conn: {state.conn.phase}</div>
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

        <section className="stage stage-controls">
          <div className="thumb-zone left">
            <DPad onMove={api.sendMove} onRelease={api.releaseMove} onStopAll={api.stopMoves} />
          </div>
          <div className="thumb-zone right">
            <ActionsPanel
              stage={state.ui.stage}
              onAttack={api.sendAttack}
              attackReady={attackReady}
              targetName={targetName}
            />
          </div>
        </section>

        <section className="stage stage-bottom">
          <div className="bottom-actions">
            <button className="chat-toggle" onClick={() => setChatOpen(true)}>
              Open Chat
            </button>
            <button className="chronicle-toggle" onClick={api.openChronicle}>
              Chronicle
            </button>
          </div>
          <div className="status-pills">
            <span className="pill">World synced</span>
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
