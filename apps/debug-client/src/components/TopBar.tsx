import type { CSSProperties, KeyboardEvent, PointerEvent as ReactPointerEvent } from 'react';
import type { MapName } from '@shared/http';
import { displayMapName } from '@shared/http';
import type { ConnectionState, UiStage } from '../types';
import { HudChromePanel } from './HudChromePanel';

interface TopBarProps {
  stage: UiStage['stage'];
  onStageChange: (stage: UiStage['stage']) => void;
  map: MapName;
  onMapChange: (map: MapName) => void;
  conn: ConnectionState;
  presentationMode?: boolean;
  customizeMode?: boolean;
  onToggleCustomize?: () => void;
  onResetLayout?: () => void;
  onDragStart?: (event: ReactPointerEvent<HTMLButtonElement>) => void;
  onNudge?: (event: KeyboardEvent<HTMLButtonElement>) => void;
  style?: CSSProperties;
}

const stages: UiStage['stage'][] = [0, 1, 2, 3];

function connectionLabel(conn: ConnectionState): string {
  if (conn.phase === 'error') return 'Offline';
  if (conn.phase === 'awaiting_world_state') return 'Syncing';
  return conn.phase.charAt(0).toUpperCase() + conn.phase.slice(1).replace(/_/g, ' ');
}

export function TopBar({
  stage,
  onStageChange,
  map,
  onMapChange,
  conn,
  presentationMode = false,
  customizeMode = false,
  onToggleCustomize,
  onResetLayout,
  onDragStart,
  onNudge,
  style,
}: TopBarProps) {
  const label = connectionLabel(conn);
  return (
    <header className="top-bar-shell" role="banner" data-ui-panel="topbar" style={style}>
    <HudChromePanel className="top-bar play-shell-top-bar" variant="dock" padding="0.5rem 0.75rem">
      <div className="brand">{presentationMode ? 'Akalynth' : 'Akalynth v0'}</div>
      {!presentationMode && (
        <div className="stage-gates">
          {stages.map((s) => (
            <button
              key={s}
              className={`stage-chip ${stage === s ? 'active' : ''}`}
              onClick={() => onStageChange(s)}
            >
              Stage {s}
            </button>
          ))}
        </div>
      )}
      {!presentationMode && (
        <div className="map-switcher">
          <select value={map} onChange={(e) => onMapChange(e.target.value as MapName)} disabled>
            <option value="Rookguard">Rookguard</option>
            <option value="Azura">{displayMapName('Azura')}</option>
          </select>
        </div>
      )}
      <div className={`conn-pill ${conn.phase}`}>
        {label}
      </div>
      <div className="layout-controls" aria-label="Customize layout">
        {customizeMode && (
          <button
            type="button"
            className="panel-drag-handle panel-drag-handle--topbar"
            aria-label="Drag top bar. Use arrow keys to nudge it."
            title="Drag top bar"
            onPointerDown={onDragStart}
            onKeyDown={onNudge}
          >
            Move
          </button>
        )}
        <button
          type="button"
          className="layout-toggle"
          aria-pressed={customizeMode}
          onClick={onToggleCustomize}
        >
          {customizeMode ? 'Done' : 'Layout'}
        </button>
        {customizeMode && (
          <button type="button" className="layout-reset" onClick={onResetLayout}>
            Reset
          </button>
        )}
      </div>
    </HudChromePanel>
    </header>
  );
}
