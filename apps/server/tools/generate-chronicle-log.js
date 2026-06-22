#!/usr/bin/env node
/* eslint-disable no-console */
/**
 * generate-chronicle-log.js
 *
 * Generates a deterministic chronicle log fixture for CI/audit verification.
 * Uses the same hashing rules as verify-chronicle-chain.ts.
 *
 * Usage:
 *   cd apps/server
 *   node tools/generate-chronicle-log.js [outputPath]
 */

import fs from 'node:fs';
import path from 'node:path';
import {
  computeCapsHash,
  computePayloadHash,
  computeEventHash,
  computeGlobalEventHash,
} from '../../../packages/shared/chronicleChain.js';

function buildEntry(base, prevEventHash, prevGlobalHash) {
  const caps = base.caps ?? [];
  const caps_hash = computeCapsHash(caps);
  const payload = { ...base.payload };
  const payload_hash = computePayloadHash(payload);

  const entry = {
    v: base.v,
    world_id: base.world_id,
    rulebook_root: base.rulebook_root,
    tick: base.tick,
    event_type: base.event_type,
    actor: base.actor,
    caps_hash,
    caps,
    payload: {},
    rng: base.rng ?? null,
  };

  const event_hash = computeEventHash(entry, prevEventHash, payload_hash);
  const global_event_hash = computeGlobalEventHash(entry, payload_hash, event_hash, prevGlobalHash);

  entry.payload = {
    ...payload,
    payload_hash,
    prev_event_hash: prevEventHash,
    event_hash,
    prev_global_hash: prevGlobalHash,
    global_event_hash,
  };

  return {
    entry,
    nextPrevEvent: event_hash,
    nextPrevGlobal: global_event_hash,
  };
}

function main() {
  const outputArg = process.argv[2];
  const outputPath = outputArg
    ? path.resolve(process.cwd(), outputArg)
    : path.resolve(process.cwd(), 'fixtures/ci-chronicle/chronicle.log');

  fs.mkdirSync(path.dirname(outputPath), { recursive: true });

  const base = {
    v: 1,
    world_id: 'akalynth-ci',
    rulebook_root: 'blake3:ci-genesis',
    actor: 'did:akalynth:ci_bot',
    caps: [],
  };

  const events = [
    {
      ...base,
      tick: 1,
      event_type: 'spawn',
      payload: { action: 'spawn', x: 1, y: 2 },
    },
    {
      ...base,
      tick: 2,
      event_type: 'move',
      payload: { action: 'move', from: [1, 2], to: [2, 2] },
    },
  ];

  let prevEventHash = 'genesis';
  let prevGlobalHash = 'genesis';
  const lines = [];

  for (const evt of events) {
    const { entry, nextPrevEvent, nextPrevGlobal } = buildEntry(
      evt,
      prevEventHash,
      prevGlobalHash
    );
    lines.push(JSON.stringify(entry));
    prevEventHash = nextPrevEvent;
    prevGlobalHash = nextPrevGlobal;
  }

  fs.writeFileSync(outputPath, `${lines.join('\n')}\n`, 'utf8');
  console.log(`[chronicle-fixture] wrote ${lines.length} entries -> ${outputPath}`);
}

main();
