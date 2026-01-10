import fs from 'node:fs';
import path from 'node:path';
import type { Receipt, ReceiptsQueryParams, ReceiptsResponse } from '../../../shared/http.js';

const DEFAULT_LIMIT = 100;
const MAX_LIMIT = 1000;

export function createReceiptsReader(auditDir: string) {
  const file = path.join(auditDir, 'receipts.jsonl');

  return {
    query(params: ReceiptsQueryParams): ReceiptsResponse {
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
      if (params.player_id) {
        receipts = receipts.filter((r) => r.player_id === params.player_id);
      }
      if (params.action) {
        receipts = receipts.filter((r) => r.action === params.action);
      }
      if (params.since) {
        const sinceTime = new Date(params.since).getTime();
        receipts = receipts.filter((r) => new Date(r.timestamp).getTime() >= sinceTime);
      }
      if (params.until) {
        const untilTime = new Date(params.until).getTime();
        receipts = receipts.filter((r) => new Date(r.timestamp).getTime() <= untilTime);
      }

      const total = receipts.length;
      const sliced = receipts.slice(offset, offset + limit);
      const has_more = offset + sliced.length < total;

      return { receipts: sliced, total, has_more };
    },
  };
}
