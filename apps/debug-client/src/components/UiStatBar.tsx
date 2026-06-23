import { useNineSliceWeb } from '../config';
import { type UiChromeStem, useUiTextures } from '../hooks/useUiTextures';

interface UiStatBarProps {
  label: string;
  valueLabel: string;
  fillPct: number;
  fillStem?: UiChromeStem;
  low?: boolean;
  className?: string;
}

/** Classic 32 HP/MP bar using ui_bar_track + fill textures from data/assets-built/ui. */
export function UiStatBar({
  label,
  valueLabel,
  fillPct,
  fillStem = 'ui_hp_fill',
  low = false,
  className,
}: UiStatBarProps) {
  const usePng = useNineSliceWeb();
  const { textures, ready } = useUiTextures();
  const track = textures.ui_bar_track;
  const fill = textures[fillStem];
  const pngActive = usePng && ready && track.image && fill.image;
  const clamped = Math.max(0, Math.min(100, fillPct));

  return (
    <div className={['ui-stat-bar', low ? 'ui-stat-bar--low' : '', className].filter(Boolean).join(' ')}>
      <div className="ui-stat-bar__meta">
        <span>{label}</span>
        <strong>{valueLabel}</strong>
      </div>
      <div
        className={`ui-stat-bar__track ${pngActive ? 'ui-stat-bar__track--png' : 'ui-stat-bar__track--fallback'}`}
        aria-hidden
        style={
          pngActive
            ? {
                backgroundImage: `url(${track.image?.src})`,
                backgroundRepeat: 'repeat-x',
                backgroundSize: 'auto 100%',
                imageRendering: 'pixelated',
              }
            : undefined
        }
      >
        <div
          className="ui-stat-bar__fill"
          style={{
            width: `${clamped}%`,
            ...(pngActive
              ? {
                  backgroundImage: `url(${fill.image?.src})`,
                  backgroundRepeat: 'repeat-x',
                  backgroundSize: 'auto 100%',
                  imageRendering: 'pixelated',
                }
              : {}),
          }}
        />
      </div>
    </div>
  );
}