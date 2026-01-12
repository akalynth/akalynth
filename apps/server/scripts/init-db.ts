#!/usr/bin/env npx tsx
/**
 * Initialize a fresh database with v6 schema for testing.
 */

import { createPersistenceLayer } from '../src/persist/index.js';
import { createAuditLogger } from '../src/audit/logger.js';
import fs from 'fs';

// Create dirs if needed
if (!fs.existsSync('audit')) fs.mkdirSync('audit');
if (!fs.existsSync('data')) fs.mkdirSync('data');

const logger = createAuditLogger({
  receiptsPath: 'audit/receipts.jsonl',
  markerPath: 'audit/receipts.marker',
  onWrite: () => {},
});

const persist = createPersistenceLayer({
  dbPath: 'data/akalynth.db',
  receiptsPath: 'audit/receipts.jsonl',
  logger: null,
});

console.log('Schema version:', persist.getSchemaVersion());
console.log('DB initialized successfully');
