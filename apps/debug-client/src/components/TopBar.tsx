import type { MapName } from '@shared/http';
import { displayMapName } from '@shared/http';
import type { ConnectionState, UiStage } from '../types';

interface TopBarProps {
  stage: UiStage['stage'];
  onStageChange: (stage: UiStage['stage']) => void;
  map: MapName;
  onMapChange: (map: MapName) => void;
  conn: ConnectionState;
  presentationMode?: boolean;
}

const stages: UiStage['stage'][] = [0, 1, 2, 3];

export function TopBar({ stage, onStageChange, map, onMapChange, conn, presentationMode = false }: TopBarProps) {
  return (
    <header className="top-bar">
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
      <div className="map-switcher">
        <select value={map} onChange={(e) => onMapChange(e.target.value as MapName)} disabled>
          <option value="Rookguard">Rookguard</option>
          <option value="Azura">{displayMapName('Azura')}</option>
        </select>
      </div>
      <div className={`conn-pill ${conn.phase}`}>
        {conn.phase}
      </div>
    </header>
  );
}
