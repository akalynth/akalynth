// Akalynth Receipt Replay
// Startup replay from JSONL receipts with offset-based incremental processing
import * as fs from 'fs';
import * as path from 'path';
import { materialize } from './materializers.js';
import { computeReceiptHash, parseJsonlLine } from './hash.js';
import { getMeta, setMeta, getSchemaVersion } from './queries.js';
import { getTableCounts } from './schema.js';
import { applyReceiptToIdentity, clearIdentityProjection } from '../world/identity.js';
import { applyReceiptToTreasury, clearTreasuryProjection } from '../world/treasury.js';
import { applyReceiptToWorkContracts, clearWorkContractsProjection } from '../world/work_contracts.js';
import { applyReceiptToPresence, clearPresenceProjection } from '../world/presence.js';
import { applyReceiptToProperty, clearPropertyProjection } from '../world/property.js';
import { applyReceiptToRookguardQuest, clearRookguardQuestProjection } from '../world/rookguardQuest.js';
import { applyReceiptToOnwardRoutes, clearOnwardRouteProjection } from '../world/onwardRoutes.js';
// ============================================================================
// Marker I/O
// ============================================================================
export function readMarker(markerPath) {
    try {
        if (!fs.existsSync(markerPath)) {
            return null;
        }
        const content = fs.readFileSync(markerPath, 'utf-8');
        const marker = JSON.parse(content);
        if (typeof marker.offset !== 'number' || typeof marker.hash !== 'string') {
            return null;
        }
        return marker;
    }
    catch {
        return null;
    }
}
export function writeMarker(markerPath, marker) {
    const dir = path.dirname(markerPath);
    if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(markerPath, JSON.stringify(marker), 'utf-8');
}
// ============================================================================
// Replay Logic
// ============================================================================
export function replayReceipts(config) {
    const { db, receiptsPath, markerPath, mode } = config;
    const result = {
        players_loaded: 0,
        reputation_events_loaded: 0,
        deaths_loaded: 0,
        objects_loaded: 0,
        last_receipt_hash: null,
        last_offset: 0,
        replayed_from_scratch: false,
        receipts_processed: 0,
    };
    // Check if receipts file exists
    if (!fs.existsSync(receiptsPath)) {
        // Canonical history must not be silently absent.
        // Bootstrap/genesis is an explicit server startup responsibility.
        throw new Error(`[persist] receipts file missing: ${receiptsPath}`);
    }
    // Read marker and _meta to determine replay strategy
    const marker = readMarker(markerPath);
    const metaHash = getMeta(db, 'last_materialized_hash');
    const metaOffset = getMeta(db, 'last_materialized_offset');
    const metaOffsetNumber = metaOffset ? Number(metaOffset) : 0;
    const hasMetaHistory = Boolean(metaHash) || metaOffsetNumber > 0;
    const schemaVersion = getSchemaVersion(db);
    // Determine start offset
    let startOffset = 0;
    let needsFullReplay = true;
    if (schemaVersion > 0 && marker && metaHash) {
        // Check if marker matches _meta (sanity check)
        if (marker.hash === metaHash) {
            startOffset = marker.offset;
            needsFullReplay = false;
            console.log(`[persist] Incremental replay from offset ${startOffset}`);
        }
        else {
            console.log('[persist] Marker/meta mismatch, full replay required');
        }
    }
    else if (schemaVersion === 0) {
        console.log('[persist] Empty database, full replay required');
    }
    else {
        console.log('[persist] No valid marker, full replay required');
    }
    result.replayed_from_scratch = needsFullReplay;
    // Always clear in-memory projections (needs full rebuild)
    clearIdentityProjection();
    clearTreasuryProjection();
    clearWorkContractsProjection();
    clearPresenceProjection();
    clearPropertyProjection();
    clearRookguardQuestProjection();
    clearOnwardRouteProjection();
    // Open file from BEGINNING (identity needs all receipts, DB only needs new ones)
    const fd = fs.openSync(receiptsPath, 'r');
    const stats = fs.fstatSync(fd);
    const fileSize = stats.size;
    // If marker exists, receipts must not be truncated behind it.
    if (marker && marker.offset > fileSize) {
        fs.closeSync(fd);
        throw new Error(`[persist] receipts truncated: marker.offset=${marker.offset} > fileSize=${fileSize} (refusing silent history loss)`);
    }
    if (fileSize === 0) {
        // Empty receipts file
        fs.closeSync(fd);
        const counts = getTableCounts(db);
        const dbHasHistory = counts.players > 0 || counts.deaths > 0 || counts.reputation_events > 0 || counts.world_objects > 0;
        // Empty chain is only valid for genesis/fresh state; otherwise it's history erasure.
        if (dbHasHistory || marker || hasMetaHistory) {
            throw new Error('[persist] empty receipts chain with existing state/marker/meta (refusing silent reset)');
        }
        console.log('[persist] Empty receipts chain (genesis)');
        result.players_loaded = counts.players;
        result.reputation_events_loaded = counts.reputation_events;
        result.deaths_loaded = counts.deaths;
        result.objects_loaded = counts.world_objects;
        result.last_offset = 0;
        result.last_receipt_hash = null;
        return result;
    }
    // Note: Even if no new DB receipts (startOffset >= fileSize), we still replay
    // all receipts for identity projection (in-memory only)
    // Read and process receipts
    // Always start from 0: identity projection needs ALL receipts (in-memory only)
    // DB materialization only needs receipts after startOffset
    let currentOffset = 0;
    let lastHash = null;
    let lineBuffer = '';
    // Read in chunks
    const chunkSize = 64 * 1024; // 64KB chunks
    const buffer = Buffer.alloc(chunkSize);
    while (currentOffset < fileSize) {
        const bytesToRead = Math.min(chunkSize, fileSize - currentOffset);
        const bytesRead = fs.readSync(fd, buffer, 0, bytesToRead, currentOffset);
        if (bytesRead === 0)
            break;
        lineBuffer += buffer.toString('utf-8', 0, bytesRead);
        currentOffset += bytesRead;
        // Process complete lines
        let newlineIndex;
        while ((newlineIndex = lineBuffer.indexOf('\n')) !== -1) {
            const line = lineBuffer.slice(0, newlineIndex + 1);
            lineBuffer = lineBuffer.slice(newlineIndex + 1);
            // Calculate offset BEFORE this line (for comparison with startOffset)
            const lineBytes = Buffer.byteLength(line, 'utf-8');
            const offsetAfterLine = currentOffset - lineBuffer.length;
            const offsetBeforeLine = offsetAfterLine - lineBytes;
            // Parse receipt
            try {
                const receipt = parseJsonlLine(line);
                const receiptHash = computeReceiptHash(receipt);
                // Always apply to in-memory projections (need all receipts)
                applyReceiptToIdentity(receipt);
                applyReceiptToTreasury(receipt);
                applyReceiptToWorkContracts(receipt);
                applyReceiptToPresence(receipt);
                applyReceiptToProperty(receipt);
                applyReceiptToRookguardQuest(receipt);
                applyReceiptToOnwardRoutes(receipt);
                // Only materialize to DB if this is a new receipt (after startOffset)
                if (offsetBeforeLine >= startOffset) {
                    materialize(db, receipt, offsetAfterLine);
                    lastHash = receiptHash;
                    result.receipts_processed++;
                }
            }
            catch (err) {
                if (mode === 'strict') {
                    fs.closeSync(fd);
                    throw new Error(`Malformed receipt at offset ${offsetBeforeLine}: ${err}`);
                }
                else {
                    console.warn(`[persist] Skipping malformed receipt: ${err}`);
                }
            }
        }
    }
    fs.closeSync(fd);
    // Update marker with final position
    if (lastHash) {
        const finalOffset = fileSize - Buffer.byteLength(lineBuffer, 'utf-8');
        writeMarker(markerPath, { offset: finalOffset, hash: lastHash });
        setMeta(db, 'last_materialized_hash', lastHash);
        setMeta(db, 'last_materialized_offset', String(finalOffset));
        result.last_offset = finalOffset;
        result.last_receipt_hash = lastHash;
    }
    // Get final counts
    const counts = getTableCounts(db);
    result.players_loaded = counts.players;
    result.reputation_events_loaded = counts.reputation_events;
    result.deaths_loaded = counts.deaths;
    result.objects_loaded = counts.world_objects;
    console.log(`[persist] Replay complete: ${result.receipts_processed} receipts processed`);
    console.log(`[persist] State: ${result.players_loaded} players, ${result.deaths_loaded} deaths, ${result.reputation_events_loaded} rep events, ${result.objects_loaded} objects`);
    return result;
}
