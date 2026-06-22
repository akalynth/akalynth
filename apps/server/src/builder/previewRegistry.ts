// Preview namespace registry overlay (PR-9) — forked draft view, no live mutation.

import type { BuilderDraftManifest } from '../../../../packages/shared/builderDraft.js';

export interface PreviewRegistryOverlay {
  namespace: string;
  source_object: string;
  object_id: string;
  rooms: Array<{ room_id: string; cell_count: number; note?: string }>;
  objects: Array<{ id: string; kind: string; text?: string; placement?: [number, number] }>;
  npc_lines: Array<{ npc_id: string; line_id: string; text: string }>;
}

export function buildPreviewOverlay(manifest: BuilderDraftManifest): PreviewRegistryOverlay {
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