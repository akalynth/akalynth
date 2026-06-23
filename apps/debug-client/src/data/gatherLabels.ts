/** Player-facing copy for the Azura chill-zone gather loop (server IDs unchanged). */

export const GATHER_PANEL_TITLE = 'Ley Mote Tending';

export const GATHER_PANEL_HINT =
  'Walk to a green M on the map, Gather a mote, amber R to attune, blue C to deliver.';

export const NODE_LABELS: Record<string, string> = {
  azura_ley_mote_e: 'Ley Mote (east)',
  azura_ley_mote_s: 'Ley Mote (south)',
  azura_ley_mote_se: 'Ley Mote (southeast)',
  azura_ley_mote_n: 'Ley Mote (north)',
};

export const STATION_LABELS: Record<string, string> = {
  azura_refinery_stand: 'Attunement Stand',
  azura_curation_stand: 'Curation Post',
};

export function nodeLabel(nodeId: string): string {
  return NODE_LABELS[nodeId] ?? 'Ley Mote';
}

export function stationLabel(stationId: string, kind: 'refinery' | 'curation' | string): string {
  return STATION_LABELS[stationId] ?? (kind === 'refinery' ? 'Attunement Stand' : 'Curation Post');
}