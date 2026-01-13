// Akalynth Moderation v1
// Admin-only moderation queue handlers (DEBUG gated)

import type { WebSocket } from 'ws';
import type {
  GetModReportsMessage,
  ModResolveMessage,
  ModerationReport,
  ModerationResolution,
} from '../../../../packages/shared/protocol.js';
import { ServerMessages } from '../../../../packages/shared/protocol.js';
import { MODERATION_RESOLVED_ACTION } from '../../../../packages/shared/skills.js';
import type { ModerationReportRow } from '../persist/types.js';

// ============================================================================
// Types
// ============================================================================

export interface ModerationContext {
  playerId: string;
  ws: WebSocket;
  // DEBUG flag check
  isDebugMode: boolean;
  // Audit write function
  audit: (receipt: {
    player_id: string;
    action: string;
    inputs: Record<string, unknown>;
    result: string;
  }) => void;
  // Persistence queries
  getModerationReports: (
    status?: 'open' | 'resolved' | 'all',
    limit?: number
  ) => ModerationReportRow[];
  getModerationReportByCaseId: (caseId: string) => ModerationReportRow | null;
  // Send message
  send: (msg: unknown) => void;
}

// ============================================================================
// Row → Wire Converter
// ============================================================================

function rowToWire(row: ModerationReportRow): ModerationReport {
  return {
    case_id: row.case_id,
    reporter_id: row.reporter_id,
    target_id: row.target_id,
    reported_at: row.reported_at,
    status: row.status as 'open' | 'resolved',
    resolved_by: row.resolved_by ?? undefined,
    resolved_at: row.resolved_at ?? undefined,
    resolution: row.resolution as ModerationResolution | undefined,
    reason: row.reason ?? undefined,
  };
}

// ============================================================================
// Handlers
// ============================================================================

/**
 * Handle get_mod_reports: List moderation reports (DEBUG only).
 */
export function handleGetModReports(
  ctx: ModerationContext,
  msg: GetModReportsMessage
): void {
  // Gate behind DEBUG mode
  if (!ctx.isDebugMode) {
    ctx.send(ServerMessages.modReportsSnapshot([], false));
    return;
  }

  const status = msg.status ?? 'open';
  const limit = msg.limit ?? 50;

  const rows = ctx.getModerationReports(status, limit);
  const reports = rows.map(rowToWire);

  // has_more is true if we hit the limit (simple heuristic)
  const hasMore = reports.length >= limit;

  ctx.send(ServerMessages.modReportsSnapshot(reports, hasMore));
}

/**
 * Handle mod_resolve: Resolve a moderation report (DEBUG only).
 */
export function handleModResolve(
  ctx: ModerationContext,
  msg: ModResolveMessage
): void {
  // Gate behind DEBUG mode
  if (!ctx.isDebugMode) {
    ctx.send(ServerMessages.modResolveResult(msg.case_id, false, 'not_authorized'));
    return;
  }

  // Validate resolution type
  const validResolutions: ModerationResolution[] = ['no_action', 'warning', 'temp_mute'];
  if (!validResolutions.includes(msg.resolution)) {
    ctx.send(ServerMessages.modResolveResult(msg.case_id, false, 'invalid_resolution'));
    return;
  }

  // Check if report exists
  const report = ctx.getModerationReportByCaseId(msg.case_id);
  if (!report) {
    ctx.send(ServerMessages.modResolveResult(msg.case_id, false, 'not_found'));
    return;
  }

  // Check if already resolved
  if (report.status === 'resolved') {
    ctx.send(ServerMessages.modResolveResult(msg.case_id, false, 'already_resolved'));
    return;
  }

  // Emit moderation_resolved receipt
  // This will be materialized by the persistence layer
  ctx.audit({
    player_id: ctx.playerId,
    action: MODERATION_RESOLVED_ACTION,
    inputs: {
      case_id: msg.case_id,
      target_id: report.target_id,
      reporter_id: report.reporter_id,
      resolution: msg.resolution,
      reason: msg.reason ?? null,
    },
    result: 'ok',
  });

  // Send success result
  ctx.send(ServerMessages.modResolveResult(msg.case_id, true));
}
