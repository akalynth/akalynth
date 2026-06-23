import type { ReactNode } from 'react';
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
}

/** Bottom command dock — PNG chrome from data/assets-built/ui (ui_dock_frame). */
export function PlayShellDock({ buttons, statusPills, smokeState }: PlayShellDockProps) {
  return (
    <HudChromePanel
      className={`command-dock play-shell-dock proof-${smokeState ?? 'idle'}`}
      variant="dock"
      padding={10}
    >
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