// NPC Recognition v0 → Dialogue Contract v1
// Read-only interpretation layer over World Presence projection.
// NPCs may speak — they may not change the world.
//
// Dialogue Contract v1 (Path A — seeded variation):
//   Each recognition tier declares a *stable intent* plus pools of opener
//   phrasings and facts. The line a player hears is assembled
//   deterministically from a seed of (npc_id, tier, player_id, nonce)
//   using the same blake3 RNG the world uses for drops/runestones.
//
//   So an NPC says the SAME THING (intent + must_convey facts are
//   invariant) but DIFFERENTLY each time (the opener wording rotates and
//   the may_convey facts surface in varying subsets) — and because the
//   variation is seeded, it stays fully replayable and auditable. No live
//   model call, no non-determinism injected into the verification spine.
import { hasLingered, hasBeenObserved } from './presence.js';
import { rngDrawU32Legacy } from './rng.js';
// ============================================================================
// Static NPC Registry (Dialogue Contract v1)
// ============================================================================
const NPC_REGISTRY = [
    {
        npc_id: 'rookguard_guide',
        place_id: 'rookguard:plaza',
        tiers: {
            stranger: {
                intent_id: 'guide_gate_steps',
                openers: ['Welcome, traveler.', 'Well met, traveler.', 'Ah, a new face — welcome.'],
                must_convey: [
                    {
                        fact_id: 'gate_steps',
                        text: 'Move rune (3,2), chat signal, Tem rune (7,2), training slime (14,14), guild-hall vocation, then the gate.',
                    },
                    { fact_id: 'gate_opens', text: 'The gate opens only after move, chat, Tem, slime practice, and Codex vocation receipts.' },
                ],
                may_convey: [
                    { fact_id: 'no_rush', text: 'Many pass through here; none need rush it.' },
                ],
            },
            seen: {
                intent_id: 'guide_gate_reminder',
                openers: ['Still finding your way?', 'Need another pass?', 'Back at the gate?'],
                must_convey: [
                    { fact_id: 'gate_steps_short', text: 'Move, chat, Tem, then attack the training slime at (14,14) before vocation and gate.' },
                ],
                may_convey: [],
            },
            recognized: {
                intent_id: 'guide_gate_remembers',
                openers: ["You've done this before.", 'I know your step now.', 'Familiar feet on these stones.'],
                must_convey: [{ fact_id: 'gate_remembers', text: 'The gate remembers you.' }],
                may_convey: [],
            },
        },
    },
    {
        npc_id: 'rookguard_herald',
        place_id: 'rookguard:plaza',
        tiers: {
            stranger: {
                intent_id: 'herald_greet_unmet',
                openers: [
                    'Welcome to Rookguard, traveler.',
                    'New to Rookguard? Welcome.',
                    'Greetings, traveler, and welcome to Rookguard.',
                ],
                must_convey: [],
                may_convey: [{ fact_id: 'unmet', text: "I don't believe we've met." }],
            },
            seen: {
                intent_id: 'herald_greet_seen',
                openers: [
                    "I've noticed you around the plaza.",
                    "You've been about the plaza, haven't you?",
                    'A face I am starting to know.',
                ],
                must_convey: [],
                may_convey: [{ fact_id: 'settling', text: 'Settling in?' }],
            },
            recognized: {
                intent_id: 'herald_greet_recognized',
                openers: ['Ah, a familiar face!', 'There you are again!', 'Good to see you back.'],
                must_convey: [],
                may_convey: [{ fact_id: 'livelier', text: 'The plaza feels livelier with you here.' }],
            },
        },
    },
    {
        npc_id: 'rookguard_steward',
        place_id: 'rookguard:guild_hall',
        tiers: {
            stranger: {
                intent_id: 'steward_profession_choice',
                openers: ['The guild hall is open to all.', 'Welcome to the guild hall.', 'The hall doors are open to any.'],
                must_convey: [
                    {
                        fact_id: 'profession_choice',
                        text: 'At the end of Rookguard, choose a vocation: Warden, Cantor, Hexer, or Reaver.',
                    },
                    {
                        fact_id: 'codex_record',
                        text: 'The Heroes Codex remembers the First Archivist, the one who refused forgetting.',
                    },
                    {
                        fact_id: 'codex_not_power',
                        text: 'The Codex arch records the choice as identity proof, not as a power grant.',
                    },
                ],
                may_convey: [
                    { fact_id: 'quest_board', text: 'The quest board points toward the training yard before the profession mark.' },
                    { fact_id: 'shelves', text: 'Artifacts, Chronicle, Dungeon, Atlas, Factions, and Heroes shelves wait at the arch.' },
                ],
            },
            seen: {
                intent_id: 'steward_profession_reminder',
                openers: ['Back again?', 'Returning so soon?', 'You again — good.'],
                must_convey: [
                    {
                        fact_id: 'vocation_receipt',
                        text: 'Your vocation declaration writes a receipt, changes your visible badge, and binds a Heroes Codex role.',
                    },
                ],
                may_convey: [
                    { fact_id: 'training_yard', text: 'The gate waits until training and Codex vocation proof are both marked.' },
                ],
            },
            recognized: {
                intent_id: 'steward_codex_noted',
                openers: ["You've spent considerable time here.", 'You are no stranger to these walls.', 'The hall knows your footsteps.'],
                must_convey: [
                    { fact_id: 'guild_notes', text: 'The guild and Codex both take note, but neither invents your choice.' },
                    { fact_id: 'first_archivist', text: 'If you do not record it, the First Archivist would say you have not earned it.' },
                ],
                may_convey: [],
            },
        },
    },
    {
        npc_id: 'azura_herald',
        place_id: 'azura:plaza',
        tiers: {
            stranger: {
                intent_id: 'azura_herald_arrival',
                openers: [
                    'The Herald lifts a hand from the plaza stones.',
                    'A city voice meets you at the center.',
                    'The Herald marks your arrival.',
                ],
                must_convey: [
                    {
                        fact_id: 'arrival_record',
                        text: 'Rookguard has opened for you, traveler. High City receives every true thread at its center. ' +
                            'Speak plainly, move with care, and leave only what you mean to have remembered.',
                    },
                    { fact_id: 'guild_north', text: 'The guild hall is north of the plaza if you want work.' },
                ],
                may_convey: [
                    { fact_id: 'plots_wait', text: 'Marked plots wait below the hall.' },
                    { fact_id: 'bloom_seen', text: 'Witnessed events begin in public.' },
                ],
            },
            seen: {
                intent_id: 'azura_herald_tasks',
                openers: ['Back again.', 'You have returned.', 'The plaza sees you once more.'],
                must_convey: [
                    { fact_id: 'steward_tasks', text: 'The steward at the guild hall has tasks for those willing to stay.' },
                ],
                may_convey: [{ fact_id: 'plaza_remembers', text: 'The plaza remembers those who linger.' }],
            },
            recognized: {
                intent_id: 'azura_herald_sweep',
                openers: ['You know these streets now.', 'These streets are yours now.', 'No map needed for you anymore.'],
                must_convey: [
                    { fact_id: 'ask_sweep', text: 'Ask the steward about the sweep if you want to be useful.' },
                ],
                may_convey: [{ fact_id: 'deeper', text: 'The city runs deeper than the plaza.' }],
            },
        },
    },
    {
        npc_id: 'azura_steward',
        place_id: 'azura:guild_hall',
        tiers: {
            stranger: {
                intent_id: 'azura_steward_intro',
                openers: [
                    'The Steward opens the city record.',
                    "The Steward's ledger rests beside the hall door.",
                    'The Steward studies the marked plots.',
                ],
                must_convey: [
                    {
                        fact_id: 'plot_resolved_claim',
                        text: 'A plot is not yours because you stand on it. It is yours when the city resolves the claim ' +
                            'and the record holds. The marked plots below the hall are addresses waiting for a name.',
                    },
                    { fact_id: 'sweep_pays', text: 'The temple sweep pays in gold.' },
                    {
                        fact_id: 'stores',
                        text: 'With gold, you may purchase a Pilgrim Mark (10g) or a Healing Herb (5g) from the guild stores.',
                    },
                ],
                may_convey: [],
            },
            seen: {
                intent_id: 'azura_steward_open',
                openers: ['Back again.', 'You have returned to the hall.', 'Once more at the guild.'],
                must_convey: [
                    { fact_id: 'sweep_open', text: 'The sweep is always open.' },
                    { fact_id: 'stores_remain', text: 'The guild stores remain: Pilgrim Mark (10g), Healing Herb (5g).' },
                ],
                may_convey: [],
            },
            recognized: {
                intent_id: 'azura_steward_ledger',
                openers: ['The guild knows your name.', 'Your name is known here.', 'The ledger knows you well.'],
                must_convey: [{ fact_id: 'stores_open', text: 'The stores are open — buy what you need.' }],
                may_convey: [{ fact_id: 'receipts', text: 'Your receipts are in the ledger.' }],
            },
        },
    },
];
// ============================================================================
// Seeded assembly (deterministic, replayable)
// ============================================================================
/** Static fallback used when no variation context is supplied. */
const STATIC_VARIATION = { playerId: '__static__', nonce: 0 };
function seedFor(npcId, tier, v) {
    return `npc:dialogue:v1:${npcId}:${tier}:${v.playerId}:${v.nonce ?? 0}`;
}
// ============================================================================
// Exports
// ============================================================================
/**
 * Get NPC definition by ID.
 */
export function getNpcDef(npcId) {
    return NPC_REGISTRY.find(n => n.npc_id === npcId) ?? null;
}
/**
 * Get all registered NPC IDs.
 */
export function getAllNpcIds() {
    return NPC_REGISTRY.map(n => n.npc_id);
}
/**
 * Resolve dialogue tier for a player at a place.
 * Priority: recognized > seen > stranger
 */
export function resolveDialogueTier(playerId, placeId) {
    if (hasLingered(playerId, placeId))
        return 'recognized';
    if (hasBeenObserved(playerId, placeId))
        return 'seen';
    return 'stranger';
}
/**
 * Stable intent for a tier — the invariant "same thing" the NPC always means.
 * Useful for tests/QA that must not depend on the varying surface text.
 */
export function getNpcIntent(npc, tier) {
    return npc.tiers[tier].intent_id;
}
/**
 * Build an NPC dialogue line for a tier.
 *
 * Deterministic in (npc, tier, variation): the same seed always yields the
 * exact same line. Omitting `variation` yields a stable canonical line
 * (first opener, must_convey only) — handy for snapshots and golden tests.
 *
 * The opener wording rotates with the seed, and each may_convey fact surfaces
 * on an independent seeded coin — so repeat visits vary in both wording and
 * which optional facts appear, while must_convey is always present.
 */
export function buildNpcDialogue(npc, tier, variation = STATIC_VARIATION) {
    const contract = npc.tiers[tier];
    const seed = seedFor(npc.npc_id, tier, variation);
    // 1. Wording variation: pick exactly one opener.
    const opener = contract.openers.length > 0
        ? contract.openers[rngDrawU32Legacy(seed, 0) % contract.openers.length]
        : '';
    // 2. Always convey the mandatory facts, in registry order.
    const surfaced = contract.must_convey.map(f => f.text);
    // 3. Fact-surfacing variation: independent seeded coin per optional fact.
    contract.may_convey.forEach((fact, i) => {
        if (rngDrawU32Legacy(seed, 1 + i) % 2 === 0) {
            surfaced.push(fact.text);
        }
    });
    return [opener, ...surfaced].filter(part => part.length > 0).join(' ');
}
