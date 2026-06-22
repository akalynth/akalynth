import { atlasPublicUrl } from '../lib/atlasPaths';

export type ChronicleGlyphKind =
  | 'death'
  | 'item_pickup'
  | 'item_drop'
  | 'zone_enter'
  | 'combat_kill'
  | 'tutorial_complete'
  | 'character_created'
  | 'world_event'
  | 'unknown';

const KIND_TO_GLYPH: Record<ChronicleGlyphKind, string> = {
  death: 'sprites/effect__chronicle_death.png',
  item_pickup: 'sprites/effect__chronicle_pickup.png',
  item_drop: 'sprites/effect__chronicle_drop.png',
  zone_enter: 'sprites/effect__chronicle_zone.png',
  combat_kill: 'sprites/effect__chronicle_combat.png',
  tutorial_complete: 'sprites/effect__chronicle_tutorial.png',
  character_created: 'sprites/effect__chronicle_create.png',
  world_event: 'sprites/effect__chronicle_world.png',
  unknown: 'sprites/effect__chronicle_unknown.png',
};

/** Map debug-client chronicle event kind strings to glyph assets (PR-026). */
export function chronicleGlyphKindFromEvent(kind: string): ChronicleGlyphKind {
  switch (kind) {
    case 'death':
      return 'death';
    case 'item_pickup':
      return 'item_pickup';
    case 'item_drop':
    case 'item_lost':
      return 'item_drop';
    case 'zone_enter':
      return 'zone_enter';
    case 'combat_kill':
      return 'combat_kill';
    case 'tutorial_complete':
      return 'tutorial_complete';
    case 'character_created':
      return 'character_created';
    default:
      return 'unknown';
  }
}

export function chronicleGlyphUrl(kind: ChronicleGlyphKind): string {
  return atlasPublicUrl(KIND_TO_GLYPH[kind] ?? KIND_TO_GLYPH.unknown);
}

export function chronicleGlyphExportLabel(kind: ChronicleGlyphKind): string {
  return `[${kind}]`;
}