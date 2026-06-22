import {
  type CSSProperties,
  type ReactNode,
  useCallback,
  useEffect,
  useRef,
} from 'react';
import { useNineSliceWeb } from '../config';
import { drawNineSlice } from '../lib/nineSlice';
import { type UiChromeStem, useUiTextures } from '../hooks/useUiTextures';

export type NineSlicePanelVariant = 'panel' | 'button' | 'button-pressed' | 'dock' | 'dpad';

const VARIANT_STEM: Record<NineSlicePanelVariant, UiChromeStem> = {
  panel: 'ui_panel_frame',
  button: 'ui_button_frame',
  'button-pressed': 'ui_button_pressed_frame',
  dock: 'ui_dock_frame',
  dpad: 'ui_dpad_frame',
};

export interface NineSlicePanelProps {
  variant?: NineSlicePanelVariant;
  children?: ReactNode;
  className?: string;
  style?: CSSProperties;
  /** Inner padding in CSS pixels (applied around children). */
  padding?: number | string;
  /** Background frame opacity when PNG chrome is active. */
  alpha?: number;
  /** Integer UI scale cap (1 or 2) for crisp pixel chrome. */
  scale?: 1 | 2;
  /** Force CSS fallback even when textures are available. */
  forceFallback?: boolean;
}

/**
 * PNG nine-slice panel chrome for debug-client (PR-024).
 * When USE_NINE_SLICE_WEB is false or textures are missing, renders children inside
 * the caller's CSS classic shell (pass className e.g. hud-card).
 */
export function NineSlicePanel({
  variant = 'panel',
  children,
  className,
  style,
  padding = 12,
  alpha = 0.96,
  scale = 1,
  forceFallback = false,
}: NineSlicePanelProps) {
  const usePngChrome = useNineSliceWeb() && !forceFallback;
  const { textures, ready } = useUiTextures();
  const stem = VARIANT_STEM[variant];
  const texture = textures[stem];

  const shellRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const paint = useCallback(() => {
    const shell = shellRef.current;
    const canvas = canvasRef.current;
    const image = texture.image;
    if (!shell || !canvas || !image || texture.slicePx <= 0) return;

    const width = Math.max(1, Math.round(shell.clientWidth * scale));
    const height = Math.max(1, Math.round(shell.clientHeight * scale));

    canvas.width = width;
    canvas.height = height;
    canvas.style.width = `${shell.clientWidth}px`;
    canvas.style.height = `${shell.clientHeight}px`;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.clearRect(0, 0, width, height);
    ctx.globalAlpha = alpha;
    ctx.imageSmoothingEnabled = false;
    drawNineSlice(ctx, image, texture.slicePx, width, height);
    ctx.globalAlpha = 1;
  }, [alpha, scale, texture.image, texture.slicePx]);

  useEffect(() => {
    if (!usePngChrome || !ready || !texture.image || texture.slicePx <= 0) return;
    paint();
    const shell = shellRef.current;
    if (!shell || typeof ResizeObserver === 'undefined') return;

    const observer = new ResizeObserver(() => paint());
    observer.observe(shell);
    return () => observer.disconnect();
  }, [paint, ready, texture.image, texture.slicePx, usePngChrome]);

  const pngActive =
    usePngChrome && ready && texture.image != null && texture.slicePx > 0;

  return (
    <div
      ref={shellRef}
      className={[
        'nine-slice-panel',
        `nine-slice-panel--${variant}`,
        pngActive ? 'nine-slice-panel--png' : 'nine-slice-panel--fallback',
        className,
      ]
        .filter(Boolean)
        .join(' ')}
      style={{ position: 'relative', ...style }}
    >
      {pngActive ? (
        <canvas
          ref={canvasRef}
          className="nine-slice-panel__canvas"
          aria-hidden
          style={{
            position: 'absolute',
            inset: 0,
            pointerEvents: 'none',
            imageRendering: 'pixelated',
          }}
        />
      ) : null}
      <div
        className="nine-slice-panel__content"
        style={{ position: 'relative', padding }}
      >
        {children}
      </div>
    </div>
  );
}