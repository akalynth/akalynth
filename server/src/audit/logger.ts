import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import type { AuditReceipt } from '../../../shared/types';

export interface AuditLogger {
  write(receipt: Omit<AuditReceipt, 'timestamp' | 'evidence_hash'>): void;
}

function sha256Hex(data: string): string {
  return crypto.createHash('sha256').update(data).digest('hex');
}

export function createAuditLogger(): AuditLogger {
  const dir = path.resolve(process.cwd(), 'audit');
  const file = path.join(dir, 'receipts.jsonl');
  fs.mkdirSync(dir, { recursive: true });

  return {
    write: (receipt) => {
      const timestamp = new Date().toISOString();
      const evidence = JSON.stringify({
        timestamp,
        player_id: receipt.player_id,
        action: receipt.action,
        inputs: receipt.inputs,
        result: receipt.result,
      });
      const evidence_hash = `sha256:${sha256Hex(evidence)}`;
      const line = JSON.stringify({ timestamp, evidence_hash, ...receipt }) + '\n';
      fs.appendFileSync(file, line, 'utf-8');
    },
  };
}

