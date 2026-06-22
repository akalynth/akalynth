import type { BuilderDraftManifest } from '@shared/builderDraft';
import type { MapData } from '@shared/types';
import { WALKABLE_TILES } from '@shared/types';
import { ROOKGUARD_BUILDER_DRAFT } from '../services/builderPreview';

export function manifestWithStudioCells(
  baseline: MapData,
  edited: MapData,
  extraCells: Array<[number, number]>,
): BuilderDraftManifest {
  const cells: Array<[number, number]> = [...extraCells];
  for (let y = 0; y < baseline.height; y++) {
    for (let x = 0; x < baseline.width; x++) {
      const i = y * baseline.width + x;
      if (baseline.tiles[i] === edited.tiles[i]) continue;
      if (!WALKABLE_TILES.has(edited.tiles[i])) continue;
      cells.push([x, y]);
    }
  }
  const unique = [...new Map(cells.map((c) => [`${c[0]},${c[1]}`, c])).values()];
  const clone = structuredClone(ROOKGUARD_BUILDER_DRAFT) as BuilderDraftManifest;
  if (unique.length > 0) {
    clone.map_deltas = [
      ...(clone.map_deltas ?? []),
      { room_id: 'studio_paint_v1', cells: unique, note: 'Studio paint delta (preview_only)' },
    ];
  }
  return clone;
}