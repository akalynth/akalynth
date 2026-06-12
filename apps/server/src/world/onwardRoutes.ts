import type { AuditReceipt } from '../../../../packages/shared/types.js';
import {
  DREAM_FRAGMENT_ANCHORED_ACTION,
  DREAM_GATE_INTERPRETED_ACTION,
  DREAM_GATE_SEAL_PREPARED_ACTION,
  FORGEHOLD_ECONOMY_QUOTED_ACTION,
  FORGEHOLD_SHIPMENT_INVESTIGATED_ACTION,
  HEARTFORGE_GATE_PREPARED_ACTION,
  ROUTE_ABUSE_NOTES_REVIEWED_ACTION,
  ROUTE_SURVEYED_ACTION,
  SOULSTEEL_STABILIZED_ACTION,
} from '../../../../packages/shared/skills.js';

export interface OnwardRouteReceiptProgress {
  forgeholdSurveyed: boolean;
  forgeholdShipmentInvestigated: boolean;
  forgeholdEconomyQuoted: boolean;
  soulsteelStabilized: boolean;
  forgeholdAbuseNotesReviewed: boolean;
  heartforgeGatePrepared: boolean;
  moonspireSurveyed: boolean;
  dreamGateInterpreted: boolean;
  dreamFragmentAnchored: boolean;
  dreamGateAbuseNotesReviewed: boolean;
  dreamGateSealPrepared: boolean;
}

function defaultProgress(): OnwardRouteReceiptProgress {
  return {
    forgeholdSurveyed: false,
    forgeholdShipmentInvestigated: false,
    forgeholdEconomyQuoted: false,
    soulsteelStabilized: false,
    forgeholdAbuseNotesReviewed: false,
    heartforgeGatePrepared: false,
    moonspireSurveyed: false,
    dreamGateInterpreted: false,
    dreamFragmentAnchored: false,
    dreamGateAbuseNotesReviewed: false,
    dreamGateSealPrepared: false,
  };
}

const progressByPlayerId = new Map<string, OnwardRouteReceiptProgress>();

function cloneProgress(progress: OnwardRouteReceiptProgress): OnwardRouteReceiptProgress {
  return { ...progress };
}

export function getOnwardRouteReceiptProgress(playerId: string): OnwardRouteReceiptProgress {
  return cloneProgress(progressByPlayerId.get(playerId) ?? defaultProgress());
}

export function clearOnwardRouteProjection(): void {
  progressByPlayerId.clear();
}

function setProgress(playerId: string, next: OnwardRouteReceiptProgress): void {
  progressByPlayerId.set(playerId, cloneProgress(next));
}

export function applyReceiptToOnwardRoutes(receipt: AuditReceipt): void {
  const playerId = receipt.actor_id;
  if (!playerId || receipt.result === 'rejected') return;

  const current = getOnwardRouteReceiptProgress(playerId);
  let next: OnwardRouteReceiptProgress | null = null;

  if (receipt.action === ROUTE_SURVEYED_ACTION) {
    if (receipt.inputs?.route_id === 'forgehold_route_slice_v1') {
      next = { ...current, forgeholdSurveyed: true };
    } else if (receipt.inputs?.route_id === 'moonspire_dream_gate_slice_v1') {
      next = { ...current, moonspireSurveyed: true };
    }
  } else if (receipt.action === FORGEHOLD_SHIPMENT_INVESTIGATED_ACTION) {
    next = { ...current, forgeholdShipmentInvestigated: true };
  } else if (receipt.action === FORGEHOLD_ECONOMY_QUOTED_ACTION) {
    next = { ...current, forgeholdEconomyQuoted: true };
  } else if (receipt.action === SOULSTEEL_STABILIZED_ACTION) {
    next = { ...current, soulsteelStabilized: true };
  } else if (receipt.action === DREAM_GATE_INTERPRETED_ACTION) {
    next = { ...current, dreamGateInterpreted: true };
  } else if (receipt.action === DREAM_FRAGMENT_ANCHORED_ACTION) {
    next = { ...current, dreamFragmentAnchored: true };
  } else if (receipt.action === ROUTE_ABUSE_NOTES_REVIEWED_ACTION) {
    if (receipt.inputs?.route_id === 'forgehold_route_slice_v1') {
      next = { ...current, forgeholdAbuseNotesReviewed: true };
    } else if (receipt.inputs?.route_id === 'moonspire_dream_gate_slice_v1') {
      next = { ...current, dreamGateAbuseNotesReviewed: true };
    }
  } else if (receipt.action === HEARTFORGE_GATE_PREPARED_ACTION) {
    next = { ...current, heartforgeGatePrepared: true };
  } else if (receipt.action === DREAM_GATE_SEAL_PREPARED_ACTION) {
    next = { ...current, dreamGateSealPrepared: true };
  }

  if (next) setProgress(playerId, next);
}
