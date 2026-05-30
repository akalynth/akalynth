// Akalynth Mob System v0 — Static training mobs
// Mobs appear in nearby_players as PlayerPublic (id prefix 'mob:').
// Server-authoritative HP. Players attack via existing attack_intent.
// No AI, no movement. Respawn after fixed delay.

import type { MapName } from '../../../../packages/shared/http.js';
import type { PlayerPublic } from '../../../../packages/shared/types.js';

export interface MobDef {
  mob_type: string;
  display_name: string;
  max_hp: number;
  map: MapName;
  x: number;
  y: number;
  respawn_ms: number;
}

export interface MobState {
  mob_id: string;
  def: MobDef;
  hp: number;
  dead_until_ms: number | null;
}

export interface MobHitResult {
  dead: boolean;
  hp: number;
  mob: MobState;
}

// ============================================================================
// Definitions
// ============================================================================

const MOB_DEFS: MobDef[] = [
  {
    mob_type: 'training_slime',
    display_name: 'Training Slime',
    max_hp: 3,
    map: 'Rookguard',
    x: 14,
    y: 14,
    respawn_ms: 30_000,
  },
  {
    mob_type: 'city_rat',
    display_name: 'City Rat',
    max_hp: 5,
    map: 'Azura',
    x: 40,
    y: 20,
    respawn_ms: 45_000,
  },
];

// ============================================================================
// State
// ============================================================================

const mobsByMap = new Map<MapName, Map<string, MobState>>();

export function initMobs(): void {
  for (const def of MOB_DEFS) {
    if (!mobsByMap.has(def.map)) mobsByMap.set(def.map, new Map());
    const mob: MobState = {
      mob_id: `mob:${def.mob_type}`,
      def,
      hp: def.max_hp,
      dead_until_ms: null,
    };
    mobsByMap.get(def.map)!.set(mob.mob_id, mob);
  }
}

// ============================================================================
// Queries
// ============================================================================

export function getAliveMobsForMap(map: MapName): MobState[] {
  const mobs = mobsByMap.get(map);
  if (!mobs) return [];
  return Array.from(mobs.values()).filter(m => m.dead_until_ms === null);
}

export function getMobById(mobId: string): MobState | null {
  for (const mobs of mobsByMap.values()) {
    const mob = mobs.get(mobId);
    if (mob) return mob;
  }
  return null;
}

export function mobToPublicPlayer(mob: MobState): PlayerPublic {
  return {
    id: mob.mob_id,
    name: mob.def.display_name,
    x: mob.def.x,
    y: mob.def.y,
    status: 'alive',
    badges: ['mob'],
    mark: 'training_mob',
  };
}

// ============================================================================
// Mutation
// ============================================================================

export function hitMob(mobId: string, damage: number): MobHitResult | null {
  for (const mobs of mobsByMap.values()) {
    const mob = mobs.get(mobId);
    if (!mob) continue;
    if (mob.dead_until_ms !== null) return null; // already dead
    mob.hp = Math.max(0, mob.hp - damage);
    if (mob.hp === 0) {
      mob.dead_until_ms = Date.now() + mob.def.respawn_ms;
    }
    return { dead: mob.hp === 0, hp: mob.hp, mob };
  }
  return null;
}

export function tickMobRespawns(): MobState[] {
  const now = Date.now();
  const revived: MobState[] = [];
  for (const mobs of mobsByMap.values()) {
    for (const mob of mobs.values()) {
      if (mob.dead_until_ms !== null && now >= mob.dead_until_ms) {
        mob.hp = mob.def.max_hp;
        mob.dead_until_ms = null;
        revived.push(mob);
      }
    }
  }
  return revived;
}
