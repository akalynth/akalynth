// Build a non-authoritative world_state fork from a loaded preview manifest.
import { validateDraftPlacements } from './validateDraftPlacements.js';
const SOURCE_MAP_NAME = {
    rookguard: 'Rookguard',
};
export function buildPreviewWorldFork(manifest) {
    const placement_validation = validateDraftPlacements(manifest);
    return {
        preview_only: true,
        namespace: manifest.preview_namespace,
        source_object: manifest.source_object,
        object_id: manifest.object_id,
        map_name: SOURCE_MAP_NAME[manifest.source_object] ?? manifest.source_object,
        rooms: (manifest.map_deltas ?? []).map((room) => ({
            room_id: room.room_id,
            cells: room.cells ?? [],
            note: room.note,
        })),
        objects: (manifest.objects ?? [])
            .filter((obj) => !!obj.placement)
            .map((obj) => ({
            id: obj.id,
            kind: obj.kind,
            text: obj.text,
            placement: obj.placement,
        })),
        npc_lines: manifest.npc_lines ?? [],
        placement_validation,
    };
}
