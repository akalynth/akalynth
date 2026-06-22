import type { CSSProperties, ReactNode } from 'react';
import { useNineSliceWeb } from '../config';
import { NineSlicePanel, type NineSlicePanelVariant } from './NineSlicePanel';

interface HudChromePanelProps {
  children: ReactNode;
  className?: string;
  style?: CSSProperties;
  variant?: NineSlicePanelVariant;
  padding?: number | string;
}

/** HUD shell using PNG nine-slice when enabled, CSS classic skin otherwise (PR-027). */
export function HudChromePanel({
  children,
  className,
  style,
  variant = 'panel',
  padding,
}: HudChromePanelProps) {
  const pngChrome = useNineSliceWeb();
  if (!pngChrome) {
    return (
      <div className={className} style={style}>
        {children}
      </div>
    );
  }
  return (
    <NineSlicePanel
      variant={variant}
      className={className}
      style={style}
      padding={padding}
      alpha={0.96}
    >
      {children}
    </NineSlicePanel>
  );
}