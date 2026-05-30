import { useEffect, useMemo, useRef } from 'react';
import type { MapData, PlayerPublic } from '@shared/types';
import { TileCode } from '@shared/types';
import type { FloatingText } from '../types';

interface GroundItem { item_id: string; item_type: string; x: number; y: number }

interface MapCanvasProps {
  map: MapData;
  me: PlayerPublic | null;
  others: PlayerPublic[];
  nowMs: number;
  targetId: string | null;
  fx: FloatingText[];
  onSelectTarget: (playerId: string | null) => void;
  groundItems?: Map<string, GroundItem>;
}

const TILE_SIZE = 12;

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

export function MapCanvas({ map, me, others, nowMs, targetId, fx, onSelectTarget, groundItems }: MapCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const othersById = useMemo(() => {
    const m = new Map<string, PlayerPublic>();
    for (const p of others) m.set(p.id, p);
    return m;
  }, [others]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    canvas.width = map.width * TILE_SIZE;
    canvas.height = map.height * TILE_SIZE;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.fillStyle = '#0d1117';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    for (let y = 0; y < map.height; y++) {
      for (let x = 0; x < map.width; x++) {
        const idx = y * map.width + x;
        const code = map.tiles[idx];
        ctx.fillStyle = TILE_COLOR[code] || '#121820';
        ctx.fillRect(x * TILE_SIZE, y * TILE_SIZE, TILE_SIZE, TILE_SIZE);
        const glyph = TILE_GLYPH[code];
        if (glyph) {
          ctx.fillStyle = '#f7e9a7';
          ctx.font = 'bold 9px "Space Grotesk", sans-serif';
          ctx.fillText(glyph, x * TILE_SIZE + 3, y * TILE_SIZE + 9);
        }
      }
    }

    const drawLandmark = (key: string, glyph: string, color: string) => {
      const box = landmarkBox((map.landmarks as Record<string, unknown>)[key]);
      if (!box) return;
      const cx = box.x * TILE_SIZE + TILE_SIZE / 2;
      const cy = box.y * TILE_SIZE + TILE_SIZE / 2;
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

    drawLandmark('runestone_table', 'R', '#f0c83c');
    drawLandmark('legend_stone', '!', '#61d8c6');

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

    const drawPlayer = (p: PlayerPublic, color: string) => {
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

    others.forEach((p) => drawPlayer(p, p.status === 'dead' ? '#4b5563' : '#d2d7ff'));
    if (me) drawPlayer(me, '#ffe08a');

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
  }, [map, me, others, nowMs, targetId, fx, othersById, groundItems]);

  return (
    <canvas
      ref={canvasRef}
      className="map-canvas"
      aria-label="world-map"
      onClick={(e) => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const rect = canvas.getBoundingClientRect();
        const scaleX = canvas.width / rect.width;
        const scaleY = canvas.height / rect.height;
        const px = (e.clientX - rect.left) * scaleX;
        const py = (e.clientY - rect.top) * scaleY;
        const tx = Math.floor(px / TILE_SIZE);
        const ty = Math.floor(py / TILE_SIZE);

        const hit = others.find((p) => p.x === tx && p.y === ty) ?? null;
        if (hit) onSelectTarget(hit.id);
        else onSelectTarget(null);
      }}
    />
  );
}
