import { useEffect, useMemo, useRef, useState } from 'react';
import { characterSpriteById, characterSpriteForPlayer, DIRECTION_ROW, FEET_ANCHOR, FRAME_SIZE, type Direction, type CharacterSpriteId } from '../data/characterSprites';
import { useCharacterSprites } from '../hooks/useCharacterSprites';
import { useTileSprites } from '../hooks/useTileSprites';
import { useWorldVisualAssets } from '../hooks/useWorldVisualAssets';
import { WORLD_VISUAL_ASSETS, type WorldVisualObjectPlacement, type WorldVisualAssetDef } from '../data/worldVisualAssets';
import type { MapData, PlayerPublic } from '@shared/types';
import { TileCode } from '@shared/types';
import type { FloatingText } from '../types';
import {
  LANDMARK_LORE,
  LANDMARK_MARKERS,
  SPAWN_MARKER,
  TILE_LORE,
  spawnLore,
  type LoreEntry,
} from '../data/lore';

interface GroundItem { item_id: string; item_type: string; x: number; y: number }

export interface CharacterFrameOverride {
  direction: Direction;
  frameColumn: number;
}

export interface MapDebugOverlay {
  id: string;
  x: number;
  y: number;
  width?: number;
  height?: number;
  fill: string;
  stroke: string;
  label?: string;
}

interface MapCanvasProps {
  map: MapData;
  me: PlayerPublic | null;
  others: PlayerPublic[];
  viewMode?: 'full-map' | 'follow-player';
  viewportPixels?: { width: number; height: number };
  nowMs: number;
  targetId: string | null;
  fx: FloatingText[];
  onSelectTarget: (playerId: string | null) => void;
  groundItems?: Map<string, GroundItem>;
  // Property Ownership v0: keyed by plot_id (e.g. "H1") → ownership label info.
  propertyByPlot?: Map<string, { status: string; owner_name: string | null; listed_price_gold: number | null }>;
  characterFrameOverrides?: Map<string, CharacterFrameOverride>;
  characterSpriteOverrides?: Map<string, CharacterSpriteId>;
  worldVisualObjects?: WorldVisualObjectPlacement[];
  debugOverlays?: MapDebugOverlay[];
}

const TILE_SIZE = 32;
const CHARACTER_DRAW_SCALE = 1.25;
const WALK_FRAME_MS = 140;
const FOLLOW_VIEWPORT_FALLBACK = { width: 960, height: 540 };
// How long after the last tile change a character keeps playing its walk cycle.
// Positions arrive one tile at a time, so without this window the cycle would
// only ever see a single moving frame and freeze on column 0.
const WALK_ACTIVE_MS = 240;
const OVERLAY_ALPHA = { visible: 1, faded: 0.35, hidden: 0 } as const;
// Stable empty defaults so omitting these props doesn't allocate a new array
// (and re-trigger the draw effect) on every render.
const EMPTY_WORLD_OBJECTS: WorldVisualObjectPlacement[] = [];
const EMPTY_DEBUG_OVERLAYS: MapDebugOverlay[] = [];

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

const TILE_COLOR: Record<number, string> = {
  [TileCode.Grass]: '#19351f',
  [TileCode.Stone]: '#303642',
  [TileCode.Wall]: '#0f1621',
  [TileCode.Water]: '#10324e',
  [TileCode.Door]: '#9b6d2f',
  [TileCode.TutorialMove]: '#1f5c2a',
  [TileCode.TutorialChat]: '#1d4a5c',
  [TileCode.TutorialTem]: '#5c1d37',
  [TileCode.GateToAzura]: '#4d2d73',
};

const TILE_GLYPH: Record<number, string> = {
  [TileCode.TutorialMove]: 'M',
  [TileCode.TutorialChat]: 'S',
  [TileCode.TutorialTem]: 'T',
  [TileCode.GateToAzura]: 'G',
};

type LandmarkBox = { x: number; y: number; width: number; height: number };
type CharacterMotion = { x: number; y: number; direction: Direction; movedAtMs: number };

function landmarkBox(value: unknown): LandmarkBox | null {
  if (!value || typeof value !== 'object') return null;
  const raw = value as Record<string, unknown>;
  const x = typeof raw.x === 'number' ? raw.x : null;
  const y = typeof raw.y === 'number' ? raw.y : null;
  if (x === null || y === null) return null;
  return {
    x,
    y,
    width: typeof raw.width === 'number' ? raw.width : 1,
    height: typeof raw.height === 'number' ? raw.height : 1,
  };
}

type LoreHitBox = LandmarkBox & { lore: LoreEntry };

// Flatten map landmarks that have lore into hit-boxes. Handles direct boxes and
// arrays of boxes (e.g. house_plots, which share the array-key lore entry).
function loreHitBoxes(landmarks: MapData['landmarks']): LoreHitBox[] {
  const boxes: LoreHitBox[] = [];
  for (const [key, value] of Object.entries(landmarks as Record<string, unknown>)) {
    const lore = LANDMARK_LORE[key];
    if (!lore) continue;
    if (Array.isArray(value)) {
      for (const item of value) {
        const box = landmarkBox(item);
        if (box) boxes.push({ ...box, lore });
      }
    } else {
      const box = landmarkBox(value);
      if (box) boxes.push({ ...box, lore });
    }
  }
  return boxes;
}

function loreAt(map: MapData, hitBoxes: LoreHitBox[], tx: number, ty: number): LoreEntry | null {
  if (tx < 0 || ty < 0 || tx >= map.width || ty >= map.height) return null;
  // Landmarks are more specific than tiles, so they take priority.
  for (const b of hitBoxes) {
    if (tx >= b.x && tx < b.x + b.width && ty >= b.y && ty < b.y + b.height) return b.lore;
  }
  if (tx === map.spawn.x && ty === map.spawn.y) return spawnLore(map.name);
  return TILE_LORE[map.tiles[ty * map.width + tx] as TileCode] ?? null;
}

function inferDirection(
  previous: { x: number; y: number } | null,
  current: { x: number; y: number },
  fallback: Direction = 'south',
): Direction {
  if (!previous) return fallback;
  const dx = current.x - previous.x;
  const dy = current.y - previous.y;
  if (Math.abs(dx) > Math.abs(dy)) {
    return dx > 0 ? 'east' : 'west';
  }
  if (dy !== 0) {
    return dy > 0 ? 'south' : 'north';
  }
  return fallback;
}

function getWalkColumn(isMoving: boolean, tick: number): number {
  if (!isMoving) return 0;
  return tick % 4;
}

export function MapCanvas({ map, me, others, viewMode = 'full-map', viewportPixels, nowMs, targetId, fx, onSelectTarget, groundItems, propertyByPlot, characterFrameOverrides, characterSpriteOverrides, worldVisualObjects = EMPTY_WORLD_OBJECTS, debugOverlays = EMPTY_DEBUG_OVERLAYS }: MapCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const cameraRef = useRef({ x: 0, y: 0 });
  const { images: tileSprites, ready: spritesReady } = useTileSprites();
  const { images: characterSprites, ready: charactersReady } = useCharacterSprites();
  const { images: worldVisualImages, ready: worldVisualsReady } = useWorldVisualAssets();
  const characterMotionRef = useRef<Map<string, CharacterMotion>>(new Map());
  const [tooltip, setTooltip] = useState<{ lore: LoreEntry; x: number; y: number } | null>(null);
  const othersById = useMemo(() => {
    const m = new Map<string, PlayerPublic>();
    for (const p of others) m.set(p.id, p);
    return m;
  }, [others]);
  const hitBoxes = useMemo(() => loreHitBoxes(map.landmarks), [map.landmarks]);

  const tileAtEvent = (e: { clientX: number; clientY: number }) => {
    const canvas = canvasRef.current;
    if (!canvas) return null;
    const rect = canvas.getBoundingClientRect();
    const px = (e.clientX - rect.left) * (canvas.width / rect.width);
    const py = (e.clientY - rect.top) * (canvas.height / rect.height);
    const camera = cameraRef.current;
    return { tx: Math.floor((px + camera.x) / TILE_SIZE), ty: Math.floor((py + camera.y) / TILE_SIZE) };
  };

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const worldWidth = map.width * TILE_SIZE;
    const worldHeight = map.height * TILE_SIZE;
    const followWidth = viewportPixels?.width ?? FOLLOW_VIEWPORT_FALLBACK.width;
    const followHeight = viewportPixels?.height ?? FOLLOW_VIEWPORT_FALLBACK.height;
    canvas.width = viewMode === 'follow-player' ? followWidth : worldWidth;
    canvas.height = viewMode === 'follow-player' ? followHeight : worldHeight;
    const centerX = me ? me.x * TILE_SIZE + TILE_SIZE / 2 : map.spawn.x * TILE_SIZE + TILE_SIZE / 2;
    const centerY = me ? me.y * TILE_SIZE + TILE_SIZE / 2 : map.spawn.y * TILE_SIZE + TILE_SIZE / 2;
    const cameraX = viewMode === 'follow-player'
      ? clamp(centerX - canvas.width / 2, 0, Math.max(0, worldWidth - canvas.width))
      : 0;
    const cameraY = viewMode === 'follow-player'
      ? clamp(centerY - canvas.height / 2, 0, Math.max(0, worldHeight - canvas.height))
      : 0;
    cameraRef.current = { x: cameraX, y: cameraY };
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    // Pixel-art tiles: keep hard edges when scaling 32px sprites to TILE_SIZE.
    ctx.imageSmoothingEnabled = false;

    ctx.fillStyle = '#0d1117';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.save();
    ctx.translate(-cameraX, -cameraY);

    for (let y = 0; y < map.height; y++) {
      for (let x = 0; x < map.width; x++) {
        const idx = y * map.width + x;
        const code = map.tiles[idx];
        const sprite = tileSprites.get(code);
        if (sprite) {
          ctx.drawImage(sprite, x * TILE_SIZE, y * TILE_SIZE, TILE_SIZE, TILE_SIZE);
        } else {
          // No committed art for this code (e.g. tutorial/gate tiles): flat color.
          ctx.fillStyle = TILE_COLOR[code] || '#121820';
          ctx.fillRect(x * TILE_SIZE, y * TILE_SIZE, TILE_SIZE, TILE_SIZE);
        }
        const glyph = TILE_GLYPH[code];
        if (glyph) {
          ctx.fillStyle = '#f7e9a7';
          ctx.font = 'bold 9px "Space Grotesk", sans-serif';
          ctx.fillText(glyph, x * TILE_SIZE + 3, y * TILE_SIZE + 9);
        }
      }
    }

    const drawMarker = (box: LandmarkBox, glyph: string, color: string) => {
      const cx = (box.x + box.width / 2) * TILE_SIZE;
      const cy = (box.y + box.height / 2) * TILE_SIZE;
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.arc(cx, cy, TILE_SIZE * 0.45, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#081018';
      ctx.font = 'bold 9px "Space Grotesk", sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(glyph, cx, cy + 0.5);
      ctx.textAlign = 'left';
      ctx.textBaseline = 'alphabetic';
    };

    for (const [key, value] of Object.entries(map.landmarks as Record<string, unknown>)) {
      const marker = LANDMARK_MARKERS[key];
      if (!marker) continue;
      const items = Array.isArray(value) ? value : [value];
      for (const item of items) {
        const box = landmarkBox(item);
        if (box) drawMarker(box, marker.glyph, marker.color);
      }
    }

    drawMarker(
      { x: map.spawn.x, y: map.spawn.y, width: 1, height: 1 },
      SPAWN_MARKER.glyph,
      SPAWN_MARKER.color,
    );

    // Property Ownership v0: neighborhood ownership labels above house plots.
    // Drives screenshot 3 (Neighborhood view).
    const housePlots = map.landmarks.house_plots;
    if (propertyByPlot && Array.isArray(housePlots)) {
      ctx.textAlign = 'center';
      for (const plot of housePlots) {
        const info = propertyByPlot.get(plot.id);
        if (!info) continue;
        const cx = (plot.x + plot.width / 2) * TILE_SIZE;
        const topY = plot.y * TILE_SIZE - 3;
        let label: string;
        let color: string;
        if (info.status === 'listed') {
          label = info.listed_price_gold != null ? `For Sale ${info.listed_price_gold}g` : 'For Sale';
          color = '#fbbf24';
        } else if (info.status === 'owned') {
          label = `Owned by ${info.owner_name ?? '???'}`;
          color = '#7ee787';
        } else {
          label = 'Available';
          color = '#8b949e';
        }
        ctx.font = 'bold 8px "Space Grotesk", sans-serif';
        ctx.fillStyle = '#081018';
        ctx.fillText(label, cx + 0.5, topY + 0.5);
        ctx.fillStyle = color;
        ctx.fillText(label, cx, topY);
      }
      ctx.textAlign = 'left';
    }

    if (groundItems) {
      for (const item of groundItems.values()) {
        const cx = item.x * TILE_SIZE + TILE_SIZE / 2;
        const cy = item.y * TILE_SIZE + TILE_SIZE * 0.75;
        ctx.fillStyle = '#fbbf24';
        ctx.save();
        ctx.translate(cx, cy);
        ctx.rotate(Math.PI / 4);
        ctx.fillRect(-2.5, -2.5, 5, 5);
        ctx.restore();
      }
    }

    const worldVisualAnchor = (placement: WorldVisualObjectPlacement, def: WorldVisualAssetDef) => {
      const tileLeft = placement.x * TILE_SIZE;
      const tileTop = placement.y * TILE_SIZE;
      if (def.rendering.anchor.type === 'tile_top_left') return { x: tileLeft, y: tileTop };
      if (def.rendering.anchor.type === 'bottom_left') return { x: tileLeft, y: tileTop + TILE_SIZE };
      if (def.rendering.anchor.type === 'center') return { x: tileLeft + TILE_SIZE / 2, y: tileTop + TILE_SIZE / 2 };
      return { x: tileLeft + TILE_SIZE / 2, y: tileTop + TILE_SIZE };
    };

    const drawWorldVisualObject = (placement: WorldVisualObjectPlacement, def: WorldVisualAssetDef) => {
      if (placement.visibility === 'hidden') return;
      const image = worldVisualImages.get(def.id);
      if (!image) return;
      const anchor = worldVisualAnchor(placement, def);
      const [sourceAnchorX, sourceAnchorY] = def.rendering.anchor.sourcePixels;
      const scale = def.rendering.drawScale;
      const dx = Math.round(anchor.x - sourceAnchorX * scale);
      const dy = Math.round(anchor.y - sourceAnchorY * scale);
      ctx.save();
      ctx.globalAlpha = OVERLAY_ALPHA[placement.visibility ?? 'visible'];
      ctx.imageSmoothingEnabled = false;
      ctx.drawImage(
        image,
        0,
        0,
        def.frame.width,
        def.frame.height,
        dx,
        dy,
        def.frame.width * scale,
        def.frame.height * scale,
      );
      ctx.restore();
    };

    // Resolve each placement's def once, dropping any unknown assetId so a bad id
    // skips that object instead of throwing and aborting the whole canvas render.
    const resolvedWorldObjects = worldVisualObjects
      .map((placement) => ({ placement, def: WORLD_VISUAL_ASSETS[placement.assetId] as WorldVisualAssetDef | undefined }))
      .filter((entry): entry is { placement: WorldVisualObjectPlacement; def: WorldVisualAssetDef } => Boolean(entry.def));

    for (const { placement, def } of resolvedWorldObjects) {
      if (def.rendering.layer === 'terrain') drawWorldVisualObject(placement, def);
    }

    const drawPlayerFallback = (p: PlayerPublic, color: string) => {
      const dead = p.status === 'dead';
      ctx.save();
      if (dead) ctx.globalAlpha = 0.4;
      ctx.fillStyle = color;
      ctx.fillRect(p.x * TILE_SIZE, p.y * TILE_SIZE, TILE_SIZE, TILE_SIZE);
      ctx.fillStyle = dead ? '#8a93a5' : '#0b0c10';
      ctx.font = '10px "DM Sans", sans-serif';
      ctx.fillText(p.name, p.x * TILE_SIZE + 2, p.y * TILE_SIZE - 2);
      ctx.restore();
    };

    const drawCharacter = (p: PlayerPublic, color: string, isSelf: boolean) => {
      const spriteOverride = characterSpriteOverrides?.get(p.id) ?? null;
      const sprite = spriteOverride ? characterSpriteById(spriteOverride) : characterSpriteForPlayer(p.id, isSelf);
      const previousMotion = characterMotionRef.current.get(p.id) ?? null;
      const previousPosition = previousMotion ? { x: previousMotion.x, y: previousMotion.y } : null;
      const override = characterFrameOverrides?.get(p.id) ?? null;
      const direction = override?.direction ?? inferDirection(previousPosition, p, previousMotion?.direction ?? 'south');
      const moved = !!previousMotion && (p.x !== previousMotion.x || p.y !== previousMotion.y);
      // movedAtMs marks the last tile change so the walk cycle keeps animating for a
      // short window after each step instead of freezing on the idle frame.
      const movedAtMs = moved ? nowMs : previousMotion?.movedAtMs ?? Number.NEGATIVE_INFINITY;
      const isMoving = override ? override.frameColumn !== 0 : nowMs - movedAtMs < WALK_ACTIVE_MS;
      characterMotionRef.current.set(p.id, { x: p.x, y: p.y, direction, movedAtMs });

      const image = characterSprites.get(sprite.id);
      if (!image) {
        drawPlayerFallback(p, color);
        return;
      }

      const tick = Math.floor(nowMs / WALK_FRAME_MS);
      const frameColumn = override?.frameColumn ?? getWalkColumn(isMoving, tick);
      const feetX = p.x * TILE_SIZE + TILE_SIZE / 2;
      const feetY = p.y * TILE_SIZE + TILE_SIZE;
      const dx = Math.round(feetX - FEET_ANCHOR.x * CHARACTER_DRAW_SCALE);
      const dy = Math.round(feetY - FEET_ANCHOR.y * CHARACTER_DRAW_SCALE);

      ctx.save();
      if (p.status === 'dead') ctx.globalAlpha = 0.4;
      ctx.imageSmoothingEnabled = false;
      ctx.drawImage(
        image,
        frameColumn * FRAME_SIZE,
        DIRECTION_ROW[direction] * FRAME_SIZE,
        FRAME_SIZE,
        FRAME_SIZE,
        dx,
        dy,
        FRAME_SIZE * CHARACTER_DRAW_SCALE,
        FRAME_SIZE * CHARACTER_DRAW_SCALE,
      );
      ctx.fillStyle = p.status === 'dead' ? '#8a93a5' : '#0b0c10';
      ctx.font = '10px "DM Sans", sans-serif';
      ctx.fillText(p.name, p.x * TILE_SIZE + 2, p.y * TILE_SIZE - 2);
      ctx.restore();
    };

    const renderables: Array<{ anchorY: number; draw: () => void }> = [];
    for (const { placement, def } of resolvedWorldObjects) {
      if (def.rendering.layer !== 'object_overlay') continue;
      const anchor = worldVisualAnchor(placement, def);
      renderables.push({ anchorY: anchor.y, draw: () => drawWorldVisualObject(placement, def) });
    }
    for (const p of others) {
      renderables.push({
        anchorY: p.y * TILE_SIZE + TILE_SIZE,
        draw: () => drawCharacter(p, p.status === 'dead' ? '#4b5563' : '#d2d7ff', false),
      });
    }
    if (me) {
      renderables.push({ anchorY: me.y * TILE_SIZE + TILE_SIZE, draw: () => drawCharacter(me, '#ffe08a', true) });
    }
    renderables.sort((a, b) => a.anchorY - b.anchorY).forEach((item) => item.draw());

    for (const { placement, def } of resolvedWorldObjects) {
      if (def.rendering.layer === 'floor_overlay') drawWorldVisualObject(placement, def);
    }

    for (const overlay of debugOverlays) {
      const width = overlay.width ?? 1;
      const height = overlay.height ?? 1;
      const px = overlay.x * TILE_SIZE;
      const py = overlay.y * TILE_SIZE;
      ctx.save();
      ctx.imageSmoothingEnabled = false;
      ctx.fillStyle = overlay.fill;
      ctx.strokeStyle = overlay.stroke;
      ctx.lineWidth = 2;
      ctx.fillRect(px + 2, py + 2, width * TILE_SIZE - 4, height * TILE_SIZE - 4);
      ctx.strokeRect(px + 2, py + 2, width * TILE_SIZE - 4, height * TILE_SIZE - 4);
      if (overlay.label) {
        ctx.fillStyle = overlay.stroke;
        ctx.font = 'bold 8px "Space Grotesk", sans-serif';
        ctx.fillText(overlay.label, px + 4, py + 10);
      }
      ctx.restore();
    }

    const target = targetId ? othersById.get(targetId) ?? null : null;
    if (target) {
      ctx.strokeStyle = '#e2b714';
      ctx.lineWidth = 2;
      ctx.strokeRect(target.x * TILE_SIZE + 1, target.y * TILE_SIZE + 1, TILE_SIZE - 2, TILE_SIZE - 2);
    }

    // Floating combat text
    for (const f of fx) {
      const age = nowMs - f.at;
      if (age < 0 || age > f.ttlMs) continue;
      const t = age / f.ttlMs;
      const alpha = Math.max(0, 1 - t);
      const lift = 10 + t * 14;
      ctx.save();
      ctx.globalAlpha = alpha;
      // Damage numbers (start with '-') read red; everything else white
      ctx.fillStyle = f.text.startsWith('-') ? '#ef4444' : '#ffffff';
      ctx.font = 'bold 12px "Space Grotesk", sans-serif';
      ctx.fillText(f.text, f.x * TILE_SIZE + 2, f.y * TILE_SIZE - lift);
      ctx.restore();
    }
    ctx.restore();
  }, [map, me, others, viewMode, viewportPixels?.height, viewportPixels?.width, nowMs, targetId, fx, othersById, groundItems, propertyByPlot, characterFrameOverrides, characterSpriteOverrides, worldVisualObjects, debugOverlays, tileSprites, spritesReady, characterSprites, charactersReady, worldVisualImages, worldVisualsReady]);

  return (
    <>
      <canvas
        ref={canvasRef}
        className="map-canvas"
        aria-label="world-map"
        onClick={(e) => {
          const t = tileAtEvent(e);
          if (!t) return;
          const hit = others.find((p) => p.x === t.tx && p.y === t.ty) ?? null;
          onSelectTarget(hit ? hit.id : null);
        }}
        onMouseMove={(e) => {
          const t = tileAtEvent(e);
          const lore = t ? loreAt(map, hitBoxes, t.tx, t.ty) : null;
          setTooltip(lore ? { lore, x: e.clientX, y: e.clientY } : null);
        }}
        onMouseLeave={() => setTooltip(null)}
      />
      {tooltip && (
        <div className="map-tooltip" role="tooltip" style={{ left: tooltip.x + 14, top: tooltip.y + 14 }}>
          <div className="map-tooltip-title">{tooltip.lore.title}</div>
          <div className="map-tooltip-body">{tooltip.lore.body}</div>
        </div>
      )}
    </>
  );
}
