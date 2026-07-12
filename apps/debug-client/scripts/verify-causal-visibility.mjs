#!/usr/bin/env node
/**
 * Causal visibility guard: completed world events expose durable player-facing
 * action, result, current world state, and future consequence when available.
 */
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');

function read(relativePath) {
  return readFileSync(resolve(root, relativePath), 'utf8');
}

function requirePattern(label, pattern, source, relativePath) {
  if (!pattern.test(source)) {
    console.error(`FAIL ${label} — expected in ${relativePath}`);
    process.exit(1);
  }
  console.log(`PASS ${label}`);
}

const app = read('src/App.tsx');
const causal = read('src/chronicle/causalVisibility.ts');
const parity = read('../../packages/shared/causalParity.ts');
const materializers = read('../../apps/server/src/persist/materializers.ts');
const fishing = read('../../apps/server/src/world/rookguardFishing.ts');
const handlers = read('../../apps/server/src/skills/handlers.ts');

requirePattern('causal mapper is wired', /causalVisibilityForEvent\(ev\)/, app, 'src/App.tsx');
requirePattern('because-of-you label is visible', /Because of you, the world remembers\./, app, 'src/App.tsx');
requirePattern('player action is rendered', /<strong>You did:<\/strong>/, app, 'src/App.tsx');
requirePattern('immediate result is rendered', /<strong>Result:<\/strong>/, app, 'src/App.tsx');
requirePattern('world state is rendered', /<strong>The world now:<\/strong>/, app, 'src/App.tsx');
requirePattern('future consequence is conditional', /causal\.future &&/, app, 'src/App.tsx');

requirePattern('fishing causal action', /action: 'Fish the Rookguard canal\.'/, parity, '../../packages/shared/causalParity.ts');
requirePattern('merchant causal reaction', /action: 'Fish the Rookguard canal with patience\.'/, parity, '../../packages/shared/causalParity.ts');
requirePattern('caravan causal action', /action: 'Recover the charred shipment plate at the burned caravan site\./, parity, '../../packages/shared/causalParity.ts');
requirePattern('caravan guard causal reaction', /A caravan guard chose to monitor the route\./, parity, '../../packages/shared/causalParity.ts');
requirePattern('durable world state detail', /world_state:/, materializers, '../../apps/server/src/persist/materializers.ts');
requirePattern('durable fishing future detail', /next_objective:/, materializers, '../../apps/server/src/persist/materializers.ts');
requirePattern('durable caravan future detail', /next_objective: inputs\.next_objective/, materializers, '../../apps/server/src/persist/materializers.ts');
requirePattern('fishing receipt carries future detail', /next_objective: 'Wait for the canal to settle/, fishing, '../../apps/server/src/world/rookguardFishing.ts');
requirePattern('caravan receipt carries future detail', /next_objective: 'Recover the Ashglass Shard/, handlers, '../../apps/server/src/skills/handlers.ts');

console.log('\nOK — causal Chronicle visibility is wired to durable completed world events');
