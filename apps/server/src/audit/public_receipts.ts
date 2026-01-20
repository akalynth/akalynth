import crypto from 'node:crypto';

import type { PublicReceipt, PublicReceiptsActorMode, Receipt } from '../../../../packages/shared/http.js';

export type PublicReceiptOptions = {
  actorMode: PublicReceiptsActorMode;
  bucketSize: number;
  hashSalt: string;
};

function sha256Hex(data: string): string {
  return crypto.createHash('sha256').update(data).digest('hex');
}

function hashPrefixToUint32(hex: string): number {
  const prefix = hex.slice(0, 8);
  const parsed = Number.parseInt(prefix, 16);
  return Number.isFinite(parsed) ? parsed : 0;
}

function dayKeyFor(timestamp: string): string {
  const ts = Date.parse(timestamp);
  if (Number.isNaN(ts)) return 'unknown-day';
  return new Date(ts).toISOString().slice(0, 10);
}

function bucketCoord(value: number, size: number): number {
  return Math.floor(value / size) * size;
}

function redactValue(value: unknown, bucketSize: number, parentKey?: string): unknown {
  if (Array.isArray(value)) {
    return value.map((entry) => redactValue(entry, bucketSize));
  }
  if (!value || typeof value !== 'object') return value;

  const obj = value as Record<string, unknown>;
  const redacted: Record<string, unknown> = {};

  for (const [key, entry] of Object.entries(obj)) {
    if (key === 'player_id') continue;
    redacted[key] = redactValue(entry, bucketSize, key);
  }

  const rawX = typeof obj.x === 'number' ? obj.x : null;
  const rawY = typeof obj.y === 'number' ? obj.y : null;

  if (parentKey !== 'approx' && rawX !== null && rawY !== null) {
    if ('x' in redacted) delete redacted.x;
    if ('y' in redacted) delete redacted.y;
    redacted.approx = {
      x: bucketCoord(rawX, bucketSize),
      y: bucketCoord(rawY, bucketSize),
    };
  }

  return redacted;
}

function redactInputs(inputs: Record<string, unknown>, bucketSize: number): Record<string, unknown> {
  const redacted = redactValue(inputs, bucketSize);
  if (!redacted || typeof redacted !== 'object' || Array.isArray(redacted)) return {};
  return redacted as Record<string, unknown>;
}

export function jitterMsForReceipt(receipt: Receipt, jitterMaxMs: number, salt: string): number {
  if (jitterMaxMs <= 0) return 0;
  const basis = typeof receipt.event_hash === 'string' && receipt.event_hash
    ? receipt.event_hash
    : receipt.timestamp;
  const digest = sha256Hex(`${basis}:${salt}`);
  return hashPrefixToUint32(digest) % (jitterMaxMs + 1);
}

export function visibleAtMs(
  receipt: Receipt,
  baselineDelayMs: number,
  jitterMaxMs: number,
  salt: string
): number | null {
  const ts = Date.parse(receipt.timestamp);
  if (Number.isNaN(ts)) return null;
  const jitter = jitterMsForReceipt(receipt, jitterMaxMs, salt);
  return ts + baselineDelayMs + jitter;
}

export function publicActorForReceipt(
  receipt: Receipt,
  actorMode: PublicReceiptsActorMode,
  hashSalt: string
): string {
  if (actorMode === 'daily_hash') {
    return sha256Hex(`${receipt.actor_id}${hashSalt}:${dayKeyFor(receipt.timestamp)}`).slice(0, 8);
  }
  return 'anon';
}

export function toPublicReceipt(receipt: Receipt, opts: PublicReceiptOptions): PublicReceipt {
  const actor_id = publicActorForReceipt(receipt, opts.actorMode, opts.hashSalt);

  return {
    sequence: receipt.sequence,
    timestamp: receipt.timestamp,
    prev_hash: receipt.prev_hash,
    event_hash: receipt.event_hash,
    signature: receipt.signature,
    action: receipt.action,
    inputs: redactInputs(receipt.inputs, opts.bucketSize),
    result: receipt.result ?? null,
    inputs_hash: receipt.inputs_hash,
    outputs_hash: receipt.outputs_hash,
    actor_id,
  };
}
