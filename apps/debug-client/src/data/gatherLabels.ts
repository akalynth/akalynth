/** Player-facing copy for the Azura chill-zone gather loop (server IDs unchanged). */

export const GATHER_PANEL_TITLE = 'Ley Mote Tending';

export const GATHER_PANEL_HINT =
  'Walk to a green M on the map, Gather a mote, amber R to attune, blue C to deliver.';

export const LOOP_STEP_LABELS = ['Gather', 'Attune', 'Deliver'] as const;

export type GatherLoopStep = 1 | 2 | 3;

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

/** Raw item_type → player label. Unknown types fall back to the raw id. */
export const HELD_ITEM_LABELS: Record<string, string> = {
  ley_mote: 'Ley mote',
  refined_ley_mote: 'Refined ley mote',
};

export const REWARD_LABELS: Record<string, string> = {
  tending_token: 'tending token',
  keystone_token: 'keystone',
};

export function nodeLabel(nodeId: string): string {
  return NODE_LABELS[nodeId] ?? 'Ley Mote';
}

export function stationLabel(stationId: string, kind: 'refinery' | 'curation' | string): string {
  return STATION_LABELS[stationId] ?? (kind === 'refinery' ? 'Attunement Stand' : 'Curation Post');
}

export function heldItemLabel(itemType: string | null | undefined): string {
  if (!itemType) return '—';
  return HELD_ITEM_LABELS[itemType] ?? itemType.replace(/_/g, ' ');
}

export function isRefinedItemType(itemType: string): boolean {
  return itemType.startsWith('refined_');
}

/**
 * Display-only ritual step from server-backed held item.
 * See CLIENT_PLAY_SURFACE_CONTRACT_V1 §2.3.1.
 */
export function gatherLoopStep(heldItemType: string | null | undefined): GatherLoopStep {
  if (heldItemType == null || heldItemType === '') return 1;
  if (!isRefinedItemType(heldItemType)) return 2;
  return 3;
}

/** Build deliver status from deliver_result fields only (no invented rewards). */
export function deliverStatusLine(input: {
  ok: boolean;
  item_type?: string | null;
  reward?: string | null;
  refined?: boolean;
  reason?: string | null;
  /** Keystone count *before* applying this deliver (for first-keystone closure). */
  priorKeystoneTokens?: number | null;
}): string {
  if (!input.ok) {
    return `Deliver rejected: ${input.reason ?? 'rejected'}`;
  }
  const item = heldItemLabel(input.item_type ?? 'item');
  const reward = input.reward ? REWARD_LABELS[input.reward] ?? input.reward.replace(/_/g, ' ') : null;
  const base =
    reward != null
      ? `Delivered ${item} → +1 ${reward}`
      : `Delivered ${item}`;
  // First-session emotional beat: first keystone is non-silent (still from server fields only).
  if (
    input.refined === true &&
    input.reward === 'keystone_token' &&
    (input.priorKeystoneTokens ?? 0) === 0
  ) {
    return `${base}. The curation post accepts your first keystone — Azura remembers.`;
  }
  if (input.refined === true && reward != null) {
    return `${base}. The chill loop is complete — tend another mote when you are ready.`;
  }
  return base;
}

/** True when status is a successful refined keystone deliver (display helpers). */
export function isKeystoneDeliverStatus(status: string | null | undefined): boolean {
  if (!status) return false;
  return status.startsWith('Delivered') && status.includes('keystone');
}
