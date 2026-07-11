import { useCallback, useEffect, useState } from 'react';
import type { CSSProperties, PointerEvent as ReactPointerEvent } from 'react';

export type UiPanelId = 'topbar' | 'hud' | 'controls' | 'dock' | 'status' | 'objective';

interface UiPoint {
  x: number;
  y: number;
}

type UiLayout = Record<UiPanelId, UiPoint>;

const STORAGE_PREFIX = 'akalynth.ui.layout.v2';
const PANEL_IDS: UiPanelId[] = ['topbar', 'hud', 'controls', 'dock', 'status', 'objective'];

function orientationBucket(): 'portrait' | 'landscape' {
  if (typeof window === 'undefined') return 'landscape';
  return window.innerWidth >= window.innerHeight ? 'landscape' : 'portrait';
}

function storageKey(bucket = orientationBucket()): string {
  return `${STORAGE_PREFIX}:${bucket}`;
}

function defaultLayout(): UiLayout {
  return Object.fromEntries(PANEL_IDS.map((id) => [id, { x: 0, y: 0 }])) as UiLayout;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function readStoredLayout(bucket: 'portrait' | 'landscape'): UiLayout {
  const fallback = defaultLayout();
  if (typeof window === 'undefined') return fallback;

  try {
    const raw = window.localStorage.getItem(storageKey(bucket));
    if (!raw) return fallback;
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    for (const id of PANEL_IDS) {
      const point = parsed[id];
      if (!point || typeof point !== 'object') continue;
      const candidate = point as { x?: unknown; y?: unknown };
      const x = typeof candidate.x === 'number' && Number.isFinite(candidate.x) ? candidate.x : 0;
      const y = typeof candidate.y === 'number' && Number.isFinite(candidate.y) ? candidate.y : 0;
      fallback[id] = { x, y };
    }
  } catch {
    // Layout preferences are optional; a blocked or malformed store falls back cleanly.
  }
  return fallback;
}

function dragLimit(): { x: number; y: number } {
  if (typeof window === 'undefined') return { x: 640, y: 360 };
  return {
    x: Math.max(160, Math.round(window.innerWidth * 0.8)),
    y: Math.max(160, Math.round(window.innerHeight * 0.8)),
  };
}

export function useUiLayout() {
  const [bucket, setBucket] = useState<'portrait' | 'landscape'>(() => orientationBucket());
  const [layout, setLayout] = useState<UiLayout>(() => readStoredLayout(orientationBucket()));
  const [customizeMode, setCustomizeMode] = useState(false);

  useEffect(() => {
    const reloadForOrientation = () => {
      const nextBucket = orientationBucket();
      if (nextBucket === bucket) return;
      setBucket(nextBucket);
      setLayout(readStoredLayout(nextBucket));
    };

    window.addEventListener('resize', reloadForOrientation);
    window.addEventListener('orientationchange', reloadForOrientation);
    return () => {
      window.removeEventListener('resize', reloadForOrientation);
      window.removeEventListener('orientationchange', reloadForOrientation);
    };
  }, [bucket]);

  useEffect(() => {
    try {
      window.localStorage.setItem(storageKey(bucket), JSON.stringify(layout));
    } catch {
      // Layout persistence is best effort and must never block play.
    }
  }, [bucket, layout]);

  const setPanelPosition = useCallback((id: UiPanelId, x: number, y: number) => {
    const limit = dragLimit();
    setLayout((current) => ({
      ...current,
      [id]: {
        x: clamp(Math.round(x), -limit.x, limit.x),
        y: clamp(Math.round(y), -limit.y, limit.y),
      },
    }));
  }, []);

  const beginDrag = useCallback((id: UiPanelId, event: ReactPointerEvent<HTMLButtonElement>) => {
    if (!customizeMode) return;
    event.preventDefault();
    event.stopPropagation();

    const startX = event.clientX;
    const startY = event.clientY;
    const origin = layout[id];
    const move = (moveEvent: PointerEvent) => {
      setPanelPosition(id, origin.x + moveEvent.clientX - startX, origin.y + moveEvent.clientY - startY);
    };
    const end = () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', end);
      window.removeEventListener('pointercancel', end);
    };

    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', end);
    window.addEventListener('pointercancel', end);
  }, [customizeMode, layout, setPanelPosition]);

  const nudge = useCallback((id: UiPanelId, dx: number, dy: number) => {
    const current = layout[id];
    setPanelPosition(id, current.x + dx, current.y + dy);
  }, [layout, setPanelPosition]);

  const panelStyle = useCallback((id: UiPanelId): CSSProperties => ({
    '--ui-drag-x': `${layout[id].x}px`,
    '--ui-drag-y': `${layout[id].y}px`,
  } as CSSProperties), [layout]);

  const reset = useCallback(() => {
    setLayout(defaultLayout());
  }, []);

  const toggleCustomize = useCallback(() => {
    setCustomizeMode((current) => !current);
  }, []);

  return {
    customizeMode,
    setCustomizeMode,
    toggleCustomize,
    beginDrag,
    nudge,
    panelStyle,
    reset,
    layout,
  };
}
