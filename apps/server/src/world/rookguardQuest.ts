import type {
  AuditReceipt,
  OnwardRouteProgress,
  RookguardCodexAnchor,
  RookguardCodexProfession,
  RookguardCodexShelf,
  RookguardQuestProgress,
  SovereignVocation,
  TutorialStep,
  TutorialProgress,
} from '../../../../packages/shared/types.js';
import {
  SOVEREIGN_VOCATIONS,
  TEM_CHALLENGE_RESPONSE,
  VOCATION_DECLARED_ACTION,
} from '../../../../packages/shared/types.js';
import { FORGEHOLD_CARAVAN_ACTIVITY_ID } from '../../../../packages/shared/skills.js';
import type { OnwardRouteReceiptProgress } from './onwardRoutes.js';

export interface RookguardQuestInput {
  tutorial: TutorialProgress;
  trainingComplete: boolean;
  vocation: SovereignVocation | null;
}

function defaultTutorialProgress(): TutorialProgress {
  return { move: false, chat: false, tem: false, gate: false, complete: false };
}

function defaultRookguardQuestInput(): RookguardQuestInput {
  return {
    tutorial: defaultTutorialProgress(),
    trainingComplete: false,
    vocation: null,
  };
}

const rookguardQuestByPlayerId = new Map<string, RookguardQuestInput>();

function cloneRookguardQuestInput(input: RookguardQuestInput): RookguardQuestInput {
  return {
    tutorial: { ...input.tutorial },
    trainingComplete: input.trainingComplete,
    vocation: input.vocation,
  };
}

export function getRookguardQuestInput(playerId: string): RookguardQuestInput {
  return cloneRookguardQuestInput(rookguardQuestByPlayerId.get(playerId) ?? defaultRookguardQuestInput());
}

export function clearRookguardQuestProjection(): void {
  rookguardQuestByPlayerId.clear();
}

function setRookguardQuestInput(playerId: string, next: RookguardQuestInput): void {
  rookguardQuestByPlayerId.set(playerId, cloneRookguardQuestInput(next));
}

function validTutorialStep(value: unknown): value is TutorialStep {
  return value === 'move' || value === 'chat' || value === 'tem' || value === 'gate';
}

function validVocation(value: unknown): value is SovereignVocation {
  return typeof value === 'string' && SOVEREIGN_VOCATIONS.includes(value as SovereignVocation);
}

export function applyReceiptToRookguardQuest(receipt: AuditReceipt): void {
  const playerId = receipt.actor_id;
  if (!playerId || receipt.result === 'rejected') return;

  const current = getRookguardQuestInput(playerId);
  let next: RookguardQuestInput | null = null;

  if (receipt.action === 'tutorial_step_complete' && validTutorialStep(receipt.inputs?.step)) {
    next = {
      ...current,
      tutorial: {
        ...current.tutorial,
        [receipt.inputs.step]: true,
      },
    };
  } else if (receipt.action === 'mob_kill') {
    if (receipt.inputs?.map === 'Rookguard' && receipt.inputs?.mob_type === 'training_slime') {
      next = {
        ...current,
        trainingComplete: true,
      };
    }
  } else if (receipt.action === VOCATION_DECLARED_ACTION && validVocation(receipt.inputs?.vocation)) {
    next = {
      ...current,
      vocation: receipt.inputs.vocation,
    };
  } else if (receipt.action === 'gate_unlock' || receipt.action === 'tutorial_completed') {
    next = {
      ...current,
      tutorial: {
        ...current.tutorial,
        gate: true,
        complete: true,
      },
    };
  }

  if (next) setRookguardQuestInput(playerId, next);
}

export const ROOKGUARD_CODEX_SHELVES: RookguardCodexShelf[] = [
  {
    object_id: 'artifacts-codex',
    title: 'Artifacts Codex',
    subtitle: 'Relics of Power.',
    role: 'future_lane',
    gameplay_hint: 'Future relic and equipment proofs; no Rookguard reward or power grant yet.',
  },
  {
    object_id: 'chronicle-of-ages',
    title: 'Chronicle of Ages',
    subtitle: 'Events That Changed The World.',
    role: 'proof_history',
    gameplay_hint: 'Read receipts, quest steps, and remembered world events as the player leaves Rookguard.',
  },
  {
    object_id: 'dungeon-codex',
    title: 'Dungeon Codex',
    subtitle: 'Places Where History Still Breathes.',
    role: 'future_lane',
    gameplay_hint: 'Points forward to First Archive and vault routes; no Rookguard dungeon access yet.',
  },
  {
    object_id: 'emberwilds-atlas',
    title: 'Emberwilds Atlas',
    subtitle: 'The volcanic frontier, mapped.',
    role: 'future_lane',
    gameplay_hint: 'World-map frontier context for later travel lanes; no Rookguard transition yet.',
  },
  {
    object_id: 'factions-codex',
    title: 'Factions Codex',
    subtitle: 'Powers That Shape the World.',
    role: 'future_lane',
    gameplay_hint: 'Frames the player as Codex-adjacent, but grants no faction rank or standing yet.',
  },
  {
    object_id: 'heroes-codex',
    title: 'Heroes Codex',
    subtitle: 'The First Legends.',
    role: 'active_profession_lore',
    gameplay_hint: 'The First Archivist anchors the Rookguard profession oath and visible Codex role.',
  },
];

const HEROES_CODEX_ANCHOR: RookguardCodexAnchor = {
  object_id: 'heroes-codex',
  status: 'accepted',
  source: 'AKALYNTH_HEROES_CODEX_V1',
  evidence: '3f9d4f90...11d630 source',
  authority: 'Akalynth',
  related: ROOKGUARD_CODEX_SHELVES.map((shelf) => shelf.object_id),
};

export const ROOKGUARD_CODEX_PROFESSIONS: Record<SovereignVocation, RookguardCodexProfession> = {
  warden: {
    vocation: 'warden',
    lore_id: 'codex_warden',
    codex_anchor: HEROES_CODEX_ANCHOR,
    title: 'Warden of the Accord',
    oath: 'I keep the record alive by keeping its people standing.',
    starter_role: 'Protect travelers, escort proof paths, and hold the gate until every required mark is recorded.',
    starter_actions: ['Escort another player to the Codex arch', 'Hold the training yard line', 'Enter the gate only after all proofs are marked'],
  },
  cantor: {
    vocation: 'cantor',
    lore_id: 'codex_cantor',
    codex_anchor: HEROES_CODEX_ANCHOR,
    title: 'Cantor of the Remembered Word',
    oath: 'I refuse forgetting by speaking what others can witness.',
    starter_role: 'Use chat, Tem answers, and public signals to turn private action into shared memory.',
    starter_actions: ['Send a clear plaza signal', 'Answer Tem cleanly', 'Call out proof events for nearby players'],
  },
  hexer: {
    vocation: 'hexer',
    lore_id: 'codex_hexer',
    codex_anchor: HEROES_CODEX_ANCHOR,
    title: 'Hexer of Unforgotten Marks',
    oath: 'I read the mark before I trust the mask.',
    starter_role: 'Inspect proof trails, identity marks, and pressure patterns before claims become accepted memory.',
    starter_actions: ['Inspect a player identity', 'Read a chronicle entry', 'Check the Codex arch before the gate'],
  },
  reaver: {
    vocation: 'reaver',
    lore_id: 'codex_reaver',
    codex_anchor: HEROES_CODEX_ANCHOR,
    title: 'Reaver of Recorded Consequence',
    oath: 'I cut only what the ledger can remember.',
    starter_role: 'Practice decisive combat where every strike, kill, and minted item leaves a durable trail.',
    starter_actions: ['Defeat a training slime', 'Pick up only minted loot', 'Move through the gate after the Codex mark'],
  },
};

export function rookguardGateBlockedHint(input: RookguardQuestInput): string {
  const missing: string[] = [];
  if (!input.tutorial.move) missing.push("move rune");
  if (!input.tutorial.chat) missing.push("chat signal");
  if (!input.tutorial.tem) missing.push("Tem answer");
  if (!input.trainingComplete) missing.push("training slime");
  if (!input.vocation) missing.push("Codex vocation");
  if (missing.length === 0) return "Gate open — walk onto the golden arch.";
  return `Gate locked — still need: ${missing.join(", ")}.`;
}

export function rookguardGateOpen(input: RookguardQuestInput): boolean {
  return (
    input.tutorial.move &&
    input.tutorial.chat &&
    input.tutorial.tem &&
    input.trainingComplete &&
    input.vocation !== null
  );
}

export function rookguardQuestObjective(input: RookguardQuestInput): string {
  if (!input.tutorial.move) return 'Walk onto the glowing rune to begin';
  if (!input.tutorial.chat) return 'Open Chat and send any message';
  if (!input.tutorial.tem) return `Walk to the Tem rune and answer ${TEM_CHALLENGE_RESPONSE}`;
  if (!input.trainingComplete) return 'Find and tap Attack on the nearby training creature';
  if (!input.vocation) return 'Enter the guild hall and choose a Codex vocation';
  if (!input.tutorial.gate) return 'Walk onto the golden gate when it opens';
  return 'Explore Rookguard';
}

export function buildRookguardQuestProgress(input: RookguardQuestInput): RookguardQuestProgress {
  const steps = [
    {
      step_id: 'move' as const,
      label: 'Move rune',
      complete: input.tutorial.move,
      receipt_actions: ['tutorial_step_complete'],
    },
    {
      step_id: 'chat' as const,
      label: 'Chat signal',
      complete: input.tutorial.chat,
      receipt_actions: ['tutorial_step_complete'],
    },
    {
      step_id: 'tem' as const,
      label: 'Tem response',
      complete: input.tutorial.tem,
      receipt_actions: ['tem_challenge_passed', 'tutorial_step_complete'],
    },
    {
      step_id: 'training' as const,
      label: 'Training slime',
      complete: input.trainingComplete,
      receipt_actions: ['mob_kill', 'item_minted'],
    },
    {
      step_id: 'profession' as const,
      label: 'Codex vocation',
      complete: input.vocation !== null,
      receipt_actions: ['vocation_declared'],
    },
    {
      step_id: 'gate' as const,
      label: 'High City gate',
      complete: input.tutorial.gate,
      receipt_actions: ['gate_unlock', 'tutorial_completed'],
    },
  ];

  const completed = steps.every((step) => step.complete);
  const phase = !input.tutorial.move || !input.tutorial.chat || !input.tutorial.tem
    ? 'tutorial'
    : !input.trainingComplete
      ? 'training'
      : !input.vocation
        ? 'profession'
        : !input.tutorial.gate
          ? 'gate'
          : 'complete';

  return {
    quest_id: 'rookguard_city_codex_path_v1',
    title: 'Rookguard Codex Path',
    phase,
    steps,
    codexShelves: ROOKGUARD_CODEX_SHELVES,
    codexProfession: input.vocation ? ROOKGUARD_CODEX_PROFESSIONS[input.vocation] : null,
    completed,
  };
}

export function buildOnwardRouteProgress(
  input: RookguardQuestInput,
  receiptProgress: OnwardRouteReceiptProgress = {
    forgeholdSurveyed: false,
    forgeholdMilepostEvidenceRecovered: false,
    forgeholdCaravanEvidenceRecovered: false,
    forgeholdAshglassRavineEvidenceRecovered: false,
    forgeholdShipmentInvestigated: false,
    forgeholdEconomyQuoted: false,
    soulsteelStabilized: false,
    forgeholdAbuseNotesReviewed: false,
    heartforgeGatePrepared: false,
    ashglassEvidenceRecovered: false,
    soulsteelRefinementAuthorized: false,
    soulsteelComponentMinted: false,
    forgeholdComponentSettled: false,
    forgeholdComponentPayoutCredited: false,
    moonspireSurveyed: false,
    dreamGateInterpreted: false,
    dreamFragmentAnchored: false,
    dreamGateAbuseNotesReviewed: false,
    dreamGateSealPrepared: false,
    dreamGateTraversalAuthorized: false,
    dreamGateArrivalRecorded: false,
    forgeholdCaravanProtection: {
      activity_id: FORGEHOLD_CARAVAN_ACTIVITY_ID,
      route_id: 'forgehold_route_slice_v1',
      act_id: 'act_02_ember_road_recovery',
      event_sequence: 0,
      last_event_id: null,
      last_actor: null,
      last_event_at_ms: null,
      route_safety: 'unsecured',
      merchant_access: 'closed',
      merchant_stock: 0,
      merchant_travel_due_at_ms: null,
      bandit_pressure: 0,
      player_trust: 0,
    },
  }
): OnwardRouteProgress[] {
  const available = buildRookguardQuestProgress(input).completed;
  const status = available ? 'available' : 'locked';
  const unlockRequirement = 'Complete Rookguard Codex Path: move, chat, Tem, training slime, vocation, and High City gate receipts.';
  const forgeholdCompleted = [
    ...(available ? ['forgehold_client_projection', 'forgehold_android_projection'] : []),
    ...(receiptProgress.forgeholdSurveyed ? ['forgehold_route_survey'] : []),
    ...(receiptProgress.forgeholdMilepostEvidenceRecovered ? ['forgehold_milepost_evidence'] : []),
    ...(receiptProgress.forgeholdCaravanEvidenceRecovered ? ['forgehold_caravan_evidence'] : []),
    ...(receiptProgress.forgeholdAshglassRavineEvidenceRecovered ? ['forgehold_ashglass_ravine_evidence'] : []),
    ...(receiptProgress.forgeholdShipmentInvestigated ? ['forgehold_missing_shipment'] : []),
    ...(receiptProgress.forgeholdEconomyQuoted ? ['forgehold_economy_receipts'] : []),
    ...(receiptProgress.soulsteelStabilized ? ['soulsteel_stabilization'] : []),
    ...(receiptProgress.forgeholdAbuseNotesReviewed ? ['forgehold_abuse_notes'] : []),
    ...(receiptProgress.heartforgeGatePrepared ? ['heartforge_trial_server_gate'] : []),
    ...(receiptProgress.ashglassEvidenceRecovered ? ['ashglass_evidence_recovery'] : []),
    ...(receiptProgress.soulsteelRefinementAuthorized ? ['soulsteel_refinement_authorization'] : []),
    ...(receiptProgress.soulsteelComponentMinted ? ['soulsteel_component_mint'] : []),
    ...(receiptProgress.forgeholdComponentSettled ? ['forgehold_component_settlement'] : []),
    ...(receiptProgress.forgeholdComponentPayoutCredited ? ['forgehold_component_payout'] : []),
  ];
  const moonspireCompleted = [
    ...(available ? ['dream_gate_client_projection', 'dream_gate_android_projection'] : []),
    ...(receiptProgress.moonspireSurveyed ? ['dream_gate_rumor'] : []),
    ...(receiptProgress.dreamGateInterpreted ? ['symbolic_puzzle_projection'] : []),
    ...(receiptProgress.dreamFragmentAnchored ? ['dream_fragment_evidence'] : []),
    ...(receiptProgress.dreamGateAbuseNotesReviewed ? ['dream_gate_abuse_notes'] : []),
    ...(receiptProgress.dreamGateSealPrepared ? ['dream_gate_server_seal'] : []),
    ...(receiptProgress.dreamGateTraversalAuthorized ? ['dream_gate_traversal_authorization'] : []),
    ...(receiptProgress.dreamGateArrivalRecorded ? ['dream_gate_arrival_record'] : []),
  ];

  return [
    {
      route_id: 'forgehold_route_slice_v1',
      title: 'Forgehold Route',
      status,
      unlock_requirement: unlockRequirement,
      next_objective: available
        ? receiptProgress.forgeholdComponentPayoutCredited
          ? 'Forgehold payout is credited by wallet receipt and the component remains server-traceable.'
          : receiptProgress.forgeholdComponentSettled
          ? 'Credit the Forgehold payout through a wallet receipt before the component leaves custody.'
          : receiptProgress.soulsteelComponentMinted
          ? 'Settle the minted Soulsteel component in the Forgehold ledger before any payout exists.'
          : receiptProgress.soulsteelRefinementAuthorized
          ? 'Mint the refined Soulsteel component under server inventory receipts.'
          : receiptProgress.ashglassEvidenceRecovered
          ? 'Authorize Soulsteel refinement from recovered Ashglass evidence.'
          : receiptProgress.heartforgeGatePrepared
          ? 'Recover Ashglass evidence before any Soulsteel refinement can be server-authorized.'
          : receiptProgress.forgeholdAbuseNotesReviewed
            ? 'Prepare the Heartforge Trial server gate without unlocking travel yet.'
          : receiptProgress.soulsteelStabilized
            ? 'Review the Forgehold safety boundary before the Heartforge Trial chamber.'
          : receiptProgress.forgeholdEconomyQuoted
            ? 'Stabilize cracked Soulsteel under the quoted no-mint, no-debit economy guard.'
          : receiptProgress.forgeholdShipmentInvestigated
            ? 'Quote Forgehold economy impact before stabilizing cracked Soulsteel.'
            : receiptProgress.forgeholdAshglassRavineEvidenceRecovered
              ? 'Investigate the missing shipment contradiction using recovered Act II evidence.'
              : receiptProgress.forgeholdCaravanEvidenceRecovered
                ? 'Recover the Ashglass Shard at Ashglass Ravine.'
                : receiptProgress.forgeholdMilepostEvidenceRecovered
                  ? 'Recover the Charred Shipment Plate at the Burned Caravan Site.'
                  : receiptProgress.forgeholdSurveyed
                    ? 'Recover the Broken Route Seal at the Ember Road Milepost.'
                    : 'Survey the Forgehold route board before Act II evidence recovery.'
        : 'Finish the Rookguard Codex Path to reveal the Forgehold shipment board.',
      objectives: [
        { id: 'forgehold_route_survey', label: 'Forgehold route survey', system: 'quest' },
        { id: 'forgehold_milepost_evidence', label: 'Milepost route seal evidence', system: 'quest' },
        { id: 'forgehold_caravan_evidence', label: 'Caravan shipment plate evidence', system: 'quest' },
        { id: 'forgehold_ashglass_ravine_evidence', label: 'Ashglass ravine shard evidence', system: 'quest' },
        { id: 'forgehold_missing_shipment', label: 'Missing shipment investigation', system: 'quest' },
        { id: 'forgehold_economy_receipts', label: 'Receipt-backed Forgehold economy proof', system: 'economy' },
        { id: 'soulsteel_stabilization', label: 'Soulsteel stabilization crafting', system: 'crafting' },
        { id: 'forgehold_abuse_notes', label: 'No client-truth crafting or shipment claims', system: 'anti_cheat' },
        { id: 'heartforge_trial_server_gate', label: 'Heartforge Trial server gate', system: 'server' },
        { id: 'ashglass_evidence_recovery', label: 'Ashglass evidence recovery', system: 'crafting' },
        { id: 'soulsteel_refinement_authorization', label: 'Soulsteel refinement authorization', system: 'crafting' },
        { id: 'soulsteel_component_mint', label: 'Soulsteel component mint', system: 'crafting' },
        { id: 'forgehold_component_settlement', label: 'Forgehold component ledger settlement', system: 'economy' },
        { id: 'forgehold_component_payout', label: 'Forgehold wallet payout receipt', system: 'economy' },
        { id: 'forgehold_client_projection', label: 'Read-only client route projection', system: 'ui' },
        { id: 'forgehold_android_projection', label: 'Android read-only route parity', system: 'android' },
      ],
      completed_objective_ids: forgeholdCompleted,
      source_drop: 'drop/AKALYNTH_FORGEHOLD_ROUTE_SLICE_V1',
      receipt_actions: ['route_surveyed', 'forgehold_milepost_evidence_recovered', 'forgehold_caravan_evidence_recovered', 'forgehold_ashglass_ravine_evidence_recovered', 'forgehold_shipment_investigated', 'forgehold_economy_quoted', 'soulsteel_stabilized', 'route_abuse_notes_reviewed', 'heartforge_gate_prepared', 'ashglass_evidence_recovered', 'soulsteel_refinement_authorized', 'soulsteel_component_minted', 'forgehold_component_settled', 'forgehold_component_payout_credited', 'wallet_credit', 'item_minted', 'item_added_to_inventory'],
    },
    {
      route_id: 'moonspire_dream_gate_slice_v1',
      title: 'Moonspire Dream Gate',
      status,
      unlock_requirement: unlockRequirement,
      next_objective: available
        ? receiptProgress.dreamGateArrivalRecorded
          ? 'Dream Gate threshold arrival is recorded by server receipts; client movement remains intent-only.'
          : receiptProgress.dreamGateTraversalAuthorized
          ? 'Record Dream Gate threshold arrival without client-owned position truth.'
          : receiptProgress.dreamGateSealPrepared
          ? 'Authorize Dream Gate traversal from the sealed fragment without client-owned position truth.'
          : receiptProgress.dreamGateAbuseNotesReviewed
            ? 'Prepare the Dream Gate server seal without granting traversal yet.'
          : receiptProgress.dreamFragmentAnchored
            ? 'Review the Dream Gate safety boundary before any traversal can be server-authorized.'
          : receiptProgress.dreamGateInterpreted
          ? 'Anchor the interpreted symbols before any Dream Gate traversal can be server-authorized.'
          : 'Survey a Dream Gate clue before interpreting symbols or authorizing traversal.'
        : 'Finish the Rookguard Codex Path to reveal the Moonspire dream-gate rumor.',
      objectives: [
        { id: 'dream_gate_rumor', label: 'Dream Gate rumor discovery', system: 'quest' },
        { id: 'symbolic_puzzle_projection', label: 'Symbolic puzzle projection', system: 'dream_gate' },
        { id: 'dream_fragment_evidence', label: 'Dream fragment evidence object', system: 'server' },
        { id: 'dream_gate_abuse_notes', label: 'No client-owned dream traversal truth', system: 'anti_cheat' },
        { id: 'dream_gate_server_seal', label: 'Dream Gate server seal', system: 'server' },
        { id: 'dream_gate_traversal_authorization', label: 'Dream Gate traversal authorization', system: 'dream_gate' },
        { id: 'dream_gate_arrival_record', label: 'Server-recorded Dream Gate threshold arrival', system: 'server' },
        { id: 'dream_gate_client_projection', label: 'Read-only client route projection', system: 'ui' },
        { id: 'dream_gate_android_projection', label: 'Android read-only route parity', system: 'android' },
      ],
      completed_objective_ids: moonspireCompleted,
      source_drop: 'drop/AKALYNTH_MOONSPIRE_DREAM_GATE_SLICE_V1',
      receipt_actions: ['route_surveyed', 'dream_gate_interpreted', 'dream_fragment_anchored', 'route_abuse_notes_reviewed', 'dream_gate_seal_prepared', 'dream_gate_traversal_authorized', 'dream_gate_arrival_recorded'],
    },
  ];
}
