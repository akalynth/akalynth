import type { AuditReceipt } from '../../../../packages/shared/types.js';
import {
  DREAM_GATE_INTERPRETED_ACTION,
  FORGEHOLD_SHIPMENT_INVESTIGATED_ACTION,
  ROUTE_SURVEYED_ACTION,
  SOULSTEEL_STABILIZED_ACTION,
} from '../../../../packages/shared/skills.js';

export interface OnwardRouteReceiptProgress {
  forgeholdSurveyed: boolean;
  forgeholdShipmentInvestigated: boolean;
  soulsteelStabilized: boolean;
  moonspireSurveyed: boolean;
  dreamGateInterpreted: boolean;
}

function defaultProgress(): OnwardRouteReceiptProgress {
  return {
    forgeholdSurveyed: false,
    forgeholdShipmentInvestigated: false,
    soulsteelStabilized: false,
    moonspireSurveyed: false,
    dreamGateInterpreted: false,
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
  } else if (receipt.action === SOULSTEEL_STABILIZED_ACTION) {
    next = { ...current, soulsteelStabilized: true };
  } else if (receipt.action === DREAM_GATE_INTERPRETED_ACTION) {
    next = { ...current, dreamGateInterpreted: true };
  }

  if (next) setProgress(playerId, next);
}
