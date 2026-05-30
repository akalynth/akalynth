import type { PlayLoopProgress } from '@shared/types';

interface NpcRef { npc_id: string; label: string }

interface ActionsPanelProps {
  stage: 0 | 1 | 2 | 3;
  onAttack: () => void;
  onRitual: () => void;
  onTalk: (npcId: string) => void;
  attackReady: boolean;
  ritualReady: boolean;
  ritualHint: string;
  nearbyNpc: NpcRef | null;
  targetName: string | null;
  loop: PlayLoopProgress | null;
}

export function ActionsPanel({
  stage,
  onAttack,
  onRitual,
  onTalk,
  attackReady,
  ritualReady,
  ritualHint,
  nearbyNpc,
  targetName,
  loop,
}: ActionsPanelProps) {
  return (
    <div className="actions-panel" aria-label="Actions">
      <div className="mission-card">
        <span>Objective</span>
        <strong>{loop?.objective ?? 'Enter Rookguard'}</strong>
        <div className="mission-flags" aria-label="objective progress">
          <i className={loop?.move ? 'done' : ''}>Move</i>
          <i className={loop?.chat ? 'done' : ''}>Signal</i>
          <i className={loop?.tem ? 'done' : ''}>Tem</i>
          <i className={loop?.gate ? 'done' : ''}>Gate</i>
        </div>
      </div>
      {stage < 1 && <div className="action-locked">Stage 1 unlocks actions</div>}
      {stage >= 1 && (
        <>
          <div className="target-line">Target: {targetName ?? 'none'}</div>
          {!targetName && <div className="action-hint">Tap a player to target</div>}
          <button
            className={`action-btn ${attackReady ? '' : 'cooling'}`}
            onClick={() => attackReady && onAttack()}
            disabled={!attackReady}
          >
            Attack
          </button>
          <div className="ritual-line">{ritualHint}</div>
          <button
            className={`action-btn ritual-btn ${ritualReady ? '' : 'cooling'}`}
            onClick={() => ritualReady && onRitual()}
            disabled={!ritualReady}
          >
            Ritual
          </button>
          {nearbyNpc && (
            <>
              <div className="npc-line">{nearbyNpc.label} is nearby</div>
              <button
                className="action-btn talk-btn"
                onClick={() => onTalk(nearbyNpc.npc_id)}
              >
                Talk
              </button>
            </>
          )}
        </>
      )}
      {stage >= 2 && (
        <div className="hotbar">
          <div className="hotbar-slot active">Slot 1</div>
          <div className="hotbar-slot disabled">Slot 2 (locked)</div>
          <div className="hotbar-slot disabled">Slot 3 (locked)</div>
        </div>
      )}
    </div>
  );
}
