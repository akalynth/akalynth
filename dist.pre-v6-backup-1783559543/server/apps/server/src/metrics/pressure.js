// Akalynth Phase 5: Pressure Metrics
// Derived danger from existing truth — no new receipts, read-only
import { getChronicleRange, getDeathsRange, getPlayerHeatSummary, getSchemaVersion, } from '../persist/queries.js';
// ============================================================================
// Constants
// ============================================================================
const DEFAULT_WINDOW_DAYS = 7;
const MIN_SCHEMA_VERSION = 6; // Requires chronicle + evidence_ref
// ============================================================================
// Main Computation
// ============================================================================
/**
 * Compute pressure metrics for a player within a time window.
 *
 * Invariants:
 * - PM1: Derived-only (no new receipts, no state mutation)
 * - PM2: Window-stable (same DB + window = same output)
 * - PM3: Explainable (contributors traceable to event ids / receipt hashes)
 */
export function computePressureMetrics(ctx, playerId, since, until) {
    const { db } = ctx;
    // Check schema version
    const schemaVersion = getSchemaVersion(db);
    if (schemaVersion < MIN_SCHEMA_VERSION) {
        return {
            status: 'not_ready',
            error_code: 'schema_too_old',
        };
    }
    // Compute window bounds
    const now = new Date();
    const untilDate = until ? new Date(until) : now;
    const sinceDate = since
        ? new Date(since)
        : new Date(untilDate.getTime() - DEFAULT_WINDOW_DAYS * 24 * 60 * 60 * 1000);
    const sinceISO = sinceDate.toISOString();
    const untilISO = untilDate.toISOString();
    // Get all chronicle events in window
    const allEvents = getChronicleRange(db, playerId, sinceISO, untilISO);
    // Get deaths in window
    const deaths = getDeathsRange(db, playerId, sinceISO, untilISO);
    // Filter by kind
    const lostEvents = allEvents.filter((e) => e.kind === 'item_lost' || e.kind === 'legendary_lost');
    const deathEvents = allEvents.filter((e) => e.kind === 'death');
    // -------------------------------------------------------------------------
    // 1) Loss Rate
    // -------------------------------------------------------------------------
    const items_lost_total = lostEvents.length;
    const legendaries_lost_total = lostEvents.filter((e) => e.kind === 'legendary_lost').length;
    const items_lost_by_type = {};
    for (const event of lostEvents) {
        const details = parseDetails(event.details_json);
        const itemType = details.item_type ?? 'unknown';
        items_lost_by_type[itemType] = (items_lost_by_type[itemType] ?? 0) + 1;
    }
    // -------------------------------------------------------------------------
    // 2) Exposure (v0: conservative estimate from chronicle intervals)
    // -------------------------------------------------------------------------
    // In v0, we estimate exposure based on item_acquired → item_lost intervals.
    // Since we don't have item_acquired events in chronicle, we approximate:
    // - Each item that was lost was "exposed" from window start until lost
    // This is a conservative lower bound.
    const exposure_item_minutes = computeExposureMinutes(lostEvents, sinceDate, untilDate);
    const legendaryLostEvents = lostEvents.filter((e) => e.kind === 'legendary_lost');
    const legendary_exposure_minutes = computeExposureMinutes(legendaryLostEvents, sinceDate, untilDate);
    // -------------------------------------------------------------------------
    // 3) Heat Velocity
    // -------------------------------------------------------------------------
    const heatSummary = getPlayerHeatSummary(db, playerId);
    // -------------------------------------------------------------------------
    // 4) Protection Usage
    // -------------------------------------------------------------------------
    const deaths_total = deaths.length;
    let deaths_with_protection = 0;
    // Check each death's evidence_ref for protection info
    for (const deathEvent of deathEvents) {
        const details = parseDetails(deathEvent.details_json);
        // If there was a protected item, count it
        if (details.protected_item_id) {
            deaths_with_protection++;
        }
    }
    // -------------------------------------------------------------------------
    // 5) Drop Severity
    // -------------------------------------------------------------------------
    let total_drop_ratio = 0;
    let drop_count = 0;
    let worst_death;
    for (const deathEvent of deathEvents) {
        const details = parseDetails(deathEvent.details_json);
        const dropped = details.dropped_count;
        const eligible = details.eligible_count;
        if (typeof dropped === 'number' && typeof eligible === 'number' && eligible > 0) {
            const ratio = dropped / eligible;
            total_drop_ratio += ratio;
            drop_count++;
            if (!worst_death || ratio > worst_death.drop_ratio) {
                worst_death = {
                    receipt_hash: deathEvent.receipt_hash,
                    drop_ratio: ratio,
                };
            }
        }
    }
    const average_drop_ratio = drop_count > 0 ? total_drop_ratio / drop_count : undefined;
    // -------------------------------------------------------------------------
    // Contributors (for PM3 explainability)
    // -------------------------------------------------------------------------
    const contributors = {
        lost_event_ids: lostEvents.map((e) => e.id),
        death_event_ids: deathEvents.map((e) => e.id),
        evidence_receipt_hashes: deathEvents
            .filter((e) => e.evidence_ref)
            .map((e) => {
            const ref = parseDetails(e.evidence_ref ?? '{}');
            return ref.receipt_hash;
        })
            .filter(Boolean),
    };
    // -------------------------------------------------------------------------
    // Build result
    // -------------------------------------------------------------------------
    const metrics = {
        items_lost_total,
        items_lost_by_type,
        legendaries_lost_total,
        exposure_item_minutes,
        legendary_exposure_minutes,
        heat_now: heatSummary.total_heat,
        hottest_item_id: heatSummary.hottest_item_id ?? undefined,
        hottest_item_heat: heatSummary.hottest_heat > 0 ? heatSummary.hottest_heat : undefined,
        deaths_total,
        deaths_with_protection,
        average_drop_ratio,
        worst_death,
        contributors,
    };
    return {
        status: 'ok',
        metrics,
    };
}
// ============================================================================
// Helpers
// ============================================================================
function parseDetails(json) {
    if (!json)
        return {};
    try {
        return JSON.parse(json);
    }
    catch {
        return {};
    }
}
/**
 * Compute total exposure minutes for a set of lost items.
 * v0 conservative: each item was exposed from window start until it was lost.
 */
function computeExposureMinutes(lostEvents, windowStart, windowEnd) {
    let totalMinutes = 0;
    for (const event of lostEvents) {
        const lostAt = new Date(event.timestamp);
        // Clamp to window
        const effectiveStart = windowStart;
        const effectiveEnd = lostAt < windowEnd ? lostAt : windowEnd;
        if (effectiveEnd > effectiveStart) {
            const diffMs = effectiveEnd.getTime() - effectiveStart.getTime();
            totalMinutes += diffMs / (1000 * 60);
        }
    }
    return Math.round(totalMinutes);
}
