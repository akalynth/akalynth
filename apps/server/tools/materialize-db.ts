#!/usr/bin/env node
// Materialize the SQLite projection from the canonical receipts chain.
//
// Replays receipts → SQLite via the persistence layer's startup(), producing
// the DB the DB-dependent verifiers (heat/protected/chronicle/evidence) read.
// Used in CI to build data/akalynth.db from the generated fixture receipts.
//
// Paths resolve via packages/shared/paths.ts (same resolver the verifiers use),
// so this writes the DB to exactly the path they read:
//   receipts: AKALYNTH_RECEIPT_CHAIN_PATH (default audit/receipts.jsonl)
//   db:       AKALYNTH_DB_PATH            (default data/akalynth.db)
//   marker:   AKALYNTH_REPLAY_MARKER_PATH (default data/replay_marker.json)

import * as fs from 'node:fs';
import * as path from 'node:path';
import { resolveChainPaths } from '../../../packages/shared/paths.js';
import { createPersistenceLayer } from '../src/persist/index.js';

function fail(msg: string): never {
  console.error(`[materialize-db] FAIL: ${msg}`);
  process.exit(1);
}

function main(): void {
  const repoRoot = path.resolve(process.cwd());
  const paths = resolveChainPaths(repoRoot);

  if (!fs.existsSync(paths.receiptsPath)) {
    fail(`receipts chain not found: ${paths.receiptsPath}`);
  }

  // Force a clean, full replay (drop any stale DB/marker from a prior run) so
  // the projection is reconstructed solely from the canonical receipts.
  fs.rmSync(paths.dbPath, { force: true });
  fs.rmSync(paths.markerPath, { force: true });
  fs.mkdirSync(path.dirname(paths.dbPath), { recursive: true });

  const persist = createPersistenceLayer({
    dbPath: paths.dbPath,
    markerPath: paths.markerPath,
    receiptsPath: paths.receiptsPath,
    replayMode: 'strict',
  });

  const result = persist.startup();
  persist.checkpoint();
  persist.close();

  console.log(
    `[materialize-db] db=${paths.dbPath} receipts_processed=${result.receipts_processed} ` +
      `from_scratch=${result.replayed_from_scratch} last_offset=${result.last_offset}`
  );
}

main();
