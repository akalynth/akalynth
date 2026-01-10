import crypto from 'node:crypto';

import type { PublicReceipt, PublicReceiptsActorMode, Receipt } from '../../../shared/http.js';

export type PublicReceiptOptions = {
  actorMode: PublicReceiptsActorMode;
  bucketSize: number;
  hashSalt: string;
};

function sha256Hex(data: string): string {
  return crypto.createHash('sha256').update(data).digest('hex');
}

function dayKeyFor(timestamp: string): string {
  const ts = Date.parse(timestamp);
  if (Number.isNaN(ts)) return 'unknown-day';
  return new Date(ts).toISOString().slice(0, 10);
}

function bucketCoord(value: number, size: number): number {
  return Math.floor(value / size) * size;
}

function redactPosition(value: unknown, bucketSize: number): unknown {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return value;

  const position = value as Record<string, unknown>;
  const redacted: Record<string, unknown> = { ...position };

  const rawX = typeof position.x === 'number' ? position.x : null;
  const rawY = typeof position.y === 'number' ? position.y : null;

  if ('x' in redacted) delete redacted.x;
  if ('y' in redacted) delete redacted.y;

  if (rawX !== null && rawY !== null) {
    redacted.approx = {
      x: bucketCoord(rawX, bucketSize),
      y: bucketCoord(rawY, bucketSize),
    };
  }

  return redacted;
}

function redactInputs(inputs: Record<string, unknown>, bucketSize: number): Record<string, unknown> {
  const redacted: Record<string, unknown> = { ...inputs };

  if ('position' in redacted) {
    redacted.position = redactPosition(redacted.position, bucketSize);
  }

  if ('spawn' in redacted) {
    redacted.spawn = redactPosition(redacted.spawn, bucketSize);
  }

  return redacted;
}

export function toPublicReceipt(receipt: Receipt, opts: PublicReceiptOptions): PublicReceipt {
  const actor =
    opts.actorMode === 'daily_hash'
      ? sha256Hex(`${receipt.player_id}${opts.hashSalt}:${dayKeyFor(receipt.timestamp)}`).slice(0, 8)
      : 'anon';

  return {
    timestamp: receipt.timestamp,
    evidence_hash: receipt.evidence_hash,
    action: receipt.action,
    inputs: redactInputs(receipt.inputs, opts.bucketSize),
    result: receipt.result ?? null,
    actor,
  };
}
