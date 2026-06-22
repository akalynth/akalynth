import { useCallback, useEffect, useMemo, useState, type CSSProperties } from 'react';
import rookguardBaseline from '@shared/maps/rookguard.json';
import type { MapData } from '@shared/types';
import { TileCode } from '@shared/types';
import { TILE_VISUALS, tileColor } from '../data/tileVisuals';
import type { BuilderDraftManifest } from '@shared/builderDraft';
import { ROOKGUARD_BUILDER_DRAFT } from '../services/builderPreview';
import { manifestWithStudioCells } from '../utils/manifestDraft';

const CELL = 34;

function cloneMap(map: MapData): MapData {
  return JSON.parse(JSON.stringify(map)) as MapData;
}

interface BuildViewProps {
  onUnsavedChange: (count: number) => void;
  onSignReady: (manifest: BuilderDraftManifest) => void;
}

export function BuildView({ onUnsavedChange, onSignReady }: BuildViewProps) {
  const baseline = useMemo(() => cloneMap(rookguardBaseline as MapData), []);
  const [map, setMap] = useState<MapData>(() => cloneMap(rookguardBaseline as MapData));
  const [tool, setTool] = useState<'brush' | 'eraser' | 'pan'>('brush');
  const [tile, setTile] = useState(TileCode.Grass);
  const [showFork, setShowFork] = useState(true);
  const [showCollision, setShowCollision] = useState(false);
  const [hover, setHover] = useState<{ x: number; y: number } | null>(null);
  const [painting, setPainting] = useState(false);

  const unsaved = useMemo(() => {
    let n = 0;
    for (let i = 0; i < baseline.tiles.length; i++) {
      if (baseline.tiles[i] !== map.tiles[i]) n++;
    }
    return n;
  }, [baseline.tiles, map.tiles]);

  useEffect(() => {
    onUnsavedChange(unsaved);
  }, [unsaved, onUnsavedChange]);

  const paint = useCallback(
    (x: number, y: number) => {
      setMap((current) => {
        const next = cloneMap(current);
        const i = y * next.width + x;
        if (tool === 'eraser') next.tiles[i] = baseline.tiles[i];
        else next.tiles[i] = tile;
        return next;
      });
    },
    [baseline, tile, tool],
  );

  const forkCells = useMemo(() => {
    const cells = new Set<string>();
    for (const room of ROOKGUARD_BUILDER_DRAFT.map_deltas ?? []) {
      for (const [x, y] of room.cells ?? []) cells.add(`${x},${y}`);
    }
    return cells;
  }, []);

  const forkObjects = useMemo(() => ROOKGUARD_BUILDER_DRAFT.objects ?? [], []);

  const cells = useMemo(() => {
    const out: Array<{
      key: string;
      style: CSSProperties;
      label?: string;
      onPointerDown: () => void;
      onPointerEnter: () => void;
    }> = [];
    for (let y = 0; y < map.height; y++) {
      for (let x = 0; x < map.width; x++) {
        const code = map.tiles[y * map.width + x];
        const key = `${x}-${y}`;
        let outline: string | undefined;
        if (showCollision && code === TileCode.Wall) outline = '1.5px solid rgba(214,92,70,.85)';
        if (showFork && forkCells.has(`${x},${y}`)) outline = '1.5px solid rgba(167,139,250,.9)';
        const obj = forkObjects.find((o) => o.placement?.[0] === x && o.placement?.[1] === y);
        out.push({
          key,
          style: {
            width: CELL,
            height: CELL,
            background: tileColor(code),
            boxShadow: 'inset 0 0 0 0.5px rgba(0,0,0,.18)',
            outline,
            outlineOffset: -1,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: 9,
            color: '#f0ede4',
            cursor: tool === 'pan' ? 'grab' : 'crosshair',
          },
          label: obj ? (obj.kind === 'sign' ? '§' : '◆') : undefined,
          onPointerDown: () => {
            if (tool === 'pan') return;
            setPainting(true);
            paint(x, y);
          },
          onPointerEnter: () => {
            setHover({ x, y });
            if (painting && tool !== 'pan') paint(x, y);
          },
        });
      }
    }
    return out;
  }, [forkCells, forkObjects, map, paint, painting, showCollision, showFork, tool]);

  return (
    <div className="studio-build">
      <div className="studio-build__tools">
        {(['brush', 'eraser', 'pan'] as const).map((t) => (
          <button key={t} type="button" className={tool === t ? 'tool-btn active' : 'tool-btn'} onClick={() => setTool(t)}>
            {t}
          </button>
        ))}
      </div>

      <aside className="studio-build__layers">
        <div className="studio-section-label">Layers</div>
        <label className="studio-row-check">
          <input type="checkbox" checked={showFork} onChange={(e) => setShowFork(e.target.checked)} />
          Builder fork overlay
        </label>
        <label className="studio-row-check">
          <input type="checkbox" checked={showCollision} onChange={(e) => setShowCollision(e.target.checked)} />
          Collision (walls)
        </label>
        <div className="studio-section-label">Active brush</div>
        <div className="studio-brush-preview" style={{ background: tileColor(tile) }} />
        <p className="studio-muted">
          scene <code>rookguard</code>
          <br />
          {map.width} × {map.height} · {CELL}px display
        </p>
      </aside>

      <div
        className="studio-build__canvas"
        onPointerUp={() => setPainting(false)}
        onPointerLeave={() => setPainting(false)}
      >
        <div className="studio-map-frame">
          <div className="studio-map-grid" style={{ gridTemplateColumns: `repeat(${map.width}, ${CELL}px)` }}>
            {cells.map((c) => (
              <div key={c.key} style={c.style} onPointerDown={c.onPointerDown} onPointerEnter={c.onPointerEnter}>
                {c.label}
              </div>
            ))}
          </div>
        </div>
      </div>

      <aside className="studio-build__palette">
        <div className="studio-section-label">Palette</div>
        <div className="studio-palette-grid">
          {TILE_VISUALS.map((entry) => (
            <button
              key={entry.code}
              type="button"
              className={tile === entry.code ? 'palette-card active' : 'palette-card'}
              onClick={() => {
                setTile(entry.code);
                setTool('brush');
              }}
            >
              <span style={{ background: entry.color }} />
              {entry.label}
            </button>
          ))}
        </div>
      </aside>

      <footer className="studio-build__footer">
        <span>
          xy <strong>{hover ? `${hover.x}, ${hover.y}` : '—'}</strong>
        </span>
        <span>
          tool <strong>{tool}</strong>
        </span>
        <span>
          unsaved <strong>{unsaved}</strong>
        </span>
        <button
          type="button"
          className="studio-sign-btn"
          onClick={() => onSignReady(ROOKGUARD_BUILDER_DRAFT)}
        >
          Save &amp; sign (kit manifest)
        </button>
        {unsaved > 0 && (
          <button
            type="button"
            className="studio-sign-btn studio-sign-btn--secondary"
            onClick={() => onSignReady(manifestWithStudioCells(baseline, map, []))}
          >
            Sign with paint delta
          </button>
        )}
      </footer>
    </div>
  );
}