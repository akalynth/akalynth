import type { MapDebugOverlay } from '../components/MapCanvas';
import type { GatherNodeState } from '@shared/protocol';
import type { GameClientState } from '../types';

const NODE_STYLE: Record<GatherNodeState, { fill: string; stroke: string; label: string }> = {
  available: { fill: 'rgba(52, 211, 153, 0.35)', stroke: '#34d399', label: 'M' },
  depleting: { fill: 'rgba(251, 191, 36, 0.4)', stroke: '#fbbf24', label: '…' },
  depleted: { fill: 'rgba(239, 68, 68, 0.35)', stroke: '#ef4444', label: '×' },
};

/** Project server-authoritative gather nodes/stations onto the map for playtesting. */
export function gatherMapOverlays(gather: GameClientState['gather']): MapDebugOverlay[] {
  const overlays: MapDebugOverlay[] = [];

  for (const node of gather.nodes.values()) {
    const style = NODE_STYLE[node.state];
    const active = gather.activeNodeId === node.node_id;
    overlays.push({
      id: `gather-node-${node.node_id}`,
      x: node.x,
      y: node.y,
      fill: style.fill,
      stroke: active ? '#f8fafc' : style.stroke,
      label: style.label,
    });
  }

  for (const station of gather.stations.values()) {
    overlays.push({
      id: `gather-station-${station.station_id}`,
      x: station.x,
      y: station.y,
      // Refinery (R, amber) vs curation stand (C, blue).
      fill: station.kind === 'refinery' ? 'rgba(251, 191, 36, 0.35)' : 'rgba(96, 165, 250, 0.35)',
      stroke:
        station.kind === 'refinery' && gather.activeRefineStationId === station.station_id
          ? '#f8fafc'
          : station.kind === 'refinery'
            ? '#fbbf24'
            : '#60a5fa',
      label: station.kind === 'refinery' ? 'R' : 'C',
    });
  }

  return overlays;
}