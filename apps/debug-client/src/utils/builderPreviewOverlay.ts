import type { BuilderDraftManifest } from '@shared/builderDraft';
import type { MapDebugOverlay } from '../components/MapCanvas';

export interface PreviewRegistryOverlay {
  namespace: string;
  source_object: string;
  object_id: string;
  rooms: Array<{ room_id: string; cell_count: number; note?: string }>;
  objects: Array<{ id: string; kind: string; text?: string; placement?: [number, number] }>;
  npc_lines: Array<{ npc_id: string; line_id: string; text: string }>;
}

const KIND_STYLE: Record<string, { fill: string; stroke: string; short: string }> = {
  sign: { fill: 'rgba(251, 191, 36, 0.45)', stroke: '#fbbf24', short: '§' },
  object: { fill: 'rgba(96, 165, 250, 0.4)', stroke: '#60a5fa', short: '◆' },
  spawn_anchor: { fill: 'rgba(248, 113, 113, 0.4)', stroke: '#f87171', short: '◎' },
};

const ROOM_STYLE = { fill: 'rgba(167, 139, 250, 0.35)', stroke: '#a78bfa' };

function kindStyle(kind: string) {
  return KIND_STYLE[kind] ?? { fill: 'rgba(148, 163, 184, 0.35)', stroke: '#94a3b8', short: '·' };
}

function shortLabel(text: string | undefined, fallback: string, max = 10): string {
  if (!text) return fallback;
  const trimmed = text.trim();
  if (trimmed.length <= max) return trimmed;
  return `${trimmed.slice(0, max - 1)}…`;
}

/** Build map debug overlays from server registry or local draft manifest. */
export function builderPreviewOverlays(
  source: PreviewRegistryOverlay | BuilderDraftManifest,
  cellSource?: BuilderDraftManifest,
): MapDebugOverlay[] {
  const overlays: MapDebugOverlay[] = [];
  const mapDeltas =
    ('map_deltas' in source ? source.map_deltas : undefined) ?? cellSource?.map_deltas ?? [];
  const objects = 'objects' in source && Array.isArray(source.objects) ? source.objects : [];

  if (mapDeltas.length > 0) {
    for (const room of mapDeltas) {
      for (const cell of room.cells ?? []) {
        const [x, y] = cell;
        overlays.push({
          id: `builder-room-${room.room_id}-${x}-${y}`,
          x,
          y,
          fill: ROOM_STYLE.fill,
          stroke: ROOM_STYLE.stroke,
          label: room.room_id.split('_').pop()?.slice(0, 3) ?? 'rm',
        });
      }
    }
  }

  for (const obj of objects) {
    const placement = 'placement' in obj ? obj.placement : undefined;
    if (!placement) continue;
    const [x, y] = placement;
    const style = kindStyle(obj.kind);
    overlays.push({
      id: `builder-obj-${obj.id}`,
      x,
      y,
      fill: style.fill,
      stroke: style.stroke,
      label:
        obj.kind === 'sign'
          ? shortLabel(obj.text, style.short)
          : shortLabel(obj.id.replace(/_/g, ' '), style.short, 8),
    });
  }

  return overlays;
}