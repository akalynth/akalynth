import type { PlayerPublic } from '@shared/types';
import type { GameClientState } from '../types';
import {
  GATHER_PANEL_HINT,
  GATHER_PANEL_TITLE,
  nodeLabel,
  stationLabel,
} from '../data/gatherLabels';

interface GatherPanelProps {
  gather: GameClientState['gather'];
  me: PlayerPublic | null;
  onGather: (nodeId: string) => void;
  onDeliver: (stationId: string) => void;
  onRefine: (stationId: string) => void;
}

function manhattan(ax: number, ay: number, bx: number, by: number): number {
  return Math.abs(ax - bx) + Math.abs(ay - by);
}

/** A held item is refinable while it is still raw (refined types are prefixed `refined_`). */
function isRefinable(itemType: string): boolean {
  return !itemType.startsWith('refined_');
}

// Chill-Zone Gather v0 (Step 2) + Refine (Step 3). Client renders the server-authoritative
// node/station registry and sends gather/refine/deliver INTENTS only — every outcome (claim,
// timer, yield, upgrade, reward) is decided server-side. Adjacency here just disables
// out-of-range buttons for UX; the server re-validates and can still reject.
export function GatherPanel({ gather, me, onGather, onDeliver, onRefine }: GatherPanelProps) {
  const nodes = Array.from(gather.nodes.values());
  const stations = Array.from(gather.stations.values());
  if (nodes.length === 0 && stations.length === 0) return null;

  const inRange = (x: number, y: number) => me != null && manhattan(me.x, me.y, x, y) <= 1;
  const busy = gather.activeNodeId != null || gather.activeRefineStationId != null;
  const refining = gather.activeRefineStationId != null;

  return (
    <div className="gather-card">
      <div className="gather-title">{GATHER_PANEL_TITLE}</div>
      <div className="gather-hint">{GATHER_PANEL_HINT}</div>
      <div className="gather-held">Held: {gather.held ? gather.held.item_type : '—'}</div>
      <div className="gather-held">Tending: {gather.tendingTokens} · Keystone: {gather.keystoneTokens}</div>

      {busy && (
        <div className="gather-progress" aria-label="gather-progress">
          <div
            className={`gather-progress-bar${refining ? ' refining' : ''}`}
            style={{ width: `${Math.round(gather.progressPct)}%` }}
          />
          <span className="gather-progress-label">{Math.round(gather.progressPct)}%</span>
        </div>
      )}

      <div className="gather-list">
        {nodes.map((n) => {
          const canGather = inRange(n.x, n.y) && n.state === 'available' && !busy && !gather.held;
          return (
            <div key={n.node_id} className="gather-row" aria-label={`node-${n.node_id}`}>
              <span className={`gather-dot ${n.state}`} />
              <span className="gather-name">{nodeLabel(n.node_id)}</span>
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
          const here = inRange(st.x, st.y);
          if (st.kind === 'refinery') {
            const canRefine = here && !busy && gather.held != null && isRefinable(gather.held.item_type);
            const refiningHere = gather.activeRefineStationId === st.station_id;
            return (
              <div key={st.station_id} className="gather-row" aria-label={`station-${st.station_id}`}>
                <span className="gather-dot refinery" />
                <span className="gather-name">{stationLabel(st.station_id, st.kind)}</span>
                <button
                  type="button"
                  className={`gather-btn${refiningHere ? ' gather-btn--active' : ''}`}
                  disabled={!canRefine}
                  onClick={() => onRefine(st.station_id)}
                >
                  {refiningHere ? `Refn ${Math.round(gather.progressPct)}%` : 'Refn'}
                </button>
              </div>
            );
          }
          const canDeliver = here && !busy && gather.held != null;
          return (
            <div key={st.station_id} className="gather-row" aria-label={`station-${st.station_id}`}>
              <span className="gather-dot station" />
              <span className="gather-name">{stationLabel(st.station_id, st.kind)}</span>
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