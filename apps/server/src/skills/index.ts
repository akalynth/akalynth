// Skills v0: Utility/Admin Skills Handler
// Server-authoritative, receipt-driven, cooldown-gated

import type { WebSocket } from 'ws';
import type { Player, AntiCheatState } from '../../../../packages/shared/types.js';
import type { UseSkillMessage, SkillRejectionReason } from '../../../../packages/shared/protocol.js';
import { ServerMessages } from '../../../../packages/shared/protocol.js';
import {
  SKILL_REGISTRY,
  SKILL_USE_INTENT_ACTION,
  SKILL_RESOLVED_ACTION,
  SKILL_REJECTED_ACTION,
  isValidSkillId,
} from '../../../../packages/shared/skills.js';
import type { SkillId, SkillDefinition } from '../../../../packages/shared/skills.js';

import {
  handleInspect,
  handlePingTem,
  handleRequestRecap,
  handleReport,
  handleRouteSurvey,
  handleSoulsteelStabilization,
} from './handlers.js';

// ============================================================================
// Types
// ============================================================================

export interface SkillContext {
  playerId: string;
  playerName: string;
  ws: WebSocket;
  antiState: AntiCheatState;
  skillCooldowns: Map<string, number>;
  // Audit write function
  audit: (receipt: {
    player_id: string;
    action: string;
    inputs: Record<string, unknown>;
    result: string;
  }) => void;
  // Player lookup
  findPlayerOnline: (id: string) => Player | null;
  // Tem challenge issuer (returns TemOutcome from anticheat/tem.ts)
  issueTem: (state: AntiCheatState, now: number) => {
    outcome: 'none' | 'issued' | 'passed' | 'failed';
    challenge?: { challenge_id: string; message: string; timeout_seconds: number };
    reason?: string;
  };
  // Chronicle recap
  getChronicle: (playerId: string, limit: number) => unknown[];
  // Send message
  send: (msg: unknown) => void;
}

export interface SkillResult {
  success: boolean;
  reason?: SkillRejectionReason;
  payload?: Record<string, unknown>;
}

// ============================================================================
// Main Handler
// ============================================================================

export async function handleUseSkill(
  ctx: SkillContext,
  msg: UseSkillMessage
): Promise<void> {
  const now = Date.now();
  const skillId = msg.skill_id;

  // 1. Always emit intent receipt
  ctx.audit({
    player_id: ctx.playerId,
    action: SKILL_USE_INTENT_ACTION,
    inputs: { skill_id: skillId, target_id: msg.target_id },
    result: 'pending',
  });

  // 2. Validate skill exists
  if (!isValidSkillId(skillId)) {
    return rejectSkill(ctx, skillId, 'invalid_skill');
  }

  const skill = SKILL_REGISTRY[skillId];

  // 3. Check debug gate
  if (skill.debug_only && !process.env.DEBUG) {
    return rejectSkill(ctx, skillId, 'debug_only');
  }

  // 4. Validate target rules
  if (skill.target === 'player' && !msg.target_id) {
    return rejectSkill(ctx, skillId, 'invalid_target');
  }
  if (skill.target === 'player' && msg.target_id) {
    const target = ctx.findPlayerOnline(msg.target_id);
    if (!target) {
      return rejectSkill(ctx, skillId, 'target_not_found');
    }
  }

  // 5. Check cooldown
  const cooldownUntil = ctx.skillCooldowns.get(skillId) ?? 0;
  if (now < cooldownUntil) {
    return rejectSkill(ctx, skillId, 'cooldown', cooldownUntil);
  }

  // 6. Execute skill-specific logic
  const result = await executeSkill(ctx, skill, msg.target_id);

  if (!result.success) {
    return rejectSkill(ctx, skillId, result.reason ?? 'invalid_skill');
  }

  // 7. Set cooldown (only on success)
  const newCooldownUntil = now + skill.cooldown_ms;
  ctx.skillCooldowns.set(skillId, newCooldownUntil);

  // 8. Emit resolved receipt
  ctx.audit({
    player_id: ctx.playerId,
    action: SKILL_RESOLVED_ACTION,
    inputs: { skill_id: skillId, target_id: msg.target_id },
    result: 'ok',
  });

  // 9. Send success result
  ctx.send(ServerMessages.skillResult(skillId, true, {
    cooldown_until_ms: newCooldownUntil,
    payload: result.payload,
  }));
}

// ============================================================================
// Helpers
// ============================================================================

function rejectSkill(
  ctx: SkillContext,
  skillId: string,
  reason: SkillRejectionReason,
  cooldownUntil?: number
): void {
  // Emit rejected receipt
  ctx.audit({
    player_id: ctx.playerId,
    action: SKILL_REJECTED_ACTION,
    inputs: { skill_id: skillId, reason },
    result: reason,
  });

  // Send failure result
  ctx.send(ServerMessages.skillResult(skillId, false, {
    reason,
    cooldown_until_ms: cooldownUntil,
  }));
}

async function executeSkill(
  ctx: SkillContext,
  skill: SkillDefinition,
  targetId?: string
): Promise<SkillResult> {
  switch (skill.id) {
    case 'skill_inspect':
      return handleInspect(ctx, targetId!);

    case 'skill_ping_tem':
      return handlePingTem(ctx);

    case 'skill_request_recap':
      return handleRequestRecap(ctx);

    case 'skill_report':
      return handleReport(ctx, targetId!);

    case 'route:survey:forgehold':
      return handleRouteSurvey(ctx, 'forgehold');

    case 'route:survey:moonspire':
      return handleRouteSurvey(ctx, 'moonspire');

    case 'route:craft:soulsteel':
      return handleSoulsteelStabilization(ctx);

    default:
      return { success: false, reason: 'invalid_skill' };
  }
}
