// Akalynth Receipt Replay
// Startup replay from JSONL receipts with offset-based incremental processing

import * as fs from 'fs';
import * as path from 'path';
import type Database from 'better-sqlite3';
import type { AuditReceipt } from '../../../shared/types.js';
import type { ReplayMarker, ReplayResult } from './types.js';
import { materialize } from './materializers.js';
import { computeReceiptHash, parseJsonlLine } from './hash.js';
import { getMeta, setMeta, getSchemaVersion } from './queries.js';
import { getTableCounts } from './schema.js';

// ============================================================================
// Replay Configuration
// ============================================================================

export interface ReplayConfig {
  db: Database.Database;
  receiptsPath: string;
  markerPath: string;
  mode: 'strict' | 'lenient';
}

// ============================================================================
// Marker I/O
// ============================================================================

export function readMarker(markerPath: string): ReplayMarker | null {
  try {
    if (!fs.existsSync(markerPath)) {
      return null;
    }
    const content = fs.readFileSync(markerPath, 'utf-8');
    const marker = JSON.parse(content) as ReplayMarker;
    if (typeof marker.offset !== 'number' || typeof marker.hash !== 'string') {
      return null;
    }
    return marker;
  } catch {
    return null;
  }
}

export function writeMarker(markerPath: string, marker: ReplayMarker): void {
  const dir = path.dirname(markerPath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  fs.writeFileSync(markerPath, JSON.stringify(marker), 'utf-8');
}

// ============================================================================
// Replay Logic
// ============================================================================

export function replayReceipts(config: ReplayConfig): ReplayResult {
  const { db, receiptsPath, markerPath, mode } = config;

  const result: ReplayResult = {
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
    console.log('[persist] No receipts file found, starting fresh');
    return result;
  }

  // Read marker and _meta to determine replay strategy
  const marker = readMarker(markerPath);
  const metaHash = getMeta(db, 'last_materialized_hash');
  const metaOffset = getMeta(db, 'last_materialized_offset');
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
    } else {
      console.log('[persist] Marker/meta mismatch, full replay required');
    }
  } else if (schemaVersion === 0) {
    console.log('[persist] Empty database, full replay required');
  } else {
    console.log('[persist] No valid marker, full replay required');
  }

  result.replayed_from_scratch = needsFullReplay;

  // Open file and seek to start offset
  const fd = fs.openSync(receiptsPath, 'r');
  const stats = fs.fstatSync(fd);
  const fileSize = stats.size;

  if (startOffset >= fileSize) {
    // No new receipts
    fs.closeSync(fd);
    console.log('[persist] No new receipts to process');

    // Get current counts
    const counts = getTableCounts(db);
    result.players_loaded = counts.players;
    result.reputation_events_loaded = counts.reputation_events;
    result.deaths_loaded = counts.deaths;
    result.objects_loaded = counts.world_objects;
    result.last_offset = startOffset;
    result.last_receipt_hash = marker?.hash ?? null;

    return result;
  }

  // Read and process receipts
  let currentOffset = startOffset;
  let lastHash: string | null = null;
  let lineBuffer = '';

  // Read in chunks
  const chunkSize = 64 * 1024; // 64KB chunks
  const buffer = Buffer.alloc(chunkSize);

  while (currentOffset < fileSize) {
    const bytesToRead = Math.min(chunkSize, fileSize - currentOffset);
    const bytesRead = fs.readSync(fd, buffer, 0, bytesToRead, currentOffset);

    if (bytesRead === 0) break;

    lineBuffer += buffer.toString('utf-8', 0, bytesRead);
    currentOffset += bytesRead;

    // Process complete lines
    let newlineIndex: number;
    while ((newlineIndex = lineBuffer.indexOf('\n')) !== -1) {
      const line = lineBuffer.slice(0, newlineIndex + 1);
      lineBuffer = lineBuffer.slice(newlineIndex + 1);

      // Calculate offset after this line
      const lineBytes = Buffer.byteLength(line, 'utf-8');
      const offsetAfterLine = currentOffset - lineBuffer.length;

      // Parse and materialize
      try {
        const receipt = parseJsonlLine(line) as AuditReceipt;
        const receiptHash = computeReceiptHash(receipt);

        materialize(db, receipt, offsetAfterLine);
        lastHash = receiptHash;
        result.receipts_processed++;
      } catch (err) {
        if (mode === 'strict') {
          fs.closeSync(fd);
          throw new Error(`Malformed receipt at offset ${offsetAfterLine - lineBytes}: ${err}`);
        } else {
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
