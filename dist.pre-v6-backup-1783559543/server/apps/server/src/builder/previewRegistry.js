// Preview namespace registry overlay (PR-9) — forked draft view, no live mutation.
export function buildPreviewOverlay(manifest) {
    return {
        namespace: manifest.preview_namespace,
        source_object: manifest.source_object,
        object_id: manifest.object_id,
        rooms: (manifest.map_deltas ?? []).map((room) => ({
            room_id: room.room_id,
            cell_count: room.cells?.length ?? 0,
            note: room.note,
        })),
        objects: (manifest.objects ?? []).map((obj) => ({
            id: obj.id,
            kind: obj.kind,
            text: obj.text,
            placement: obj.placement,
        })),
        npc_lines: manifest.npc_lines ?? [],
    };
}
