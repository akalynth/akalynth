import type { PlayerPublic } from '@shared/types';
import type { GameClientState } from '../types';

interface GatherPanelProps {
  gather: GameClientState['gather'];
  me: PlayerPublic | null;
  onGather: (nodeId: string) => void;
  onDeliver: (stationId: string) => void;
}

function manhattan(ax: number, ay: number, bx: number, by: number): number {
  return Math.abs(ax - bx) + Math.abs(ay - by);
}

// Chill-Zone Gather v0 (Step 2). Client renders the server-authoritative node/station
// registry and sends gather/deliver INTENTS only — every outcome (claim, timer, yield,
// reward) is decided server-side. Adjacency here just disables out-of-range buttons for UX;
// the server re-validates and can still reject.
export function GatherPanel({ gather, me, onGather, onDeliver }: GatherPanelProps) {
  const nodes = Array.from(gather.nodes.values());
  const stations = Array.from(gather.stations.values());
  if (nodes.length === 0 && stations.length === 0) return null;

  const inRange = (x: number, y: number) => me != null && manhattan(me.x, me.y, x, y) <= 1;
  const busy = gather.activeNodeId != null;

  return (
    <div className="gather-card">
      <div className="gather-title">Chill-Zone Gather</div>
      <div className="gather-held">Held: {gather.held ? gather.held.item_type : '—'}</div>

      {busy && (
        <div className="gather-progress" aria-label="gather-progress">
          <div className="gather-progress-bar" style={{ width: `${Math.round(gather.progressPct)}%` }} />
          <span className="gather-progress-label">{Math.round(gather.progressPct)}%</span>
        </div>
      )}

      <div className="gather-list">
        {nodes.map((n) => {
          const canGather = inRange(n.x, n.y) && n.state === 'available' && !busy && !gather.held;
          return (
            <div key={n.node_id} className="gather-row" aria-label={`node-${n.node_id}`}>
              <span className={`gather-dot ${n.state}`} />
              <span className="gather-name">{n.node_id}</span>
              <span className="gather-state">{n.state}</span>
              <button type="button" className="gather-btn" disabled={!canGather} onClick={() => onGather(n.node_id)}>
                Gather
              </button>
            </div>
          );
        })}
      </div>

      <div className="gather-list">
        {stations.map((st) => {
          const canDeliver = inRange(st.x, st.y) && gather.held != null;
          return (
            <div key={st.station_id} className="gather-row" aria-label={`station-${st.station_id}`}>
              <span className="gather-dot station" />
              <span className="gather-name">{st.station_id}</span>
              <button type="button" className="gather-btn" disabled={!canDeliver} onClick={() => onDeliver(st.station_id)}>
                Deliver
              </button>
            </div>
          );
        })}
      </div>

      {gather.status && <div className="gather-status">{gather.status}</div>}
    </div>
  );
}
