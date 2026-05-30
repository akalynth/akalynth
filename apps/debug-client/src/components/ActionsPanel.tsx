import type { PlayLoopProgress } from '@shared/types';

interface NpcRef { npc_id: string; label: string }
interface ItemRef { item_id: string; item_type: string; slot?: string | null }
interface GroundItem { item_id: string; item_type: string; x: number; y: number }
interface WorkContractRef {
  contract_id: string;
  payout_gold: number;
  ticks_observed: number;
  ticks_required: number;
  remaining_ms: number;
}

const SHOP_DEFS = [
  { skill_id: 'shop:pilgrim_mark', label: 'Pilgrim Mark', price: 10 },
  { skill_id: 'shop:healing_herb', label: 'Healing Herb', price: 5 },
] as const;

const USABLE_TYPES = new Set(['healing_herb', 'training_slime_goo', 'city_rat_goo']);

interface ActionsPanelProps {
  stage: 0 | 1 | 2 | 3;
  onAttack: () => void;
  onRitual: () => void;
  onTalk: (npcId: string) => void;
  onPickup: (itemId: string) => void;
  onStartWork: () => void;
  onTickWork: () => void;
  onBuy: (skillId: string) => void;
  onUseItem: (itemId: string) => void;
  attackReady: boolean;
  ritualReady: boolean;
  ritualHint: string;
  nearLegendStone: boolean;
  nearbyNpc: NpcRef | null;
  groundItemHere: GroundItem | null;
  workContract: WorkContractRef | null;
  targetName: string | null;
  loop: PlayLoopProgress | null;
  inventory: ItemRef[];
  gold: number;
}

function itemLabel(item_type: string): string {
  return item_type
    .replace(/_/g, ' ')
    .replace(/\b\w/g, c => c.toUpperCase());
}

export function ActionsPanel({
  stage,
  onAttack,
  onRitual,
  onTalk,
  onPickup,
  onStartWork,
  onTickWork,
  onBuy,
  onUseItem,
  attackReady,
  ritualReady,
  ritualHint,
  nearLegendStone,
  nearbyNpc,
  groundItemHere,
  workContract,
  targetName,
  loop,
  inventory,
  gold,
}: ActionsPanelProps) {
  const inGuildHall = nearbyNpc?.npc_id === 'azura_steward';
  const sweepRemainSec = workContract ? Math.ceil(workContract.remaining_ms / 1000) : 0;
  const hotbarItems = inventory.slice(0, 3);

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
      {gold > 0 && <div className="gold-display">Gold: {gold}</div>}
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
          {inGuildHall && (
            <div className="shop-section">
              <div className="shop-header">Guild Store</div>
              {SHOP_DEFS.map(item => (
                <button
                  key={item.skill_id}
                  className="action-btn shop-btn"
                  onClick={() => onBuy(item.skill_id)}
                  disabled={gold < item.price}
                >
                  {item.label} ({item.price}g)
                </button>
              ))}
            </div>
          )}
        </>
      )}
      {stage >= 2 && (
        <div className="hotbar">
          {hotbarItems.length > 0
            ? hotbarItems.map(item => {
                const usable = USABLE_TYPES.has(item.item_type);
                return usable ? (
                  <button
                    key={item.item_id}
                    className={`hotbar-slot active usable${item.slot === 'protected' ? ' protected' : ''}`}
                    title={`Use ${itemLabel(item.item_type)}`}
                    onClick={() => onUseItem(item.item_id)}
                  >
                    {itemLabel(item.item_type)}
                    <span className="use-hint">tap to use</span>
                  </button>
                ) : (
                  <div
                    key={item.item_id}
                    className={`hotbar-slot active${item.slot === 'protected' ? ' protected' : ''}`}
                    title={itemLabel(item.item_type)}
                  >
                    {itemLabel(item.item_type)}
                  </div>
                );
              })
            : null}
          {Array.from({ length: Math.max(0, 3 - hotbarItems.length) }).map((_, i) => (
            <div key={`empty-${i}`} className="hotbar-slot disabled">Empty</div>
          ))}
        </div>
      )}
    </div>
  );
}
