import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import Database from 'better-sqlite3';
import type { MapData } from '../../../packages/shared/types.js';
import { materialize } from '../src/persist/materializers.js';
import { initSchema } from '../src/persist/schema.js';
import {
  assertAgentEconomySimulationInvariants,
  type AgentEconomySimulationResult,
  runAgentEconomySimulation,
} from '../src/simulation/agentEconomySimulation.js';

function loadMap(name: string): MapData {
  return JSON.parse(readFileSync(resolve(process.cwd(), '../../packages/shared/maps', name), 'utf8')) as MapData;
}

function assertEquals(actual: unknown, expected: unknown, label: string): void {
  if (actual !== expected) {
    throw new Error(`${label}: expected ${String(expected)}, got ${String(actual)}`);
  }
}

function assertAtLeast(actual: number, minimum: number, label: string): void {
  if (actual < minimum) {
    throw new Error(`${label}: expected at least ${minimum}, got ${actual}`);
  }
}

function seedProjectionPlayers(db: Database.Database, result: AgentEconomySimulationResult): void {
  const playerIds = new Set<string>([
    'system',
    ...Object.keys(result.summary.final_gold_by_agent),
    ...result.receipts.map((receipt) => receipt.actor_id).filter((id): id is string => typeof id === 'string' && id.length > 0),
  ]);
  const insertPlayer = db.prepare(`
    INSERT OR IGNORE INTO players (player_id, name, created_at, created_receipt, auth_method, name_lower)
    VALUES (?, ?, ?, ?, 'simulation', ?)
  `);
  for (const playerId of playerIds) {
    insertPlayer.run(playerId, playerId, '2026-01-01T00:00:00.000Z', `simulation:${playerId}`, playerId);
  }
}

function count(db: Database.Database, sql: string): number {
  const row = db.prepare(sql).get() as { count: number } | undefined;
  return row?.count ?? 0;
}

function verifyMaterializedProjection(result: AgentEconomySimulationResult): Record<string, number> {
  const db = new Database(':memory:');
  try {
    initSchema(db);
    seedProjectionPlayers(db, result);

    for (const receipt of result.receipts) materialize(db, receipt);
    for (const receipt of result.receipts) materialize(db, receipt);

    const materialized = {
      items: count(db, 'SELECT COUNT(*) AS count FROM items'),
      inventory_items: count(db, 'SELECT COUNT(*) AS count FROM inventory_items'),
      active_world_objects: count(db, "SELECT COUNT(*) AS count FROM world_objects WHERE status = 'active'"),
      properties: count(db, 'SELECT COUNT(*) AS count FROM properties'),
      property_sales: count(db, 'SELECT COALESCE(SUM(sale_count), 0) AS count FROM properties'),
      settled_auctions: count(db, "SELECT COUNT(*) AS count FROM property_auctions WHERE status = 'settled'"),
      deaths: count(db, 'SELECT COUNT(*) AS count FROM deaths'),
      resolved_world_events: count(db, "SELECT COUNT(*) AS count FROM world_events WHERE phase = 'resolved'"),
      chronicle_events: count(db, 'SELECT COUNT(*) AS count FROM chronicle_events'),
    };

    const finalInventoryItems = Object.values(result.summary.inventory_by_agent).reduce((total, items) => total + items.length, 0);
    const finalOwnedProperties = new Set(Object.values(result.summary.owned_properties_by_agent).flat()).size;
    assertAtLeast(materialized.items, result.summary.loot_mints, 'materialized item rows');
    assertEquals(materialized.inventory_items, finalInventoryItems, 'materialized final inventory rows');
    assertAtLeast(materialized.active_world_objects, result.summary.world_item_drops, 'materialized active world drops');
    assertAtLeast(materialized.properties, finalOwnedProperties, 'materialized properties');
    assertAtLeast(materialized.property_sales, result.summary.property_sales, 'materialized property sale count');
    assertAtLeast(materialized.settled_auctions, result.summary.auction_settlements, 'materialized settled auctions');
    assertEquals(materialized.deaths, result.summary.deaths, 'materialized death rows');
    assertEquals(materialized.resolved_world_events, result.summary.world_events_resolved, 'materialized resolved world events');
    assertAtLeast(materialized.chronicle_events, 1, 'materialized chronicle rows');

    return materialized;
  } finally {
    db.close();
  }
}

async function main(): Promise<void> {
const result = await runAgentEconomySimulation({
  seed: 42,
  days: 3,
  maps: {
    Rookguard: loadMap('rookguard.json'),
    Azura: loadMap('azura.json'),
  },
});

assertAgentEconomySimulationInvariants(result);
const materialized = verifyMaterializedProjection(result);

console.log('[verify-agent-economy-simulation] summary');
console.log(JSON.stringify(result.summary, null, 2));
console.log('[verify-agent-economy-simulation] materialized');
console.log(JSON.stringify(materialized, null, 2));
console.log(`[verify-agent-economy-simulation] training_steps=${result.steps.length}`);
console.log('[verify-agent-economy-simulation] all checks passed');
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
