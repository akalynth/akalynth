// NPC Recognition v0
// Read-only interpretation layer over World Presence projection
// NPCs may speak — they may not change the world.

import type { PlaceId } from '../../../../packages/shared/types.js';
import type { NpcRecognitionTier } from '../../../../packages/shared/protocol.js';
import { hasLingered, hasBeenObserved } from './presence.js';

// ============================================================================
// NPC Definition
// ============================================================================

interface NpcDef {
  npc_id: string;
  place_id: PlaceId;
  lines: {
    stranger: string;
    seen: string;
    recognized: string;
  };
}

// ============================================================================
// Static NPC Registry (v0)
// ============================================================================

const NPC_REGISTRY: NpcDef[] = [
  {
    npc_id: 'rookguard_guide',
    place_id: 'rookguard',
    lines: {
      stranger: "Welcome, traveler. Step onto the glowing rune ahead, then send a chat signal, then answer Tem's challenge. The gate to Azura opens when all three are done.",
      seen: "Still finding your way? Move rune, then chat, then answer Tem — the gate will open.",
      recognized: "You've done this before. The gate remembers you.",
    },
  },
  {
    npc_id: 'rookguard_herald',
    place_id: 'rookguard:plaza',
    lines: {
      stranger: "Welcome to Rookguard, traveler. I don't believe we've met.",
      seen: "I've noticed you around the plaza. Settling in?",
      recognized: "Ah, a familiar face! The plaza feels livelier with you here.",
    },
  },
  {
    npc_id: 'rookguard_steward',
    place_id: 'rookguard:guild_hall',
    lines: {
      stranger: "The guild hall is open to all. How may I assist you?",
      seen: "Back again? The hall remembers those who visit.",
      recognized: "You've spent considerable time here. The guild takes note.",
    },
  },
  {
    npc_id: 'azura_herald',
    place_id: 'azura:plaza',
    lines: {
      stranger: "You made it through Rookguard — not everyone does. The guild hall is north of the plaza if you want work. And if you feel drawn toward something you cannot name, that is normal. Walk carefully.",
      seen: "Back again. The plaza remembers those who linger. The steward at the guild hall has tasks for those willing to stay.",
      recognized: "You know these streets now. The city runs deeper than the plaza. Ask the steward about the sweep if you want to be useful.",
    },
  },
  {
    npc_id: 'azura_steward',
    place_id: 'azura:guild_hall',
    lines: {
      stranger: "The guild offers work and trade. The temple sweep pays in gold. With gold, you may purchase a Pilgrim Mark (10g) or a Healing Herb (5g) from the guild stores.",
      seen: "Back again. The sweep is always open. The guild stores remain: Pilgrim Mark (10g), Healing Herb (5g).",
      recognized: "The guild knows your name. Your receipts are in the ledger. The stores are open — buy what you need.",
    },
  },
];

// ============================================================================
// Exports
// ============================================================================

/**
 * Get NPC definition by ID.
 */
export function getNpcDef(npcId: string): NpcDef | null {
  return NPC_REGISTRY.find(n => n.npc_id === npcId) ?? null;
}

/**
 * Get all registered NPC IDs.
 */
export function getAllNpcIds(): string[] {
  return NPC_REGISTRY.map(n => n.npc_id);
}

/**
 * Resolve dialogue tier for a player at a place.
 * Priority: recognized > seen > stranger
 */
export function resolveDialogueTier(playerId: string, placeId: PlaceId): NpcRecognitionTier {
  if (hasLingered(playerId, placeId)) return 'recognized';
  if (hasBeenObserved(playerId, placeId)) return 'seen';
  return 'stranger';
}

/**
 * Build NPC dialogue line for a tier.
 */
export function buildNpcDialogue(npc: NpcDef, tier: NpcRecognitionTier): string {
  return npc.lines[tier];
}
