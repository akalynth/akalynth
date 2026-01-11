import { useEffect, useMemo, useRef } from 'react';
import type { MapData, PlayerPublic } from '@shared/types';
import { TileCode } from '@shared/types';
import type { FloatingText } from '../types';

interface MapCanvasProps {
  map: MapData;
  me: PlayerPublic | null;
  others: PlayerPublic[];
  nowMs: number;
  targetId: string | null;
  fx: FloatingText[];
  onSelectTarget: (playerId: string | null) => void;
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

export function MapCanvas({ map, me, others, nowMs, targetId, fx, onSelectTarget }: MapCanvasProps) {
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
      }
    }

    const drawPlayer = (p: PlayerPublic, color: string) => {
      ctx.fillStyle = color;
      ctx.fillRect(p.x * TILE_SIZE, p.y * TILE_SIZE, TILE_SIZE, TILE_SIZE);
      ctx.fillStyle = '#0b0c10';
      ctx.font = '10px "DM Sans", sans-serif';
      ctx.fillText(p.name, p.x * TILE_SIZE + 2, p.y * TILE_SIZE - 2);
    };

    others.forEach((p) => drawPlayer(p, '#d2d7ff'));
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
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 12px "Space Grotesk", sans-serif';
      ctx.fillText(f.text, f.x * TILE_SIZE + 2, f.y * TILE_SIZE - lift);
      ctx.restore();
    }
  }, [map, me, others, nowMs, targetId, fx, othersById]);

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
