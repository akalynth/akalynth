import { useEffect, useMemo, useRef, useState } from 'react';
import type { MapName } from '@shared/http';
import { useGameClient } from '../hooks/useGameClient';
import { MapCanvas } from './MapCanvas';
import { DPad } from './DPad';
import { EventLog, type LogEntry } from './EventLog';
import { PresenceList } from './PresenceList';

function useNow(interval = 200) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const t = window.setInterval(() => setNow(Date.now()), interval);
    return () => window.clearInterval(t);
  }, [interval]);
  return now;
}

let logId = 0;
function makeEntry(type: LogEntry['type'], text: string): LogEntry {
  return { id: `${++logId}`, ts: Date.now(), type, text };
}

export function ExistenceShell() {
  const initialMap: MapName = 'Rookguard';
  const [state, api] = useGameClient(initialMap);
  const now = useNow();
  const others = useMemo(() => Array.from(state.world.others.values()), [state.world.others]);

  // Event log state - tracks server-confirmed events
  const [log, setLog] = useState<LogEntry[]>([]);
  const prevPhase = useRef(state.conn.phase);
  const prevMe = useRef(state.world.me);
  const prevOtherIds = useRef(new Set<string>());

  // Track connection phase changes
  useEffect(() => {
    const phase = state.conn.phase;
    if (phase !== prevPhase.current) {
      if (phase === 'connected' || phase === 'awaiting_world_state') {
        setLog((l) => [...l, makeEntry('connect', 'Connected to server')]);
      } else if (phase === 'disconnected') {
        setLog((l) => [...l, makeEntry('disconnect', 'Disconnected')]);
      } else if (phase === 'error') {
        setLog((l) => [...l, makeEntry('error', `Error: ${state.conn.reason || 'unknown'}`)]);
      }
      prevPhase.current = phase;
    }
  }, [state.conn.phase, state.conn.reason]);

  // Track spawn and position changes
  useEffect(() => {
    const me = state.world.me;
    const prev = prevMe.current;

    if (me && !prev) {
      // Spawned
      setLog((l) => [...l, makeEntry('spawn', `Spawned at ${me.x},${me.y} on ${state.world.map.name}`)]);
    } else if (me && prev && (me.x !== prev.x || me.y !== prev.y)) {
      // Moved (server confirmed)
      setLog((l) => [...l, makeEntry('move', `→ ${me.x},${me.y}`)]);
    }

    prevMe.current = me;
  }, [state.world.me, state.world.map.name]);

  // Track player joins/leaves
  useEffect(() => {
    const currentIds = new Set(others.map((p) => p.id));
    const prevIds = prevOtherIds.current;

    for (const p of others) {
      if (!prevIds.has(p.id)) {
        setLog((l) => [...l, makeEntry('join', `${p.name} joined`)]);
      }
    }

    for (const id of prevIds) {
      if (!currentIds.has(id)) {
        setLog((l) => [...l, makeEntry('leave', `Player left`)]);
      }
    }

    prevOtherIds.current = currentIds;
  }, [others]);

  // Keyboard controls
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.repeat) return;
      switch (e.key) {
        case 'ArrowUp':
        case 'w':
        case 'W':
          api.sendMove('north');
          break;
        case 'ArrowDown':
        case 's':
        case 'S':
          api.sendMove('south');
          break;
        case 'ArrowLeft':
        case 'a':
        case 'A':
          api.sendMove('west');
          break;
        case 'ArrowRight':
        case 'd':
        case 'D':
          api.sendMove('east');
          break;
      }
    };

    const onKeyUp = (e: KeyboardEvent) => {
      switch (e.key) {
        case 'ArrowUp':
        case 'w':
        case 'W':
          api.releaseMove('north');
          break;
        case 'ArrowDown':
        case 's':
        case 'S':
          api.releaseMove('south');
          break;
        case 'ArrowLeft':
        case 'a':
        case 'A':
          api.releaseMove('west');
          break;
        case 'ArrowRight':
        case 'd':
        case 'D':
          api.releaseMove('east');
          break;
      }
    };

    window.addEventListener('keydown', onKey);
    window.addEventListener('keyup', onKeyUp);
    return () => {
      window.removeEventListener('keydown', onKey);
      window.removeEventListener('keyup', onKeyUp);
    };
  }, [api]);

  return (
    <div className="existence-shell">
      <header className="existence-header">
        <span className="existence-title">Akalynth</span>
        <span className={`existence-conn existence-conn--${state.conn.phase}`}>
          {state.conn.phase}
        </span>
      </header>

      <main className="existence-main">
        <section className="existence-grid">
          <MapCanvas
            map={state.world.map}
            me={state.world.me}
            others={others}
            nowMs={now}
            targetId={null}
            fx={[]}
            onSelectTarget={() => {}}
          />
          <div className="existence-controls">
            <DPad onMove={api.sendMove} onRelease={api.releaseMove} onStopAll={api.stopMoves} />
          </div>
        </section>

        <aside className="existence-sidebar">
          <EventLog entries={log} />
          <PresenceList me={state.world.me} others={others} />
        </aside>
      </main>
    </div>
  );
}
