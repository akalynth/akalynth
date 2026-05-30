import type { PlayLoopProgress } from '@shared/types';

interface NpcRef { npc_id: string; label: string }
interface GroundItem { item_id: string; item_type: string; x: number; y: number }
interface WorkContractRef {
  contract_id: string;
  payout_gold: number;
  ticks_observed: number;
  ticks_required: number;
  remaining_ms: number;
}

interface ActionsPanelProps {
  stage: 0 | 1 | 2 | 3;
  onAttack: () => void;
  onRitual: () => void;
  onTalk: (npcId: string) => void;
  onPickup: (itemId: string) => void;
  onStartWork: () => void;
  onTickWork: () => void;
  attackReady: boolean;
  ritualReady: boolean;
  ritualHint: string;
  nearLegendStone: boolean;
  nearbyNpc: NpcRef | null;
  groundItemHere: GroundItem | null;
  workContract: WorkContractRef | null;
  targetName: string | null;
  loop: PlayLoopProgress | null;
}

export function ActionsPanel({
  stage,
  onAttack,
  onRitual,
  onTalk,
  onPickup,
  onStartWork,
  onTickWork,
  attackReady,
  ritualReady,
  ritualHint,
  nearLegendStone,
  nearbyNpc,
  groundItemHere,
  workContract,
  targetName,
  loop,
}: ActionsPanelProps) {
  const inGuildHall = nearbyNpc?.npc_id === 'azura_steward';
  const sweepRemainSec = workContract ? Math.ceil(workContract.remaining_ms / 1000) : 0;

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
      {nearLegendStone && (
        <div className="legend-stone-hint">A legend stone pulses nearby. It refuses approach.</div>
      )}
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
          {groundItemHere && (
            <>
              <div className="npc-line">{groundItemHere.item_type.replace(/_/g, ' ')} on ground</div>
              <button
                className="action-btn pickup-btn"
                onClick={() => onPickup(groundItemHere.item_id)}
              >
                Pick up
              </button>
            </>
          )}
          {workContract ? (
            <>
              <div className="sweep-line">
                Sweep: {workContract.ticks_observed}/{workContract.ticks_required} ticks
                {sweepRemainSec > 0 ? ` · ${sweepRemainSec}s left` : ''}
              </div>
              <button className="action-btn sweep-btn" onClick={onTickWork}>
                Tick
              </button>
            </>
          ) : inGuildHall && (
            <>
              <div className="sweep-line">Temple sweep available</div>
              <button className="action-btn sweep-btn" onClick={onStartWork}>
                Start Sweep
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
