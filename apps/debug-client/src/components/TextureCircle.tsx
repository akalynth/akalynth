import { type CSSProperties, type ReactNode } from 'react';
import { useNineSliceWeb } from '../config';
import { type UiChromeStem, useUiTextures } from '../hooks/useUiTextures';

export type TextureCircleVariant =
  | 'action-ring'
  | 'action-ring-pressed'
  | 'action-ring-danger'
  | 'dpad-button'
  | 'dpad-button-pressed';

const VARIANT_STEM: Record<TextureCircleVariant, UiChromeStem> = {
  'action-ring': 'ui_action_ring',
  'action-ring-pressed': 'ui_action_ring_pressed',
  'action-ring-danger': 'ui_action_ring_danger',
  'dpad-button': 'ui_dpad_button',
  'dpad-button-pressed': 'ui_dpad_button_pressed',
};

export interface TextureCircleProps {
  variant: TextureCircleVariant;
  children?: ReactNode;
  className?: string;
  style?: CSSProperties;
  size?: number;
  forceFallback?: boolean;
}

/** Circular UI chrome (action rings, D-pad buttons) — companion to NineSlicePanel (PR-024). */
export function TextureCircle({
  variant,
  children,
  className,
  style,
  size = 40,
  forceFallback = false,
}: TextureCircleProps) {
  const usePngChrome = useNineSliceWeb() && !forceFallback;
  const { textures, ready } = useUiTextures();
  const stem = VARIANT_STEM[variant];
  const texture = textures[stem];
  const src = texture.image?.src;
  const pngActive = usePngChrome && ready && src != null;

  return (
    <div
      className={[
        'texture-circle',
        `texture-circle--${variant}`,
        pngActive ? 'texture-circle--png' : 'texture-circle--fallback',
        className,
      ]
        .filter(Boolean)
        .join(' ')}
      style={{
        width: size,
        height: size,
        position: 'relative',
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundImage: pngActive ? `url(${src})` : undefined,
        backgroundSize: '100% 100%',
        backgroundRepeat: 'no-repeat',
        imageRendering: 'pixelated',
        ...style,
      }}
    >
      {children}
    </div>
  );
}