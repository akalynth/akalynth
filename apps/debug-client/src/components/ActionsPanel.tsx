import type { PlayLoopProgress } from '@shared/types';
import {
  isUsableItemType,
  itemLabel,
  shortItemLabel,
  type InventoryItemRef,
} from '../data/inventoryPresentation';

interface NpcRef { npc_id: string; label: string }
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

const WITNESS_MOTH_ACTIONS = [
  { skill_id: 'event:witness_moth_bloom:verify_testimony', label: 'Verify testimony', short: 'Read' },
  { skill_id: 'event:witness_moth_bloom:craft_lantern_frame', label: 'Frame lantern', short: 'Frame' },
  { skill_id: 'event:witness_moth_bloom:defend_scribes', label: 'Defend scribes', short: 'Guard' },
] as const;

interface ActionsPanelProps {
  stage: 0 | 1 | 2 | 3;
  compact?: boolean;
  onAttack: () => void;
  onRitual: () => void;
  onTalk: (npcId: string) => void;
  onPickup: (itemId: string) => void;
  onStartWork: () => void;
  onTickWork: () => void;
  onBuy: (skillId: string) => void;
  onWorldEventAction: (skillId: string) => void;
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
  objectiveLabel: string;
  inventory: InventoryItemRef[];
  gold: number;
}

export function ActionsPanel({
  stage,
  compact = false,
  onAttack,
  onRitual,
  onTalk,
  onPickup,
  onStartWork,
  onTickWork,
  onBuy,
  onWorldEventAction,
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
  objectiveLabel,
  inventory,
  gold,
}: ActionsPanelProps) {
  const inGuildHall = nearbyNpc?.npc_id === 'azura_steward';
  const witnessMothOpen =
    stage >= 3 &&
    !!loop?.lastEvent?.startsWith('witness_moth_bloom_') &&
    loop.lastEvent !== 'witness_moth_bloom_resolved';
  const sweepRemainSec = workContract ? Math.ceil(workContract.remaining_ms / 1000) : 0;
  const hotbarItems = inventory.slice(0, 3);

  if (compact) {
    return (
      <div className="actions-panel actions-panel--compact" aria-label="Quick actions">
        {stage < 1 && (
          <div className="action-locked action-locked--compact">
            <strong>Locked</strong>
            <span>Tap Enter play</span>
          </div>
        )}
        {stage >= 1 && (
          <div className="mobile-hotbar" role="group" aria-label="Primary actions">
            <button
              className={`action-btn mobile-hotbar-btn attack-btn ${attackReady ? '' : 'cooling'}`}
              onClick={() => attackReady && onAttack()}
              disabled={!attackReady}
              aria-label={targetName ? `Attack ${targetName}` : 'Attack nearest available target'}
            >
              Atk
            </button>
            <button
              className={`action-btn mobile-hotbar-btn ritual-btn ${ritualReady ? '' : 'cooling'}`}
              onClick={() => ritualReady && onRitual()}
              disabled={!ritualReady}
              aria-label={ritualHint}
            >
              Rune
            </button>
            {nearbyNpc && (
              <button
                className="action-btn mobile-hotbar-btn talk-btn"
                onClick={() => onTalk(nearbyNpc.npc_id)}
                aria-label={`Talk to ${nearbyNpc.label}`}
              >
                Talk
              </button>
            )}
            {groundItemHere && (
              <button
                className="action-btn mobile-hotbar-btn pickup-btn"
                onClick={() => onPickup(groundItemHere.item_id)}
                aria-label={`Pick up ${itemLabel(groundItemHere.item_type)}`}
              >
                Pick
              </button>
            )}
            {workContract ? (
              <button
                className="action-btn mobile-hotbar-btn sweep-btn"
                onClick={onTickWork}
                aria-label={`Work tick ${workContract.ticks_observed} of ${workContract.ticks_required}${sweepRemainSec > 0 ? `, ${sweepRemainSec} seconds left` : ''}`}
              >
                Tick
              </button>
            ) : inGuildHall && (
              <button
                className="action-btn mobile-hotbar-btn sweep-btn"
                onClick={onStartWork}
                aria-label="Start temple sweep work"
              >
                Work
              </button>
            )}
            {witnessMothOpen && WITNESS_MOTH_ACTIONS.map((action) => (
              <button
                key={action.skill_id}
                className="action-btn mobile-hotbar-btn ritual-btn"
                onClick={() => onWorldEventAction(action.skill_id)}
                aria-label={action.label}
              >
                {action.short}
              </button>
            ))}
            {stage >= 2 && hotbarItems.map((item) => {
              const usable = isUsableItemType(item.item_type);
              const label = itemLabel(item.item_type);
              if (usable) {
                return (
                  <button
                    key={item.item_id}
                    className={`hotbar-slot mobile-hotbar-btn active usable${item.slot === 'protected' ? ' protected' : ''}`}
                    title={`Use ${label}`}
                    onClick={() => onUseItem(item.item_id)}
                    aria-label={`Use ${label}`}
                  >
                    {shortItemLabel(item.item_type)}
                  </button>
                );
              }
              return (
                <div
                  key={item.item_id}
                  className={`hotbar-slot mobile-hotbar-btn active${item.slot === 'protected' ? ' protected' : ''}`}
                  title={label}
                  aria-label={label}
                  role="img"
                >
                  {shortItemLabel(item.item_type)}
                </div>
              );
            })}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="actions-panel" aria-label="Actions">
      <div className="mission-card">
        <span>Objective</span>
        <strong>{objectiveLabel}</strong>
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
          {witnessMothOpen && (
            <div className="shop-section">
              <div className="shop-header">Witness Moth Bloom</div>
              {WITNESS_MOTH_ACTIONS.map(action => (
                <button
                  key={action.skill_id}
                  className="action-btn shop-btn"
                  onClick={() => onWorldEventAction(action.skill_id)}
                >
                  {action.label}
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
                const usable = isUsableItemType(item.item_type);
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
