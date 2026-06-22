import type { PlayLoopProgress, SovereignVocation } from '@shared/types';
import { respectRankForReputation } from '@shared/types';
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

const ROUTE_ACTIONS = [
  { skill_id: 'activity:fishing:rookguard', label: 'Fish Rookguard canal', short: 'Fish' },
  { skill_id: 'route:survey:forgehold', label: 'Survey Forgehold', short: 'Forge' },
  { skill_id: 'route:survey:moonspire', label: 'Survey Dream Gate', short: 'Dream' },
  { skill_id: 'route:safety:forgehold', label: 'Review Forgehold Safety', short: 'FSafe' },
  { skill_id: 'route:safety:moonspire', label: 'Review Dream Gate Safety', short: 'DSafe' },
  { skill_id: 'route:quest:shipment', label: 'Investigate Shipment', short: 'Ship' },
  { skill_id: 'route:economy:forgehold', label: 'Quote Forgehold Economy', short: 'Quote' },
  { skill_id: 'route:economy:settle', label: 'Settle Forgehold Ledger', short: 'Settle' },
  { skill_id: 'route:economy:payout', label: 'Credit Forgehold Payout', short: 'Pay' },
  { skill_id: 'route:craft:soulsteel', label: 'Stabilize Soulsteel', short: 'Steel' },
  { skill_id: 'route:craft:ashglass', label: 'Recover Ashglass Evidence', short: 'Glass' },
  { skill_id: 'route:craft:refine', label: 'Authorize Soulsteel Refinement', short: 'Refine' },
  { skill_id: 'route:craft:mint', label: 'Mint Soulsteel Component', short: 'Mint' },
  { skill_id: 'route:gate:heartforge', label: 'Prepare Heartforge Gate', short: 'HGate' },
  { skill_id: 'route:gate:moonspire', label: 'Prepare Dream Gate Seal', short: 'Seal' },
  { skill_id: 'route:dream:traverse', label: 'Authorize Dream Gate Traversal', short: 'Pass' },
  { skill_id: 'route:dream:arrive', label: 'Record Dream Gate Arrival', short: 'Arrv' },
  { skill_id: 'route:dream:interpret', label: 'Interpret Dream Gate', short: 'Interp' },
  { skill_id: 'route:dream:fragment', label: 'Anchor Dream Fragment', short: 'Frag' },
] as const;

type RouteActionId = typeof ROUTE_ACTIONS[number]['skill_id'];
const ROUTE_ACTION_BY_ID = new Map<RouteActionId, typeof ROUTE_ACTIONS[number]>(
  ROUTE_ACTIONS.map((action) => [action.skill_id, action]),
);

function routeActionIdsFor(onwardRoutes: NonNullable<PlayLoopProgress['onwardRoutes']>): RouteActionId[] {
  const ids: RouteActionId[] = ['activity:fishing:rookguard'];
  for (const route of onwardRoutes) {
    if (route.status !== 'available') continue;
    const completed = new Set(route.completed_objective_ids);
    if (route.route_id === 'forgehold_route_slice_v1') {
      if (!completed.has('forgehold_route_survey')) ids.push('route:survey:forgehold');
      else if (!completed.has('forgehold_missing_shipment')) ids.push('route:quest:shipment');
      else if (!completed.has('forgehold_economy_receipts')) ids.push('route:economy:forgehold');
      else if (!completed.has('soulsteel_stabilization')) ids.push('route:craft:soulsteel');
      else if (!completed.has('forgehold_abuse_notes')) ids.push('route:safety:forgehold');
      else if (!completed.has('heartforge_trial_server_gate')) ids.push('route:gate:heartforge');
      else if (!completed.has('ashglass_evidence_recovery')) ids.push('route:craft:ashglass');
      else if (!completed.has('soulsteel_refinement_authorization')) ids.push('route:craft:refine');
      else if (!completed.has('soulsteel_component_mint')) ids.push('route:craft:mint');
      else if (!completed.has('forgehold_component_settlement')) ids.push('route:economy:settle');
      else if (!completed.has('forgehold_component_payout')) ids.push('route:economy:payout');
    } else if (route.route_id === 'moonspire_dream_gate_slice_v1') {
      if (!completed.has('dream_gate_rumor')) ids.push('route:survey:moonspire');
      else if (!completed.has('symbolic_puzzle_projection')) ids.push('route:dream:interpret');
      else if (!completed.has('dream_fragment_evidence')) ids.push('route:dream:fragment');
      else if (!completed.has('dream_gate_abuse_notes')) ids.push('route:safety:moonspire');
      else if (!completed.has('dream_gate_server_seal')) ids.push('route:gate:moonspire');
      else if (!completed.has('dream_gate_traversal_authorization')) ids.push('route:dream:traverse');
      else if (!completed.has('dream_gate_arrival_record')) ids.push('route:dream:arrive');
    }
  }
  return ids;
}

const VOCATION_ACTIONS: Array<{ vocation: SovereignVocation; label: string; short: string }> = [
  { vocation: 'warden', label: 'Warden', short: 'Ward' },
  { vocation: 'cantor', label: 'Cantor', short: 'Cant' },
  { vocation: 'hexer', label: 'Hexer', short: 'Hex' },
  { vocation: 'reaver', label: 'Reaver', short: 'Reav' },
];

interface ActionsPanelProps {
  stage: 0 | 1 | 2 | 3;
  compact?: boolean;
  presentationMode?: boolean;
  onAttack: () => void;
  onRitual: () => void;
  onTalk: (npcId: string) => void;
  onDeclareVocation: (vocation: SovereignVocation) => void;
  onPickup: (itemId: string) => void;
  onStartWork: () => void;
  onTickWork: () => void;
  onBuy: (skillId: string) => void;
  onWorldEventAction: (skillId: string) => void;
  onHousePlot?: boolean;
  insideHouse?: boolean;
  isGuildMember?: boolean;
  hasTarget?: boolean;
  onGrantHouse?: () => void;
  onGiftGold: () => void;
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
  reputation: number;
}

export function ActionsPanel({
  stage,
  compact = false,
  presentationMode = false,
  onAttack,
  onRitual,
  onTalk,
  onDeclareVocation,
  onPickup,
  onStartWork,
  onTickWork,
  onBuy,
  onWorldEventAction,
  onHousePlot = false,
  insideHouse = false,
  isGuildMember = false,
  hasTarget = false,
  onGrantHouse,
  onGiftGold,
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
  reputation,
}: ActionsPanelProps) {
  const respectRank = respectRankForReputation(reputation);
  const inGuildHall = nearbyNpc?.npc_id === 'azura_steward';
  const inRookguardProfessionHall = nearbyNpc?.npc_id === 'rookguard_steward';
  const rookguardQuest = loop?.rookguardQuest ?? null;
  const codexProfession = rookguardQuest?.codexProfession ?? null;
  const onwardRoutes = loop?.onwardRoutes ?? [];
  const routeActionIds = routeActionIdsFor(onwardRoutes);
  const routeActions = routeActionIds.flatMap((skillId) => {
    const action = ROUTE_ACTION_BY_ID.get(skillId);
    return action ? [action] : [];
  });
  const routeActionsOpen = routeActions.length > 0;
  const primaryRouteAction = routeActions[0] ?? null;
  const witnessMothOpen =
    stage >= 3 &&
    !!loop?.lastEvent?.startsWith('witness_moth_bloom_') &&
    loop.lastEvent !== 'witness_moth_bloom_resolved';
  const sweepRemainSec = workContract ? Math.ceil(workContract.remaining_ms / 1000) : 0;
  const hotbarItems = inventory.slice(0, 3);
  const compactActionLabel =
    primaryRouteAction?.label ??
    (nearbyNpc ? `Talk to ${nearbyNpc.label}` :
      groundItemHere ? `Pick up ${itemLabel(groundItemHere.item_type)}` :
        attackReady ? 'Attack ready' :
          ritualReady ? 'Rune ready' :
            'Ready');

  if (compact) {
    return (
      <div className="actions-panel actions-panel--compact" aria-label="Quick actions">
        {presentationMode ? (
          <div className="compact-action-card" aria-label="Action dock">
            <span>Actions</span>
            <strong>{compactActionLabel}</strong>
            {primaryRouteAction && <em>{primaryRouteAction.short}</em>}
          </div>
        ) : (
          <div className="compact-objective-card" aria-label="Current objective">
            <span>Objective</span>
            <strong>{objectiveLabel}</strong>
            {primaryRouteAction && <em>Action: {primaryRouteAction.short}</em>}
          </div>
        )}
        {!presentationMode && stage < 1 && (
          <div className="action-locked action-locked--compact">
            <strong>Locked</strong>
            <span>Tap Enter play</span>
          </div>
        )}
        {stage >= 1 && (
          <div className="mobile-hotbar" role="group" aria-label="Primary actions">
            {routeActionsOpen && routeActions.map((action) => (
              <button
                key={action.skill_id}
                className="action-btn mobile-hotbar-btn ritual-btn route-action-btn"
                onClick={() => onWorldEventAction(action.skill_id)}
                aria-label={action.label}
              >
                {action.short}
              </button>
            ))}
            {(!presentationMode || attackReady) && (
              <button
                className={`action-btn mobile-hotbar-btn attack-btn ${attackReady ? '' : 'cooling'}`}
                onClick={() => attackReady && onAttack()}
                disabled={!attackReady}
                aria-label={targetName ? `Attack ${targetName}` : 'Attack nearest available target'}
              >
                Atk
              </button>
            )}
            {(!presentationMode || ritualReady) && (
              <button
                className={`action-btn mobile-hotbar-btn ritual-btn ${ritualReady ? '' : 'cooling'}`}
                onClick={() => ritualReady && onRitual()}
                disabled={!ritualReady}
                aria-label={ritualHint}
              >
                Rune
              </button>
            )}
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
            {(inRookguardProfessionHall || inGuildHall) && (
              <button
                className="action-btn mobile-hotbar-btn shop-btn"
                onClick={() => onWorldEventAction(isGuildMember ? 'guild:contribute' : 'guild:join')}
                aria-label={isGuildMember ? 'Tend the guild' : 'Join the guild'}
              >
                {isGuildMember ? 'Tend' : 'Guild'}
              </button>
            )}
            {onHousePlot && !insideHouse && (
              <button
                className="action-btn mobile-hotbar-btn pickup-btn"
                onClick={() => onWorldEventAction('house:enter')}
                aria-label="Enter your house"
              >
                Enter
              </button>
            )}
            {insideHouse && (
              <button
                className="action-btn mobile-hotbar-btn pickup-btn"
                onClick={() => onWorldEventAction('house:exit')}
                aria-label="Leave your house"
              >
                Leave
              </button>
            )}
            {inRookguardProfessionHall && VOCATION_ACTIONS.map((action) => (
              <button
                key={action.vocation}
                className="action-btn mobile-hotbar-btn ritual-btn"
                onClick={() => onDeclareVocation(action.vocation)}
                aria-label={`Declare ${action.label}`}
              >
                {action.short}
              </button>
            ))}
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
        {!presentationMode && (
          <>
            <div className="mission-flags" aria-label="objective progress">
              <i className={loop?.move ? 'done' : ''}>Move</i>
              <i className={loop?.chat ? 'done' : ''}>Signal</i>
              <i className={loop?.tem ? 'done' : ''}>Tem</i>
              <i className={loop?.gate ? 'done' : ''}>Gate</i>
            </div>
            {rookguardQuest && (
              <div className="quest-flags" aria-label={`${rookguardQuest.title} progress`}>
                {rookguardQuest.steps.map((step) => (
                  <i key={step.step_id} className={step.complete ? 'done' : ''}>
                    {step.label}
                  </i>
                ))}
              </div>
            )}
            {codexProfession && (
              <div className="codex-profession" aria-label="Codex profession">
                <span>Codex</span>
                <strong>{codexProfession.title}</strong>
                <p>{codexProfession.oath}</p>
                <small>{codexProfession.codex_anchor.object_id} · {codexProfession.codex_anchor.status}</small>
                <ul>
                  {codexProfession.starter_actions.map((action) => (
                    <li key={action}>{action}</li>
                  ))}
                </ul>
              </div>
            )}
            {rookguardQuest?.codexShelves && (
              <div className="codex-shelves" aria-label="Codex shelves">
                {rookguardQuest.codexShelves.map((shelf) => (
                  <i key={shelf.object_id} className={shelf.role === 'active_profession_lore' ? 'active' : ''} title={shelf.gameplay_hint}>
                    {shelf.title}
                  </i>
                ))}
              </div>
            )}
            {onwardRoutes.length > 0 && (
              <div className="codex-shelves onward-routes" aria-label="Onward routes">
                {onwardRoutes.map((route) => {
                  const completed = new Set(route.completed_objective_ids);
                  const routeOpen = route.status === 'available';
                  const nextObjectiveId = routeOpen ? route.objectives.find((objective) => !completed.has(objective.id))?.id ?? null : null;
                  const routeStepObjectives = route.objectives.filter((objective) => objective.system !== 'ui' && objective.system !== 'android');
                  const routeStepCompleted = routeStepObjectives.filter((objective) => completed.has(objective.id)).length;
                  return (
                    <article
                      key={route.route_id}
                      className={`onward-route-card ${routeOpen ? 'active' : ''}`}
                      title={`Source: ${route.source_drop}`}
                    >
                      <strong>
                        {routeOpen ? 'Open' : 'Locked'}: {route.title} ({routeStepCompleted}/{routeStepObjectives.length})
                      </strong>
                      <span>{route.next_objective}</span>
                      <ul>
                        {route.objectives.map((objective) => (
                          <li key={objective.id} className={completed.has(objective.id) ? 'done' : ''}>
                            <b>{completed.has(objective.id) ? 'Done' : !routeOpen ? 'Locked' : objective.id === nextObjectiveId ? 'Next' : 'Later'}</b>
                            {objective.label}
                            <small>{objective.system}</small>
                          </li>
                        ))}
                      </ul>
                    </article>
                  );
                })}
              </div>
            )}
          </>
        )}
        {routeActionsOpen && (
          <div className="shop-actions" aria-label="Route actions">
            {routeActions.map((action) => (
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
      </div>
      {gold > 0 && <div className="gold-display">Gold: {gold}</div>}
      {!presentationMode && <div className="gold-display">Respect: {respectRank} ({reputation})</div>}
      {nearLegendStone && (
        <div className="legend-stone-hint">A legend stone pulses nearby. It refuses approach.</div>
      )}
      {!presentationMode && stage < 1 && <div className="action-locked">Stage 1 unlocks actions</div>}
      {stage >= 1 && (
        <>
          {!presentationMode && <div className="target-line">Target: {targetName ?? 'none'}</div>}
          {!presentationMode && !targetName && <div className="action-hint">Tap a player to target</div>}
          {targetName && (
            <button
              className="action-btn ritual-btn"
              onClick={onGiftGold}
              disabled={gold < 1}
            >
              Gift 1g
            </button>
          )}
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
          {(inGuildHall || inRookguardProfessionHall) && (
            <div className="shop-section">
              <div className="shop-header">Guild</div>
              {isGuildMember ? (
                <button
                  className="action-btn shop-btn"
                  onClick={() => onWorldEventAction('guild:contribute')}
                >
                  Tend the Guild
                </button>
              ) : (
                <button
                  className="action-btn shop-btn"
                  onClick={() => onWorldEventAction('guild:join')}
                >
                  Join the Guild
                </button>
              )}
            </div>
          )}
          {(onHousePlot || insideHouse) && (
            <div className="shop-section">
              <div className="shop-header">House</div>
              {onHousePlot && !insideHouse && (
                <button className="action-btn pickup-btn" onClick={() => onWorldEventAction('house:enter')}>
                  Enter House
                </button>
              )}
              {insideHouse && (
                <button className="action-btn pickup-btn" onClick={() => onWorldEventAction('house:exit')}>
                  Leave House
                </button>
              )}
              {onHousePlot && hasTarget && onGrantHouse && (
                <button className="action-btn talk-btn" onClick={onGrantHouse}>
                  Grant Access
                </button>
              )}
            </div>
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
          {inRookguardProfessionHall && (
            <>
              <div className="npc-line">Choose a vocation</div>
              <div className="shop-actions" aria-label="Vocation choices">
                {VOCATION_ACTIONS.map((action) => (
                  <button
                    key={action.vocation}
                    className="action-btn shop-btn"
                    onClick={() => onDeclareVocation(action.vocation)}
                  >
                    {action.label}
                  </button>
                ))}
              </div>
            </>
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
          {routeActionsOpen && (
            <div className="shop-section">
              <div className="shop-header">Onward Routes</div>
              {routeActions.map(action => (
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
