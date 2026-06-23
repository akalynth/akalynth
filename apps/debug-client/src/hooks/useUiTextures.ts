import { useEffect, useMemo, useState } from 'react';
import type { UiAssetKind } from '@shared/assetRegistry';
import { uiBuiltPublicUrl } from '../lib/uiPaths';
import { uiRegistryEntry, useAssetRegistry } from './useAssetRegistry';

export type UiChromeStem =
  | 'ui_panel_frame'
  | 'ui_button_frame'
  | 'ui_button_pressed_frame'
  | 'ui_dock_frame'
  | 'ui_dpad_frame'
  | 'ui_action_ring'
  | 'ui_action_ring_pressed'
  | 'ui_action_ring_danger'
  | 'ui_dpad_button'
  | 'ui_dpad_button_pressed'
  | 'ui_hp_fill'
  | 'ui_mp_fill'
  | 'ui_bar_track';

export interface UiTextureSlice {
  image: HTMLImageElement | null;
  slicePx: number;
  kind: UiAssetKind | 'unknown';
}

export type UiTextureMap = Record<UiChromeStem, UiTextureSlice>;

const UI_STEMS: UiChromeStem[] = [
  'ui_panel_frame',
  'ui_button_frame',
  'ui_button_pressed_frame',
  'ui_dock_frame',
  'ui_dpad_frame',
  'ui_action_ring',
  'ui_action_ring_pressed',
  'ui_action_ring_danger',
  'ui_dpad_button',
  'ui_dpad_button_pressed',
  'ui_hp_fill',
  'ui_mp_fill',
  'ui_bar_track',
];

const FALLBACK_SLICE: Record<UiChromeStem, number> = {
  ui_panel_frame: 8,
  ui_button_frame: 6,
  ui_button_pressed_frame: 6,
  ui_dock_frame: 8,
  ui_dpad_frame: 10,
  ui_action_ring: 0,
  ui_action_ring_pressed: 0,
  ui_action_ring_danger: 0,
  ui_dpad_button: 0,
  ui_dpad_button_pressed: 0,
  ui_hp_fill: 2,
  ui_mp_fill: 2,
  ui_bar_track: 2,
};

function emptyTextureMap(): UiTextureMap {
  return UI_STEMS.reduce((acc, stem) => {
    acc[stem] = { image: null, slicePx: FALLBACK_SLICE[stem], kind: 'unknown' };
    return acc;
  }, {} as UiTextureMap);
}

/**
 * Loads Classic 32 UI chrome from compiled registry entries (loose PNG mirrors).
 * Mirrors Android rememberUiTextures(); missing keys keep CSS fallback paths alive.
 */
export function useUiTextures(): { textures: UiTextureMap; ready: boolean; loadedCount: number } {
  const { registry, ready: registryReady } = useAssetRegistry();
  const [textures, setTextures] = useState<UiTextureMap>(emptyTextureMap);
  const [ready, setReady] = useState(false);
  const [loadedCount, setLoadedCount] = useState(0);

  const loadPlan = useMemo((): Array<{
    stem: UiChromeStem;
    src: string | null;
    slicePx: number;
    kind: UiTextureSlice['kind'];
  }> => {
    if (!registry) return [];
    return UI_STEMS.map((stem) => {
      const entry = uiRegistryEntry(registry, stem);
      const kind: UiTextureSlice['kind'] = entry?.kind ?? 'unknown';
      return {
        stem,
        src: entry ? uiBuiltPublicUrl(entry.file.replace(/^ui\//, '')) : null,
        slicePx: entry?.slice_px ?? FALLBACK_SLICE[stem],
        kind,
      };
    });
  }, [registry]);

  useEffect(() => {
    if (!registryReady) return;

    let cancelled = false;
    const next = emptyTextureMap();
    setTextures(next);

    if (loadPlan.length === 0) {
      setLoadedCount(0);
      setReady(true);
      return;
    }

    let pending = loadPlan.filter((item) => item.src != null).length;
    if (pending === 0) {
      setLoadedCount(0);
      setReady(true);
      return;
    }

    let loaded = 0;
    for (const item of loadPlan) {
      if (!item.src) continue;
      const img = new Image();
      img.onload = () => {
        if (cancelled) return;
        next[item.stem] = {
          image: img,
          slicePx: item.slicePx,
          kind: item.kind,
        };
        loaded += 1;
        setTextures({ ...next });
        setLoadedCount(loaded);
        pending -= 1;
        if (pending === 0) setReady(true);
      };
      img.onerror = () => {
        if (cancelled) return;
        pending -= 1;
        if (pending === 0) setReady(true);
      };
      img.src = item.src;
    }

    return () => {
      cancelled = true;
    };
  }, [registryReady, loadPlan]);

  return { textures, ready, loadedCount };
}