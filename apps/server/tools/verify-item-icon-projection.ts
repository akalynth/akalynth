#!/usr/bin/env tsx
/**
 * Verify PR-030 item icon projection helpers.
 * Run: npx tsx apps/server/tools/verify-item-icon-projection.ts
 */
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { loadItemIconIndex, toItemInfo } from '../src/item-info.js';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');
loadItemIconIndex(repoRoot);

let failed = 0;
function check(name: string, cond: boolean): void {
  console.log(`${cond ? 'PASS' : 'FAIL'}  ${name}`);
  if (!cond) failed++;
}

const torch = toItemInfo('item_torch_1', 'torch', null);
check('torch item_type projects icon_sprite_id when registry has entry', typeof torch.icon_sprite_id === 'string' && torch.icon_sprite_id.startsWith('akalynth_item_'));
check('torch item_id preserved', torch.item_id === 'item_torch_1');
check('torch slot preserved', torch.slot === null);

const unknown = toItemInfo('item_unknown_1', 'definitely_not_a_real_item_type_xyz');
check('unknown item_type omits icon_sprite_id', unknown.icon_sprite_id === undefined);

if (failed > 0) {
  console.error(`\n${failed} test(s) failed`);
  process.exit(1);
}

console.log('\nOK — item icon projection');