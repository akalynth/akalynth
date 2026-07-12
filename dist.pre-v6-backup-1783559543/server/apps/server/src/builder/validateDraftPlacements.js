// Validate builder draft cells and object placements against live shared maps.
import { isWalkable } from '../world/movement.js';
import { loadSharedMap } from '../world/state.js';
const SOURCE_MAP_FILE = {
    rookguard: 'rookguard.json',
};
function checkCell(map, ref, x, y, violations) {
    if (x < 0 || y < 0 || x >= map.width || y >= map.height) {
        violations.push({ ref, x, y, reason: 'out_of_bounds' });
        return;
    }
    if (!isWalkable(map, { x, y })) {
        violations.push({ ref, x, y, reason: 'not_walkable' });
    }
}
export function validateDraftPlacements(manifest) {
    const mapFile = SOURCE_MAP_FILE[manifest.source_object];
    if (!mapFile) {
        return {
            ok: false,
            violations: [
                {
                    ref: `source_object:${manifest.source_object}`,
                    x: 0,
                    y: 0,
                    reason: 'unknown_source_map',
                },
            ],
        };
    }
    const map = loadSharedMap(mapFile);
    const violations = [];
    for (const room of manifest.map_deltas ?? []) {
        for (const [x, y] of room.cells ?? []) {
            checkCell(map, `room:${room.room_id}`, x, y, violations);
        }
    }
    for (const obj of manifest.objects ?? []) {
        if (!obj.placement)
            continue;
        const [x, y] = obj.placement;
        checkCell(map, `object:${obj.id}`, x, y, violations);
    }
    return { ok: violations.length === 0, violations };
}
export function assertDraftPlacementsValid(manifest) {
    const result = validateDraftPlacements(manifest);
    if (!result.ok) {
        throw new Error(`invalid_draft_placements:${JSON.stringify(result.violations)}`);
    }
}
