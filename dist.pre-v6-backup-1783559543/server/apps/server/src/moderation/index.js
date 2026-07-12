// Akalynth Moderation v1
// Admin-only moderation queue handlers (DEBUG gated)
import { ServerMessages } from '../../../../packages/shared/protocol.js';
import { MODERATION_RESOLVED_ACTION } from '../../../../packages/shared/skills.js';
// ============================================================================
// Row → Wire Converter
// ============================================================================
function rowToWire(row) {
    return {
        case_id: row.case_id,
        receipt_hash: row.receipt_hash,
        reporter_id: row.reporter_id,
        target_id: row.target_id,
        reported_at: row.reported_at,
        status: row.status,
        resolved_by: row.resolved_by ?? undefined,
        resolved_at: row.resolved_at ?? undefined,
        resolution: row.resolution,
        reason: row.reason ?? undefined,
        resolution_receipt_hash: row.resolution_receipt_hash ?? undefined,
    };
}
// ============================================================================
// Handlers
// ============================================================================
/**
 * Handle get_mod_reports: List moderation reports (DEBUG only).
 */
export function handleGetModReports(ctx, msg) {
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
 * Accepts either receipt_hash (preferred) or case_id (legacy) as lookup key.
 */
export function handleModResolve(ctx, msg) {
    const lookupKey = msg.receipt_hash ?? msg.case_id ?? '';
    // Gate behind DEBUG mode
    if (!ctx.isDebugMode) {
        ctx.send(ServerMessages.modResolveResult(lookupKey, false, 'not_authorized'));
        return;
    }
    // Validate resolution type
    const validResolutions = ['no_action', 'warning', 'temp_mute'];
    if (!validResolutions.includes(msg.resolution)) {
        ctx.send(ServerMessages.modResolveResult(lookupKey, false, 'invalid_resolution'));
        return;
    }
    // Lookup report: prefer receipt_hash (canonical), fall back to case_id
    let report = null;
    if (msg.receipt_hash) {
        report = ctx.getModerationReportByReceiptHash(msg.receipt_hash);
    }
    else if (msg.case_id) {
        report = ctx.getModerationReportByCaseId(msg.case_id);
    }
    if (!report) {
        ctx.send(ServerMessages.modResolveResult(lookupKey, false, 'not_found'));
        return;
    }
    // Check if already resolved
    if (report.status === 'resolved') {
        ctx.send(ServerMessages.modResolveResult(lookupKey, false, 'already_resolved'));
        return;
    }
    // Emit moderation_resolved receipt
    // Include source_receipt_hash for evidence chain
    ctx.audit({
        player_id: ctx.playerId,
        action: MODERATION_RESOLVED_ACTION,
        inputs: {
            case_id: report.case_id,
            source_receipt_hash: report.receipt_hash,
            target_id: report.target_id,
            reporter_id: report.reporter_id,
            resolution: msg.resolution,
            reason: msg.reason ?? null,
        },
        result: 'ok',
    });
    // Send success result (use case_id for backwards compatibility)
    ctx.send(ServerMessages.modResolveResult(report.case_id, true));
}
