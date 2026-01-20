#!/usr/bin/env node
/**
 * Doctrine Verifier
 *
 * Guardrail against doctrine drift:
 *  - required doctrine docs exist
 *  - docs/README.md links to them (discoverable, not tribal knowledge)
 *
 * Exit codes:
 *   0 - PASS
 *   1 - FAIL (violations)
 *   2 - error (missing files, unreadable input)
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

type DoctrineDoc = {
  relPath: string;
  requiredLinkTarget: string; // e.g. ./WORLD_EVOLUTION.md
};

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const REPO_ROOT = path.resolve(__dirname, '../../..');

const DOCS_INDEX = path.resolve(REPO_ROOT, 'docs', 'README.md');

const DOCTRINE_DOCS: DoctrineDoc[] = [
  { relPath: 'docs/GOVERNANCE_INVARIANTS.md', requiredLinkTarget: './GOVERNANCE_INVARIANTS.md' },
  { relPath: 'docs/MONETIZATION_CONSTITUTION.md', requiredLinkTarget: './MONETIZATION_CONSTITUTION.md' },
  { relPath: 'docs/MONETIZATION_RECEIPTS.md', requiredLinkTarget: './MONETIZATION_RECEIPTS.md' },
  { relPath: 'docs/MONETIZATION_JUSTIFICATIONS.md', requiredLinkTarget: './MONETIZATION_JUSTIFICATIONS.md' },
  { relPath: 'docs/WORLD_EVOLUTION.md', requiredLinkTarget: './WORLD_EVOLUTION.md' },
];

function errorOut(msg: string): never {
  console.error(`[verify-doctrine] ERROR: ${msg}`);
  process.exit(2);
}

function fail(msg: string): void {
  console.error(`[verify-doctrine] FAIL: ${msg}`);
}

function ok(msg: string): void {
  console.log(`[verify-doctrine] OK: ${msg}`);
}

function main(): void {
  if (!fs.existsSync(DOCS_INDEX)) {
    errorOut(`missing docs index: ${DOCS_INDEX}`);
  }

  let docsIndexText = '';
  try {
    docsIndexText = fs.readFileSync(DOCS_INDEX, 'utf8');
  } catch (e) {
    errorOut(`failed to read docs index: ${String(e)}`);
  }

  const violations: string[] = [];

  for (const doc of DOCTRINE_DOCS) {
    const absPath = path.resolve(REPO_ROOT, doc.relPath);
    if (!fs.existsSync(absPath)) {
      violations.push(`missing doctrine doc: ${doc.relPath}`);
      continue;
    }
    ok(`doc exists: ${doc.relPath}`);

    if (!docsIndexText.includes(`(${doc.requiredLinkTarget})`)) {
      violations.push(`docs/README.md missing link to ${doc.requiredLinkTarget}`);
    }
  }

  if (violations.length > 0) {
    for (const v of violations) fail(v);
    process.exit(1);
  }

  ok('doctrine docs present and linked');
}

main();

