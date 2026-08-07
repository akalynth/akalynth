/**
 * Source-backed memory language for the stranger-test prototype.
 *
 * Canonical source material:
 * - drop/AKALYNTH_FORGEHOLD_ROUTE_SLICE_V1/data/forgehold_route_summary.json
 * - drop/AKALYNTH_FORGEHOLD_ROUTE_SLICE_V1/docs/AKALYNTH_FORGEHOLD_ROUTE_CHRONICLE_ENTRY_V1.md
 * - drop/AKALYNTH_FIRST_PLAYABLE_SLICE_V1/data/playable_slice_summary.json
 * - drop/AKALYNTH_GAME_LOOP_BIBLE_V1/docs/AKALYNTH_PLAYER_TIME_HORIZONS_V1.md
 *
 * This is presentation copy only. Runtime truth remains the server receipt and
 * Chronicle stream; these templates do not create or mutate world state.
 */

export interface CanonicalMemoryTemplate {
  id: string;
  eventMatches: string[];
  whileAway: string;
  location: string;
  glyph: string;
}

export const FIRST_PLAYABLE_MEMORY = {
  region: 'High City Outskirts',
  minuteOne: 'Choose an Origin, meet the first faction contact, and receive a recoverable objective.',
  hourOne: 'Recover, check, deliver, or defend something that matters, then leave evidence behind.',
  source: 'AKALYNTH_FIRST_PLAYABLE_SLICE_V1 + AKALYNTH_PLAYER_TIME_HORIZONS_V1',
} as const;

export const CANONICAL_MEMORY_TEMPLATES: CanonicalMemoryTemplate[] = [
  {
    id: 'forgehold_route',
    eventMatches: ['caravan', 'forgehold', 'merchant'],
    whileAway: 'The Ember Road is partially reopened. Cinderwatch Camp is accessible, and the Forgehold Outer Gate is visible.',
    location: 'A recovered archive memory points toward a missing Flamebound shipment of Soulsteel Lantern Frames.',
    glyph: 'The Ember Road is partially reopened. Its next chapter leads toward Forgehold.',
  },
  {
    id: 'witness_moth_bloom',
    eventMatches: ['witness_moth', 'memory_bloom'],
    whileAway: 'Witness Moths are projecting fragments of a forgotten trial across High City.',
    location: 'The first recorded incident is asking whether this memory is true, false, corrupted, or dangerous.',
    glyph: 'A memory projection has left evidence in this place.',
  },
];

function eventText(details: Record<string, unknown>): string {
  return [details.event_id, details.event_type, details.route_id]
    .filter((value): value is string => typeof value === 'string')
    .join(' ')
    .toLowerCase();
}

export function canonicalMemoryForEvent(
  details: Record<string, unknown>,
): CanonicalMemoryTemplate | null {
  const text = eventText(details);
  return CANONICAL_MEMORY_TEMPLATES.find((template) =>
    template.eventMatches.some((match) => text.includes(match)),
  ) ?? null;
}
