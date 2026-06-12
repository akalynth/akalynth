// Skills v0: Per-Skill Handlers
// Each handler implements utility/admin functionality using existing primitives

import type { SkillContext, SkillResult } from './index.js';
import {
  ASHGLASS_EVIDENCE_RECOVERED_ACTION,
  DREAM_FRAGMENT_ANCHORED_ACTION,
  DREAM_GATE_ARRIVAL_RECORDED_ACTION,
  FORGEHOLD_COMPONENT_PAYOUT_CREDITED_ACTION,
  FORGEHOLD_COMPONENT_SETTLED_ACTION,
  FORGEHOLD_ECONOMY_QUOTED_ACTION,
  HEARTFORGE_GATE_PREPARED_ACTION,
  DREAM_GATE_SEAL_PREPARED_ACTION,
  DREAM_GATE_TRAVERSAL_AUTHORIZED_ACTION,
  PLAYER_REPORTED_ACTION,
  ROUTE_ABUSE_NOTES_REVIEWED_ACTION,
  ROUTE_SURVEYED_ACTION,
  SOULSTEEL_COMPONENT_MINTED_ACTION,
  SOULSTEEL_REFINEMENT_AUTHORIZED_ACTION,
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
  const routeProgress = ctx.getOnwardRouteProgress?.();
  if (route === 'forgehold' && routeProgress?.forgeholdSurveyed) return { success: false, reason: 'invalid_target' };
  if (route === 'moonspire' && routeProgress?.moonspireSurveyed) return { success: false, reason: 'invalid_target' };

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
  if (routeProgress.soulsteelStabilized) return { success: false, reason: 'invalid_target' };

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
      next_objective: 'Prepare the Heartforge Trial server gate, then recover Ashglass evidence before refinement.',
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
  if (routeProgress.forgeholdEconomyQuoted) return { success: false, reason: 'invalid_target' };

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

export function handleForgeholdComponentSettlement(ctx: SkillContext): SkillResult {
  if (!ctx.onwardRoutesAvailable) return { success: false, reason: 'invalid_target' };
  const routeProgress = ctx.getOnwardRouteProgress?.();
  if (!routeProgress?.soulsteelComponentMinted) return { success: false, reason: 'invalid_target' };
  if (routeProgress.forgeholdComponentSettled) return { success: false, reason: 'invalid_target' };

  const settledAt = new Date().toISOString();
  const settlementId = 'forgehold_soulsteel_component_settlement_v1';
  const appraisedValueGold = 25;
  const settlementGuard = {
    wallet_debit_gold: 0,
    wallet_credit_gold: 0,
    direct_wallet_mutation: false,
    item_transfer: false,
    travel_unlocked: false,
    heat_changed: false,
    penalty_applied: false,
  };

  ctx.audit({
    player_id: ctx.playerId,
    action: FORGEHOLD_COMPONENT_SETTLED_ACTION,
    inputs: {
      route_id: 'forgehold_route_slice_v1',
      settlement_id: settlementId,
      item_type: 'refined_soulsteel_component',
      required_component: SOULSTEEL_COMPONENT_MINTED_ACTION,
      appraised_value_gold: appraisedValueGold,
      settlement_state: 'ledgered',
      source_drop: 'drop/AKALYNTH_FORGEHOLD_ROUTE_SLICE_V1',
      settled_at: settledAt,
      settlement_guard: settlementGuard,
      economy_impact: 'valuation_only',
    },
    result: 'ok',
  });

  return {
    success: true,
    payload: {
      route_id: 'forgehold_route_slice_v1',
      settlement_id: settlementId,
      title: 'Forgehold Soulsteel Ledger',
      status: 'ledgered',
      item_type: 'refined_soulsteel_component',
      required_component: SOULSTEEL_COMPONENT_MINTED_ACTION,
      appraised_value_gold: appraisedValueGold,
      settlement_state: 'ledgered',
      next_objective: 'Forgehold component settlement is ledgered without unreceipted wallet mutation.',
      source_drop: 'drop/AKALYNTH_FORGEHOLD_ROUTE_SLICE_V1',
      receipt_action: FORGEHOLD_COMPONENT_SETTLED_ACTION,
      settlement_guard: settlementGuard,
      economy_impact: 'valuation_only',
    },
  };
}

export function handleForgeholdComponentPayout(ctx: SkillContext): SkillResult {
  if (!ctx.onwardRoutesAvailable) return { success: false, reason: 'invalid_target' };
  const routeProgress = ctx.getOnwardRouteProgress?.();
  if (!routeProgress?.forgeholdComponentSettled) return { success: false, reason: 'invalid_target' };
  if (routeProgress.forgeholdComponentPayoutCredited) return { success: false, reason: 'invalid_target' };
  if (!ctx.creditWallet) return { success: false, reason: 'invalid_target' };

  const creditedAt = new Date().toISOString();
  const settlementId = 'forgehold_soulsteel_component_settlement_v1';
  const payoutId = 'forgehold_soulsteel_component_payout_v1';
  const amount = 25;
  const reason = `forgehold_payout:${settlementId}`;
  const credit = ctx.creditWallet(amount, reason, 'forgehold_route');
  const payoutGuard = {
    wallet_debit_gold: 0,
    wallet_credit_gold: amount,
    direct_wallet_mutation: false,
    item_transfer: false,
    travel_unlocked: false,
    heat_changed: false,
    penalty_applied: false,
  };

  ctx.audit({
    player_id: ctx.playerId,
    action: FORGEHOLD_COMPONENT_PAYOUT_CREDITED_ACTION,
    inputs: {
      route_id: 'forgehold_route_slice_v1',
      payout_id: payoutId,
      settlement_id: settlementId,
      item_type: 'refined_soulsteel_component',
      required_settlement: FORGEHOLD_COMPONENT_SETTLED_ACTION,
      wallet_credit_gold: amount,
      wallet_credit_reason: reason,
      balance_gold: credit.balance_gold,
      source_drop: 'drop/AKALYNTH_FORGEHOLD_ROUTE_SLICE_V1',
      credited_at: creditedAt,
      payout_guard: payoutGuard,
      economy_impact: 'wallet_credit',
    },
    result: 'ok',
  });

  return {
    success: true,
    payload: {
      route_id: 'forgehold_route_slice_v1',
      payout_id: payoutId,
      settlement_id: settlementId,
      title: 'Forgehold Soulsteel Payout',
      status: 'credited',
      item_type: 'refined_soulsteel_component',
      required_settlement: FORGEHOLD_COMPONENT_SETTLED_ACTION,
      wallet_credit_gold: amount,
      wallet_credit_reason: reason,
      balance_gold: credit.balance_gold,
      next_objective: 'Forgehold payout is credited by wallet receipt and the component remains server-traceable.',
      source_drop: 'drop/AKALYNTH_FORGEHOLD_ROUTE_SLICE_V1',
      receipt_action: FORGEHOLD_COMPONENT_PAYOUT_CREDITED_ACTION,
      payout_guard: payoutGuard,
      economy_impact: 'wallet_credit',
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
  if (route === 'forgehold' && routeProgress?.forgeholdAbuseNotesReviewed) {
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
    ? 'Prepare the Heartforge Trial server gate without unlocking travel yet.'
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
  if (routeProgress.heartforgeGatePrepared) return { success: false, reason: 'invalid_target' };

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
      next_objective: 'Recover Ashglass evidence before any Soulsteel refinement can be server-authorized.',
      source_drop: 'drop/AKALYNTH_FORGEHOLD_ROUTE_SLICE_V1',
      receipt_action: HEARTFORGE_GATE_PREPARED_ACTION,
      travel_unlocked: false,
      economy_impact: 'none',
    },
  };
}

export function handleAshglassEvidenceRecovery(ctx: SkillContext): SkillResult {
  if (!ctx.onwardRoutesAvailable) return { success: false, reason: 'invalid_target' };
  const routeProgress = ctx.getOnwardRouteProgress?.();
  if (!routeProgress?.heartforgeGatePrepared) return { success: false, reason: 'invalid_target' };
  if (routeProgress.ashglassEvidenceRecovered) return { success: false, reason: 'invalid_target' };

  const recoveredAt = new Date().toISOString();
  const evidenceObjects = ['ashglass_shard', 'tempered_slag_trace'];
  const refinementGuard = {
    item_mint: false,
    wallet_debit_gold: 0,
    wallet_credit_gold: 0,
    travel_unlocked: false,
  };

  ctx.audit({
    player_id: ctx.playerId,
    action: ASHGLASS_EVIDENCE_RECOVERED_ACTION,
    inputs: {
      route_id: 'forgehold_route_slice_v1',
      evidence_id: 'heartforge_ashglass_evidence_v1',
      evidence_objects: evidenceObjects,
      required_gate: HEARTFORGE_GATE_PREPARED_ACTION,
      source_drop: 'drop/AKALYNTH_FORGEHOLD_ROUTE_SLICE_V1',
      recovered_at: recoveredAt,
      refinement_guard: refinementGuard,
      travel_unlocked: false,
      economy_impact: 'none',
    },
    result: 'ok',
  });

  return {
    success: true,
    payload: {
      route_id: 'forgehold_route_slice_v1',
      evidence_id: 'heartforge_ashglass_evidence_v1',
      title: 'Heartforge Ashglass Evidence',
      status: 'recovered',
      evidence_objects: evidenceObjects,
      required_gate: HEARTFORGE_GATE_PREPARED_ACTION,
      next_objective: 'Hold the recovered Ashglass evidence until Soulsteel refinement is server-authorized.',
      source_drop: 'drop/AKALYNTH_FORGEHOLD_ROUTE_SLICE_V1',
      receipt_action: ASHGLASS_EVIDENCE_RECOVERED_ACTION,
      refinement_guard: refinementGuard,
      travel_unlocked: false,
      economy_impact: 'none',
    },
  };
}

export function handleSoulsteelRefinementAuthorization(ctx: SkillContext): SkillResult {
  if (!ctx.onwardRoutesAvailable) return { success: false, reason: 'invalid_target' };
  const routeProgress = ctx.getOnwardRouteProgress?.();
  if (!routeProgress?.ashglassEvidenceRecovered) return { success: false, reason: 'invalid_target' };
  if (routeProgress.soulsteelRefinementAuthorized) return { success: false, reason: 'invalid_target' };

  const authorizedAt = new Date().toISOString();
  const refinementId = 'soulsteel_refinement_authorization_v1';
  const requiredEvidence = ['soulsteel_stabilized', 'ashglass_evidence_recovered'];
  const refinementGuard = {
    item_mint: false,
    wallet_debit_gold: 0,
    wallet_credit_gold: 0,
    travel_unlocked: false,
  };

  ctx.audit({
    player_id: ctx.playerId,
    action: SOULSTEEL_REFINEMENT_AUTHORIZED_ACTION,
    inputs: {
      route_id: 'forgehold_route_slice_v1',
      refinement_id: refinementId,
      required_evidence: requiredEvidence,
      source_drop: 'drop/AKALYNTH_FORGEHOLD_ROUTE_SLICE_V1',
      authorized_at: authorizedAt,
      refinement_guard: refinementGuard,
      item_minted: false,
      travel_unlocked: false,
      economy_impact: 'none',
    },
    result: 'ok',
  });

  return {
    success: true,
    payload: {
      route_id: 'forgehold_route_slice_v1',
      refinement_id: refinementId,
      title: 'Soulsteel Refinement Authorization',
      status: 'authorized',
      required_evidence: requiredEvidence,
      next_objective: 'Mint the refined Soulsteel component under server inventory receipts.',
      source_drop: 'drop/AKALYNTH_FORGEHOLD_ROUTE_SLICE_V1',
      receipt_action: SOULSTEEL_REFINEMENT_AUTHORIZED_ACTION,
      refinement_guard: refinementGuard,
      item_minted: false,
      travel_unlocked: false,
      economy_impact: 'none',
    },
  };
}

export function handleSoulsteelComponentMint(ctx: SkillContext): SkillResult {
  if (!ctx.onwardRoutesAvailable) return { success: false, reason: 'invalid_target' };
  const routeProgress = ctx.getOnwardRouteProgress?.();
  if (!routeProgress?.soulsteelRefinementAuthorized) return { success: false, reason: 'invalid_target' };
  if (routeProgress.soulsteelComponentMinted) return { success: false, reason: 'invalid_target' };
  if (!ctx.mintItemToInventory) return { success: false, reason: 'invalid_target' };

  const mintedAt = new Date().toISOString();
  const itemType = 'refined_soulsteel_component';
  const mint = ctx.mintItemToInventory(
    itemType,
    {
      source: 'forgehold_route_slice_v1',
      crafting_id: 'soulsteel_refinement_authorization_v1',
      quality: 'refined',
    },
    'forgehold_soulsteel_refinement',
    'forgehold_route'
  );

  ctx.audit({
    player_id: ctx.playerId,
    action: SOULSTEEL_COMPONENT_MINTED_ACTION,
    inputs: {
      route_id: 'forgehold_route_slice_v1',
      item_id: mint.item_id,
      item_type: mint.item_type,
      required_refinement: SOULSTEEL_REFINEMENT_AUTHORIZED_ACTION,
      source_drop: 'drop/AKALYNTH_FORGEHOLD_ROUTE_SLICE_V1',
      minted_at: mintedAt,
      wallet_debit_gold: 0,
      wallet_credit_gold: 0,
      travel_unlocked: false,
      economy_impact: 'item_mint_only',
    },
    result: 'ok',
  });

  ctx.syncInventory?.();

  return {
    success: true,
    payload: {
      route_id: 'forgehold_route_slice_v1',
      item_id: mint.item_id,
      item_type: mint.item_type,
      title: 'Refined Soulsteel Component',
      status: 'minted',
      required_refinement: SOULSTEEL_REFINEMENT_AUTHORIZED_ACTION,
      next_objective: 'Carry the minted Soulsteel component as the first Forgehold crafting reward.',
      source_drop: 'drop/AKALYNTH_FORGEHOLD_ROUTE_SLICE_V1',
      receipt_action: SOULSTEEL_COMPONENT_MINTED_ACTION,
      wallet_debit_gold: 0,
      wallet_credit_gold: 0,
      travel_unlocked: false,
      economy_impact: 'item_mint_only',
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

export function handleDreamGateTraversalAuthorization(ctx: SkillContext): SkillResult {
  if (!ctx.onwardRoutesAvailable) return { success: false, reason: 'invalid_target' };
  const routeProgress = ctx.getOnwardRouteProgress?.();
  if (!routeProgress?.dreamGateSealPrepared) return { success: false, reason: 'invalid_target' };

  const authorizedAt = new Date().toISOString();
  const traversalId = 'moonspire_dream_gate_traversal_authorization_v1';
  const authorityGuard = {
    client_position_authority: false,
    client_map_transition: false,
    wallet_debit_gold: 0,
    wallet_credit_gold: 0,
    item_mint: false,
    heat_changed: false,
    penalty_applied: false,
  };

  ctx.audit({
    player_id: ctx.playerId,
    action: DREAM_GATE_TRAVERSAL_AUTHORIZED_ACTION,
    inputs: {
      route_id: 'moonspire_dream_gate_slice_v1',
      traversal_id: traversalId,
      required_seal: DREAM_GATE_SEAL_PREPARED_ACTION,
      source_drop: 'drop/AKALYNTH_MOONSPIRE_DREAM_GATE_SLICE_V1',
      authorized_at: authorizedAt,
      traversal_authorized: true,
      authority_guard: authorityGuard,
      economy_impact: 'none',
    },
    result: 'ok',
  });

  return {
    success: true,
    payload: {
      route_id: 'moonspire_dream_gate_slice_v1',
      traversal_id: traversalId,
      title: 'Moonspire Dream Gate Traversal',
      status: 'authorized',
      required_seal: DREAM_GATE_SEAL_PREPARED_ACTION,
      next_objective: 'Dream Gate traversal is server-authorized; client movement remains intent-only.',
      source_drop: 'drop/AKALYNTH_MOONSPIRE_DREAM_GATE_SLICE_V1',
      receipt_action: DREAM_GATE_TRAVERSAL_AUTHORIZED_ACTION,
      traversal_authorized: true,
      authority_guard: authorityGuard,
      economy_impact: 'none',
    },
  };
}

export function handleDreamGateArrivalRecord(ctx: SkillContext): SkillResult {
  if (!ctx.onwardRoutesAvailable) return { success: false, reason: 'invalid_target' };
  const routeProgress = ctx.getOnwardRouteProgress?.();
  if (!routeProgress?.dreamGateTraversalAuthorized) return { success: false, reason: 'invalid_target' };

  const arrivedAt = new Date().toISOString();
  const arrivalId = 'moonspire_dream_gate_threshold_arrival_v1';
  const authorityGuard = {
    client_position_authority: false,
    client_map_transition: false,
    wallet_debit_gold: 0,
    wallet_credit_gold: 0,
    item_mint: false,
    heat_changed: false,
    penalty_applied: false,
  };

  ctx.audit({
    player_id: ctx.playerId,
    action: DREAM_GATE_ARRIVAL_RECORDED_ACTION,
    inputs: {
      route_id: 'moonspire_dream_gate_slice_v1',
      arrival_id: arrivalId,
      dream_phase: 'threshold',
      arrival_state: 'witnessed',
      required_traversal: DREAM_GATE_TRAVERSAL_AUTHORIZED_ACTION,
      source_drop: 'drop/AKALYNTH_MOONSPIRE_DREAM_GATE_SLICE_V1',
      arrived_at: arrivedAt,
      server_transition_recorded: true,
      authority_guard: authorityGuard,
      economy_impact: 'none',
    },
    result: 'ok',
  });

  return {
    success: true,
    payload: {
      route_id: 'moonspire_dream_gate_slice_v1',
      arrival_id: arrivalId,
      title: 'Moonspire Dream Gate Threshold',
      status: 'arrived',
      dream_phase: 'threshold',
      arrival_state: 'witnessed',
      required_traversal: DREAM_GATE_TRAVERSAL_AUTHORIZED_ACTION,
      next_objective: 'Dream Gate threshold arrival is recorded by server receipts; client movement remains intent-only.',
      source_drop: 'drop/AKALYNTH_MOONSPIRE_DREAM_GATE_SLICE_V1',
      receipt_action: DREAM_GATE_ARRIVAL_RECORDED_ACTION,
      server_transition_recorded: true,
      authority_guard: authorityGuard,
      economy_impact: 'none',
    },
  };
}

export function handleForgeholdShipmentInvestigation(ctx: SkillContext): SkillResult {
  if (!ctx.onwardRoutesAvailable) return { success: false, reason: 'invalid_target' };
  const routeProgress = ctx.getOnwardRouteProgress?.();
  if (!routeProgress?.forgeholdSurveyed) return { success: false, reason: 'invalid_target' };
  if (routeProgress.forgeholdShipmentInvestigated) return { success: false, reason: 'invalid_target' };

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
