// Receipt Chain Verification and Replay
// Cryptographic integrity verification and deterministic state reconstruction

import fs from 'node:fs';
import type { CoordinationReceipt, ReceiptChain, CoordinationError } from '../types.js';
import { verifyReceiptHash, verifyChainLink, verifyGenesisReceipt } from './hasher.js';

// ============================================================================
// Chain Verification
// ============================================================================

/**
 * Verify complete receipt chain integrity
 */
export async function verifyChain(receipts: CoordinationReceipt[]): Promise<ReceiptChain> {
  if (receipts.length === 0) {
    return {
      receipts: [],
      integrity: 'valid',
      last_hash: null,
    };
  }

  // Verify each receipt's hash
  for (const receipt of receipts) {
    if (!verifyReceiptHash(receipt)) {
      return {
        receipts,
        integrity: 'broken',
        last_hash: null,
      };
    }
  }

  // Verify genesis receipt
  if (!verifyGenesisReceipt(receipts[0])) {
    return {
      receipts,
      integrity: 'broken',
      last_hash: null,
    };
  }

  // Verify chain links
  for (let i = 1; i < receipts.length; i++) {
    if (!verifyChainLink(receipts[i - 1], receipts[i])) {
      return {
        receipts,
        integrity: 'broken',
        last_hash: null,
      };
    }
  }

  const lastHash = receipts.length > 0 ? receipts[receipts.length - 1].evidence_hash : null;

  return {
    receipts,
    integrity: 'valid',
    last_hash: lastHash,
  };
}

/**
 * Load and verify receipts from JSONL file
 */
export async function loadAndVerifyChain(filePath: string): Promise<ReceiptChain> {
  try {
    const content = fs.readFileSync(filePath, 'utf-8');
    const lines = content.trim().split('\n').filter(line => line.length > 0);

    const receipts: CoordinationReceipt[] = lines.map(line => {
      try {
        return JSON.parse(line) as CoordinationReceipt;
      } catch (error) {
        throw new Error(`Invalid JSON in receipt: ${line}`);
      }
    });

    return await verifyChain(receipts);
  } catch (error) {
    throw new Error(`Failed to load receipt chain: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

// ============================================================================
// State Replay
// ============================================================================

/**
 * Replay receipts through a reducer to reconstruct state
 */
export async function replay<T>(
  receipts: CoordinationReceipt[],
  reducer: (state: T, receipt: CoordinationReceipt) => T,
  initialState: T
): Promise<T> {
  // First verify chain integrity
  const verification = await verifyChain(receipts);

  if (verification.integrity === 'broken') {
    throw new Error('Cannot replay: receipt chain integrity is broken');
  }

  // Apply reducer to each receipt in order
  let state = initialState;
  for (const receipt of receipts) {
    try {
      state = reducer(state, receipt);
    } catch (error) {
      throw new Error(
        `Reducer failed at receipt ${receipt.evidence_hash}: ${
          error instanceof Error ? error.message : 'Unknown error'
        }`
      );
    }
  }

  return state;
}

/**
 * Replay receipts from JSONL file
 */
export async function replayFromFile<T>(
  filePath: string,
  reducer: (state: T, receipt: CoordinationReceipt) => T,
  initialState: T
): Promise<T> {
  const verification = await loadAndVerifyChain(filePath);
  return await replay(verification.receipts, reducer, initialState);
}

// ============================================================================
// Diagnostic Utilities
// ============================================================================

/**
 * Generate integrity report for debugging
 */
export function generateIntegrityReport(receipts: CoordinationReceipt[]): {
  total_receipts: number;
  hash_failures: number;
  chain_breaks: number;
  genesis_valid: boolean;
  first_error?: string;
} {
  const report = {
    total_receipts: receipts.length,
    hash_failures: 0,
    chain_breaks: 0,
    genesis_valid: receipts.length > 0 ? verifyGenesisReceipt(receipts[0]) : true,
    first_error: undefined as string | undefined,
  };

  // Check hash integrity
  for (let i = 0; i < receipts.length; i++) {
    if (!verifyReceiptHash(receipts[i])) {
      report.hash_failures++;
      if (!report.first_error) {
        report.first_error = `Hash failure at receipt ${i}: ${receipts[i].evidence_hash}`;
      }
    }
  }

  // Check chain links
  for (let i = 1; i < receipts.length; i++) {
    if (!verifyChainLink(receipts[i - 1], receipts[i])) {
      report.chain_breaks++;
      if (!report.first_error) {
        report.first_error = `Chain break between receipts ${i-1} and ${i}`;
      }
    }
  }

  return report;
}