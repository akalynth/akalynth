interface ActionsPanelProps {
  stage: 0 | 1 | 2 | 3;
  onAttack: () => void;
  attackReady: boolean;
  targetName: string | null;
}

export function ActionsPanel({ stage, onAttack, attackReady, targetName }: ActionsPanelProps) {
  return (
    <div className="actions-panel" aria-label="Actions">
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
