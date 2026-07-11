import type { KeyboardEvent, PointerEvent as ReactPointerEvent, ReactNode } from 'react';
import { HudChromePanel } from './HudChromePanel';
import { NineSlicePanel } from './NineSlicePanel';

interface DockButton {
  key: string;
  label: string;
  ariaLabel: string;
  onClick: () => void;
  disabled?: boolean;
  className?: string;
}

interface PlayShellDockProps {
  buttons: DockButton[];
  statusPills: ReactNode;
  smokeState?: string;
  customizeMode?: boolean;
  onDragStart?: (event: ReactPointerEvent<HTMLButtonElement>) => void;
  onNudge?: (event: KeyboardEvent<HTMLButtonElement>) => void;
}

/** Bottom command dock — PNG chrome from data/assets-built/ui (ui_dock_frame). */
export function PlayShellDock({
  buttons,
  statusPills,
  smokeState,
  customizeMode = false,
  onDragStart,
  onNudge,
}: PlayShellDockProps) {
  return (
    <HudChromePanel
      className={`command-dock play-shell-dock proof-${smokeState ?? 'idle'}${customizeMode ? ' play-shell-dock--customize' : ''}`}
      variant="dock"
      padding={10}
    >
      {customizeMode && (
        <div className="play-shell-dock__tools">
          <button
            type="button"
            className="panel-drag-handle panel-drag-handle--dock"
            aria-label="Drag command dock. Use arrow keys to nudge it."
            title="Drag command dock"
            onPointerDown={onDragStart}
            onKeyDown={onNudge}
          >
            Move
          </button>
        </div>
      )}
      <div className="bottom-actions">
        {buttons.map((btn) => (
          <NineSlicePanel
            key={btn.key}
            variant="button"
            className={['dock-chip', btn.className].filter(Boolean).join(' ')}
            padding={0}
          >
            <button
              type="button"
              className="dock-chip__hit"
              aria-label={btn.ariaLabel}
              onClick={btn.onClick}
              disabled={btn.disabled}
            >
              {btn.label}
            </button>
          </NineSlicePanel>
        ))}
      </div>
      <div className="status-pills">{statusPills}</div>
    </HudChromePanel>
  );
}
