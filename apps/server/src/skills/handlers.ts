// Skills v0: Per-Skill Handlers
// Each handler implements utility/admin functionality using existing primitives

import type { SkillContext, SkillResult } from './index.js';
import {
  DREAM_FRAGMENT_ANCHORED_ACTION,
  FORGEHOLD_ECONOMY_QUOTED_ACTION,
  HEARTFORGE_GATE_PREPARED_ACTION,
  DREAM_GATE_SEAL_PREPARED_ACTION,
  PLAYER_REPORTED_ACTION,
  ROUTE_ABUSE_NOTES_REVIEWED_ACTION,
  ROUTE_SURVEYED_ACTION,
  SOULSTEEL_STABILIZED_ACTION,
  DREAM_GATE_INTERPRETED_ACTION,
  FORGEHOLD_SHIPMENT_INVESTIGATED_ACTION,
} from '../../../../packages/shared/skills.js';
import { createHash } from 'node:crypto';

// ============================================================================
// skill_inspect: Snapshot player state (read-only, redacted)
// ============================================================================

export function handleInspect(ctx: SkillContext, targetId: string): SkillResult {
  const target = ctx.findPlayerOnline(targetId);
  if (!target) {
    return { success: false, reason: 'target_not_found' };
  }

  // Redacted snapshot - safe fields only
  // NO: IPs, device ids, inventory, capability tokens, moderation data
  const payload: Record<string, unknown> = {
    target_id: target.id,
    name: target.name,
    pos: {
      x: target.x,
      y: target.y,
    },
    status: {
      alive: target.status === 'alive',
      in_world: target.state === 'in_world',
    },
    reputation: target.reputation ?? 0,
    // Cosmetics are public
    title: target.title ?? null,
    badges: target.badges ?? [],
    mark: target.mark ?? null,
  };

  return { success: true, payload };
}

// ============================================================================
// skill_ping_tem: Force Tem challenge on self (DEBUG only)
// ============================================================================

export function handlePingTem(ctx: SkillContext): SkillResult {
  // Issue Tem challenge using the same path as speed violation
  const now = Date.now();
  const out = ctx.issueTem(ctx.antiState, now);

  if (out.outcome === 'issued' && out.challenge) {
    // Send the Tem challenge message
    ctx.send({
      type: 'tem_challenge',
      challenge_id: out.challenge.challenge_id,
      message: out.challenge.message,
      timeout_seconds: out.challenge.timeout_seconds,
    });

    // Emit tem_challenge_issued receipt (existing pattern)
    ctx.audit({
      player_id: ctx.playerId,
      action: 'tem_challenge_issued',
      inputs: { trigger: 'manual_ping', score: 0 },
      result: 'challenge_sent',
    });

    return {
      success: true,
      payload: {
        issued: true,
        trigger: 'manual_ping',
        challenge_kind: 'tem_challenge',
      },
    };
  }

  // Tem was already active or couldn't issue
  return {
    success: true,
    payload: {
      issued: false,
      reason: 'tem_already_active',
    },
  };
}

// ============================================================================
// skill_request_recap: Request chronicle recap
// ============================================================================

export function handleRequestRecap(ctx: SkillContext): SkillResult {
  // Get chronicle events using existing persistence
  const events = ctx.getChronicle(ctx.playerId, 50);

  return {
    success: true,
    payload: {
      recap: events.length > 0 ? 'delivered' : 'empty',
      event_count: events.length,
    },
  };
}

// ============================================================================
// skill_report: Report player for moderation
// ============================================================================

export function handleReport(ctx: SkillContext, targetId: string): SkillResult {
  const target = ctx.findPlayerOnline(targetId);
  if (!target) {
    return { success: false, reason: 'target_not_found' };
  }

  // Generate case ID from reporter + target + timestamp
  const ts = new Date().toISOString();
  const caseId = `rpt_${createHash('sha256')
    .update(`${ctx.playerId}:${targetId}:${ts}`)
    .digest('hex')
    .slice(0, 16)}`;

  // Emit player_reported receipt (the key audit scar)
  ctx.audit({
    player_id: ctx.playerId,
    action: PLAYER_REPORTED_ACTION,
    inputs: {
      reporter_id: ctx.playerId,
      target_id: targetId,
      target_name: target.name,
      case_id: caseId,
      timestamp: ts,
    },
    result: 'reported',
  });

  return {
    success: true,
    payload: {
      reported: true,
      target_id: targetId,
      case_id: caseId,
    },
  };
}

// ============================================================================
// route:survey:*: First onward-route interaction (read-only, receipt-backed)
// ============================================================================

export function handleRouteSurvey(ctx: SkillContext, route: 'forgehold' | 'moonspire'): SkillResult {
  if (!ctx.onwardRoutesAvailable) return { success: false, reason: 'invalid_target' };

  const surveyedAt = new Date().toISOString();
  const isForgehold = route === 'forgehold';
  const routeId = isForgehold ? 'forgehold_route_slice_v1' : 'moonspire_dream_gate_slice_v1';
  const title = isForgehold ? 'Forgehold Route' : 'Moonspire Dream Gate';
  const nextObjective = isForgehold
    ? 'Check the Ember Road shipment board, then stabilize cracked Soulsteel under server receipts.'
    : 'Read the first Dream Gate symbol clue, then wait for server-owned dream traversal.';
  const systems = isForgehold
    ? ['quest', 'economy', 'crafting', 'server', 'ui', 'android', 'anti_cheat']
    : ['quest', 'dream_gate', 'server', 'ui', 'android', 'anti_cheat'];
  const sourceDrop = isForgehold
    ? 'drop/AKALYNTH_FORGEHOLD_ROUTE_SLICE_V1'
    : 'drop/AKALYNTH_MOONSPIRE_DREAM_GATE_SLICE_V1';

  ctx.audit({
    player_id: ctx.playerId,
    action: ROUTE_SURVEYED_ACTION,
    inputs: {
      route_id: routeId,
      source_drop: sourceDrop,
      surveyed_at: surveyedAt,
      systems,
    },
    result: 'ok',
  });

  return {
    success: true,
    payload: {
      route_id: routeId,
      title,
      status: 'surveyed',
      next_objective: nextObjective,
      source_drop: sourceDrop,
      systems,
      receipt_action: ROUTE_SURVEYED_ACTION,
    },
  };
}

export function handleSoulsteelStabilization(ctx: SkillContext): SkillResult {
  if (!ctx.onwardRoutesAvailable) return { success: false, reason: 'invalid_target' };
  const routeProgress = ctx.getOnwardRouteProgress?.();
  if (!routeProgress?.forgeholdSurveyed || !routeProgress.forgeholdShipmentInvestigated || !routeProgress.forgeholdEconomyQuoted) {
    return { success: false, reason: 'invalid_target' };
  }

  const craftedAt = new Date().toISOString();
  const quality = 'unstable';
  const requiredEvidence = ['charred_shipment_plate', 'ashglass_shard'];

  ctx.audit({
    player_id: ctx.playerId,
    action: SOULSTEEL_STABILIZED_ACTION,
    inputs: {
      route_id: 'forgehold_route_slice_v1',
      quality,
      required_evidence: requiredEvidence,
      required_economy_quote: FORGEHOLD_ECONOMY_QUOTED_ACTION,
      source_drop: 'drop/AKALYNTH_FORGEHOLD_ROUTE_SLICE_V1',
      crafted_at: craftedAt,
      economy_impact: 'none',
    },
    result: 'ok',
  });

  return {
    success: true,
    payload: {
      route_id: 'forgehold_route_slice_v1',
      crafting_id: 'soulsteel_stabilization_v1',
      item_type: 'stabilized_soulsteel_component',
      quality,
      status: 'stabilized',
      next_objective: 'Carry the unstable Soulsteel proof toward the Heartforge Trial chamber; refinement still requires evidence recovery.',
      required_evidence: requiredEvidence,
      required_economy_quote: FORGEHOLD_ECONOMY_QUOTED_ACTION,
      source_drop: 'drop/AKALYNTH_FORGEHOLD_ROUTE_SLICE_V1',
      receipt_action: SOULSTEEL_STABILIZED_ACTION,
      economy_impact: 'none',
    },
  };
}

export function handleForgeholdEconomyQuote(ctx: SkillContext): SkillResult {
  if (!ctx.onwardRoutesAvailable) return { success: false, reason: 'invalid_target' };
  const routeProgress = ctx.getOnwardRouteProgress?.();
  if (!routeProgress?.forgeholdSurveyed || !routeProgress.forgeholdShipmentInvestigated) {
    return { success: false, reason: 'invalid_target' };
  }

  const quotedAt = new Date().toISOString();
  const quoteId = 'forgehold_soulsteel_quote_v1';
  const economyGuard = {
    wallet_debit_gold: 0,
    wallet_credit_gold: 0,
    item_mint: false,
    item_transfer: false,
  };

  ctx.audit({
    player_id: ctx.playerId,
    action: FORGEHOLD_ECONOMY_QUOTED_ACTION,
    inputs: {
      route_id: 'forgehold_route_slice_v1',
      quote_id: quoteId,
      crafting_id: 'soulsteel_stabilization_v1',
      source_drop: 'drop/AKALYNTH_FORGEHOLD_ROUTE_SLICE_V1',
      quoted_at: quotedAt,
      economy_guard: economyGuard,
      economy_impact: 'none',
    },
    result: 'ok',
  });

  return {
    success: true,
    payload: {
      route_id: 'forgehold_route_slice_v1',
      quote_id: quoteId,
      crafting_id: 'soulsteel_stabilization_v1',
      title: 'Forgehold Economy Quote',
      status: 'quoted',
      next_objective: 'Stabilize cracked Soulsteel under the quoted no-mint, no-debit economy guard.',
      source_drop: 'drop/AKALYNTH_FORGEHOLD_ROUTE_SLICE_V1',
      receipt_action: FORGEHOLD_ECONOMY_QUOTED_ACTION,
      economy_guard: economyGuard,
      economy_impact: 'none',
    },
  };
}

export function handleDreamGateInterpretation(ctx: SkillContext): SkillResult {
  if (!ctx.onwardRoutesAvailable) return { success: false, reason: 'invalid_target' };
  const routeProgress = ctx.getOnwardRouteProgress?.();
  if (!routeProgress?.moonspireSurveyed) return { success: false, reason: 'invalid_target' };

  const interpretedAt = new Date().toISOString();
  const symbols = ['Door', 'Mirror', 'Water'];
  const meanings = ['boundary', 'self-recognition', 'hidden memory'];
  const requiredFragments = ['silver_thread', 'emotional_residue'];

  ctx.audit({
    player_id: ctx.playerId,
    action: DREAM_GATE_INTERPRETED_ACTION,
    inputs: {
      route_id: 'moonspire_dream_gate_slice_v1',
      gate_state: 'interpreted',
      symbols,
      meanings,
      required_fragments: requiredFragments,
      source_drop: 'drop/AKALYNTH_MOONSPIRE_DREAM_GATE_SLICE_V1',
      interpreted_at: interpretedAt,
      traversal_granted: false,
      economy_impact: 'none',
    },
    result: 'ok',
  });

  return {
    success: true,
    payload: {
      route_id: 'moonspire_dream_gate_slice_v1',
      interpretation_id: 'dream_gate_symbolic_interpretation_v1',
      gate_state: 'interpreted',
      status: 'interpreted',
      symbols,
      meanings,
      required_fragments: requiredFragments,
      next_objective: 'Anchor the interpreted symbols before any Dream Gate traversal can be server-authorized.',
      source_drop: 'drop/AKALYNTH_MOONSPIRE_DREAM_GATE_SLICE_V1',
      receipt_action: DREAM_GATE_INTERPRETED_ACTION,
      traversal_granted: false,
      economy_impact: 'none',
    },
  };
}

export function handleDreamFragmentAnchor(ctx: SkillContext): SkillResult {
  if (!ctx.onwardRoutesAvailable) return { success: false, reason: 'invalid_target' };
  const routeProgress = ctx.getOnwardRouteProgress?.();
  if (!routeProgress?.moonspireSurveyed || !routeProgress.dreamGateInterpreted) {
    return { success: false, reason: 'invalid_target' };
  }

  const anchoredAt = new Date().toISOString();
  const fragmentId = 'moonspire_emotional_residue_fragment_v1';
  const evidenceObjects = ['silver_thread', 'emotional_residue'];

  ctx.audit({
    player_id: ctx.playerId,
    action: DREAM_FRAGMENT_ANCHORED_ACTION,
    inputs: {
      route_id: 'moonspire_dream_gate_slice_v1',
      fragment_id: fragmentId,
      evidence_objects: evidenceObjects,
      source_drop: 'drop/AKALYNTH_MOONSPIRE_DREAM_GATE_SLICE_V1',
      anchored_at: anchoredAt,
      traversal_granted: false,
      economy_impact: 'none',
    },
    result: 'ok',
  });

  return {
    success: true,
    payload: {
      route_id: 'moonspire_dream_gate_slice_v1',
      fragment_id: fragmentId,
      title: 'Moonspire Dream Fragment',
      status: 'anchored',
      evidence_objects: evidenceObjects,
      next_objective: 'Hold the anchored dream fragment until traversal is server-authorized.',
      source_drop: 'drop/AKALYNTH_MOONSPIRE_DREAM_GATE_SLICE_V1',
      receipt_action: DREAM_FRAGMENT_ANCHORED_ACTION,
      traversal_granted: false,
      economy_impact: 'none',
    },
  };
}

export function handleRouteSafetyReview(ctx: SkillContext, route: 'forgehold' | 'moonspire'): SkillResult {
  if (!ctx.onwardRoutesAvailable) return { success: false, reason: 'invalid_target' };
  const routeProgress = ctx.getOnwardRouteProgress?.();
  if (route === 'forgehold' && !routeProgress?.soulsteelStabilized) {
    return { success: false, reason: 'invalid_target' };
  }
  if (route === 'moonspire' && !routeProgress?.dreamFragmentAnchored) {
    return { success: false, reason: 'invalid_target' };
  }

  const reviewedAt = new Date().toISOString();
  const isForgehold = route === 'forgehold';
  const routeId = isForgehold ? 'forgehold_route_slice_v1' : 'moonspire_dream_gate_slice_v1';
  const title = isForgehold ? 'Forgehold Safety Boundary' : 'Dream Gate Safety Boundary';
  const boundaries = isForgehold
    ? ['server owns crafting results', 'server owns shipment claims', 'no client-owned item mint', 'no client-owned wallet movement']
    : ['server owns dream traversal', 'server owns fragment evidence', 'no client-owned gate state', 'no client-owned economy change'];
  const nextObjective = isForgehold
    ? 'Carry the unstable Soulsteel proof toward the Heartforge Trial chamber; refinement still requires evidence recovery.'
    : 'Prepare the Dream Gate server seal without granting traversal yet.';

  ctx.audit({
    player_id: ctx.playerId,
    action: ROUTE_ABUSE_NOTES_REVIEWED_ACTION,
    inputs: {
      route_id: routeId,
      reviewed_at: reviewedAt,
      boundaries,
      source_drop: isForgehold ? 'drop/AKALYNTH_FORGEHOLD_ROUTE_SLICE_V1' : 'drop/AKALYNTH_MOONSPIRE_DREAM_GATE_SLICE_V1',
      heat_changed: false,
      penalty_applied: false,
    },
    result: 'ok',
  });

  return {
    success: true,
    payload: {
      route_id: routeId,
      title,
      status: 'reviewed',
      next_objective: nextObjective,
      boundaries,
      receipt_action: ROUTE_ABUSE_NOTES_REVIEWED_ACTION,
      heat_changed: false,
      penalty_applied: false,
    },
  };
}

export function handleHeartforgeGatePreparation(ctx: SkillContext): SkillResult {
  if (!ctx.onwardRoutesAvailable) return { success: false, reason: 'invalid_target' };
  const routeProgress = ctx.getOnwardRouteProgress?.();
  if (!routeProgress?.forgeholdAbuseNotesReviewed) return { success: false, reason: 'invalid_target' };

  const preparedAt = new Date().toISOString();
  const gateId = 'heartforge_trial_server_gate_v1';

  ctx.audit({
    player_id: ctx.playerId,
    action: HEARTFORGE_GATE_PREPARED_ACTION,
    inputs: {
      route_id: 'forgehold_route_slice_v1',
      gate_id: gateId,
      required_proofs: ['soulsteel_stabilized', 'route_abuse_notes_reviewed'],
      source_drop: 'drop/AKALYNTH_FORGEHOLD_ROUTE_SLICE_V1',
      prepared_at: preparedAt,
      travel_unlocked: false,
      economy_impact: 'none',
    },
    result: 'ok',
  });

  return {
    success: true,
    payload: {
      route_id: 'forgehold_route_slice_v1',
      gate_id: gateId,
      title: 'Heartforge Trial Gate',
      status: 'prepared',
      required_proofs: ['soulsteel_stabilized', 'route_abuse_notes_reviewed'],
      next_objective: 'Carry the unstable Soulsteel proof toward the Heartforge Trial chamber; refinement still requires evidence recovery.',
      source_drop: 'drop/AKALYNTH_FORGEHOLD_ROUTE_SLICE_V1',
      receipt_action: HEARTFORGE_GATE_PREPARED_ACTION,
      travel_unlocked: false,
      economy_impact: 'none',
    },
  };
}

export function handleDreamGateSealPreparation(ctx: SkillContext): SkillResult {
  if (!ctx.onwardRoutesAvailable) return { success: false, reason: 'invalid_target' };
  const routeProgress = ctx.getOnwardRouteProgress?.();
  if (!routeProgress?.dreamGateAbuseNotesReviewed) return { success: false, reason: 'invalid_target' };

  const preparedAt = new Date().toISOString();
  const sealId = 'moonspire_dream_gate_server_seal_v1';
  const requiredProofs = ['dream_fragment_anchored', 'route_abuse_notes_reviewed'];

  ctx.audit({
    player_id: ctx.playerId,
    action: DREAM_GATE_SEAL_PREPARED_ACTION,
    inputs: {
      route_id: 'moonspire_dream_gate_slice_v1',
      seal_id: sealId,
      required_proofs: requiredProofs,
      source_drop: 'drop/AKALYNTH_MOONSPIRE_DREAM_GATE_SLICE_V1',
      prepared_at: preparedAt,
      traversal_granted: false,
      economy_impact: 'none',
    },
    result: 'ok',
  });

  return {
    success: true,
    payload: {
      route_id: 'moonspire_dream_gate_slice_v1',
      seal_id: sealId,
      title: 'Moonspire Dream Gate Seal',
      status: 'prepared',
      required_proofs: requiredProofs,
      next_objective: 'Hold the anchored dream fragment until traversal is server-authorized.',
      source_drop: 'drop/AKALYNTH_MOONSPIRE_DREAM_GATE_SLICE_V1',
      receipt_action: DREAM_GATE_SEAL_PREPARED_ACTION,
      traversal_granted: false,
      economy_impact: 'none',
    },
  };
}

export function handleForgeholdShipmentInvestigation(ctx: SkillContext): SkillResult {
  if (!ctx.onwardRoutesAvailable) return { success: false, reason: 'invalid_target' };
  const routeProgress = ctx.getOnwardRouteProgress?.();
  if (!routeProgress?.forgeholdSurveyed) return { success: false, reason: 'invalid_target' };

  const investigatedAt = new Date().toISOString();
  const evidenceObjects = ['broken_route_seal', 'charred_shipment_plate'];
  const contradiction = 'departed / undeparted';
  const routeState = 'investigating';

  ctx.audit({
    player_id: ctx.playerId,
    action: FORGEHOLD_SHIPMENT_INVESTIGATED_ACTION,
    inputs: {
      route_id: 'forgehold_route_slice_v1',
      act_id: 'act_01_missing_shipment',
      route_state: routeState,
      evidence_objects: evidenceObjects,
      contradiction,
      source_drop: 'drop/AKALYNTH_FORGEHOLD_ROUTE_SLICE_V1',
      investigated_at: investigatedAt,
      travel_unlocked: false,
      economy_impact: 'none',
    },
    result: 'ok',
  });

  return {
    success: true,
    payload: {
      route_id: 'forgehold_route_slice_v1',
      quest_id: 'forgehold_missing_shipment_v1',
      act_id: 'act_01_missing_shipment',
      route_state: routeState,
      status: 'investigating',
      evidence_objects: evidenceObjects,
      contradiction,
      next_objective: 'Recover Ashglass Shard evidence before any route reopening or Soulsteel refinement can be server-authorized.',
      source_drop: 'drop/AKALYNTH_FORGEHOLD_ROUTE_SLICE_V1',
      receipt_action: FORGEHOLD_SHIPMENT_INVESTIGATED_ACTION,
      travel_unlocked: false,
      economy_impact: 'none',
    },
  };
}
