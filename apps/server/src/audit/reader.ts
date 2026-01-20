import fs from 'node:fs';
import path from 'node:path';
import type { PublicReceiptsQueryParams, Receipt, ReceiptsQueryParams, ReceiptsResponse } from '../../../../packages/shared/http.js';
import { visibleAtMs } from './public_receipts.js';

const DEFAULT_LIMIT = 100;
const MAX_LIMIT = 1000;

export function createReceiptsReader(receiptsPath: string) {
  const file = receiptsPath;

  return {
    query(params: ReceiptsQueryParams): ReceiptsResponse {
      return baseQuery(params, () => true, false);
    },

    queryPublic(
      params: PublicReceiptsQueryParams,
      nowMs: number,
      allowActions: Set<string>,
      visibility: {
        delayForAction: (action: string) => number;
        jitterMaxMs: number;
        jitterSalt: string;
      }
    ): ReceiptsResponse {
      const predicate = (r: Receipt) => {
        if (!allowActions.has(r.action)) return false;
        const baselineDelay = visibility.delayForAction(r.action);
        const visibleAt = visibleAtMs(r, baselineDelay, visibility.jitterMaxMs, visibility.jitterSalt);
        if (visibleAt === null) return false;
        return visibleAt <= nowMs;
      };
      return baseQuery(params, predicate, true);
    },
  };

  function baseQuery(
    params: ReceiptsQueryParams | PublicReceiptsQueryParams,
    predicate: (r: Receipt) => boolean,
    sortDesc: boolean
  ): ReceiptsResponse {
    const limit = Math.min(params.limit ?? DEFAULT_LIMIT, MAX_LIMIT);
    const offset = params.offset ?? 0;

    if (!fs.existsSync(file)) {
      return { receipts: [], total: 0, has_more: false };
    }

    const content = fs.readFileSync(file, 'utf-8');
    const lines = content.trim().split('\n').filter(Boolean);

    let receipts: Receipt[] = [];
    for (const line of lines) {
      try {
        const receipt = JSON.parse(line) as Receipt;
        receipts.push(receipt);
      } catch {
        // skip malformed lines
      }
    }

    // Apply filters
    receipts = receipts.filter(predicate);

    if ('player_id' in params && params.player_id) {
      receipts = receipts.filter((r) => r.actor_id === params.player_id);
    }
    if (params.action) {
      receipts = receipts.filter((r) => r.action === params.action);
    }
    if (params.since) {
      const sinceTime = new Date(params.since).getTime();
      receipts = receipts.filter((r) => new Date(r.timestamp).getTime() >= sinceTime);
    }
    if ('until' in params && params.until) {
      const untilTime = new Date(params.until).getTime();
      receipts = receipts.filter((r) => new Date(r.timestamp).getTime() <= untilTime);
    }

    if (sortDesc) {
      receipts.sort((a, b) => Date.parse(b.timestamp) - Date.parse(a.timestamp));
    }

    const total = receipts.length;
    const sliced = receipts.slice(offset, offset + limit);
    const has_more = offset + sliced.length < total;

    return { receipts: sliced, total, has_more };
  }
}
