import { useEffect, useMemo, useState } from 'react';
import type { MapName } from '@shared/http';
import { useGameClient } from './hooks/useGameClient';
import { MapCanvas } from './components/MapCanvas';
import { DPad } from './components/DPad';
import { ActionsPanel } from './components/ActionsPanel';
import { ChatSheet } from './components/ChatSheet';
import { TopBar } from './components/TopBar';
import { NearbyList } from './components/NearbyList';

function useNow(interval = 200) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const t = window.setInterval(() => setNow(Date.now()), interval);
    return () => window.clearInterval(t);
  }, [interval]);
  return now;
}

export default function App() {
  const initialMap: MapName = 'Rookguard';
  const [state, api] = useGameClient(initialMap);
  const [chatOpen, setChatOpen] = useState(false);
  const now = useNow();

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

  return (
    <div className="app-shell">
      <TopBar
        stage={state.ui.stage}
        onStageChange={api.setStage}
        map={state.world.map.name as MapName}
        onMapChange={() => {}}
        conn={state.conn}
      />

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
          <button className="chat-toggle" onClick={() => setChatOpen(true)}>
            Open Chat
          </button>
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
