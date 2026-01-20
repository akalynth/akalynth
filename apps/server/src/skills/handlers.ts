// Skills v0: Per-Skill Handlers
// Each handler implements utility/admin functionality using existing primitives

import type { SkillContext, SkillResult } from './index.js';
import { PLAYER_REPORTED_ACTION } from '../../../../packages/shared/skills.js';
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
