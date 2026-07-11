// Verify Rookguard Codex Path quest derivation.
//
// This test keeps quest truth server-owned: the projection is derived from
// tutorial state plus server-marked training/vocation completion, with receipt
// action names recorded for each step.

import type { AuditReceipt, TutorialProgress } from '../../../packages/shared/types.js';
import { VOCATION_DECLARED_ACTION } from '../../../packages/shared/types.js';
import {
  computeEventHash,
  computeInputsHash,
  computeOutputsHash,
  GENESIS_MARKER,
} from '@akalynth/coordination-kernel';
import {
  applyReceiptToRookguardQuest,
  buildOnwardRouteProgress,
  buildRookguardQuestProgress,
  clearRookguardQuestProjection,
  getRookguardQuestInput,
  rookguardGateOpen,
  rookguardGateBlockedHint,
  rookguardQuestObjective,
  type RookguardQuestInput,
} from '../src/world/rookguardQuest.js';

function test(name: string, fn: () => void) {
  try {
    fn();
    console.log(`✓ ${name}`);
  } catch (err) {
    console.error(`✗ ${name}`);
    console.error(`  ${err}`);
    process.exit(1);
  }
}

function assert(condition: unknown, msg: string): asserts condition {
  if (!condition) throw new Error(msg);
}

function assertEquals<T>(actual: T, expected: T, msg: string) {
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    throw new Error(`${msg}: expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
  }
}

let lastEventHash: string | null = null;
let lastSequence = 0;

function buildReceipt(
  receipt: Omit<AuditReceipt, 'sequence' | 'timestamp' | 'prev_hash' | 'event_hash' | 'signature' | 'inputs_hash' | 'outputs_hash'>,
  options: { timestamp?: string; useChain?: boolean } = {}
): AuditReceipt {
  const timestamp = options.timestamp ?? new Date().toISOString();
  const useChain = options.useChain ?? false;
  const prev_hash = useChain ? (lastEventHash ?? GENESIS_MARKER) : GENESIS_MARKER;
  const sequence = useChain ? lastSequence + 1 : 0;
  const inputs_hash = computeInputsHash(receipt.inputs);
  const outputs_hash = computeOutputsHash(receipt.result);
  const body = {
    ...receipt,
    sequence,
    timestamp,
    prev_hash,
    inputs_hash,
    outputs_hash,
  };
  const event_hash = computeEventHash(body);
  const fullReceipt: AuditReceipt = {
    ...body,
    event_hash,
    signature: 'test-signature',
  };

  if (useChain) {
    lastEventHash = event_hash;
    lastSequence = sequence;
  }

  return fullReceipt;
}

function resetProjection() {
  clearRookguardQuestProjection();
  lastEventHash = null;
  lastSequence = 0;
}

function tutorial(partial: Partial<TutorialProgress> = {}): TutorialProgress {
  return {
    move: false,
    chat: false,
    tem: false,
    gate: false,
    complete: false,
    ...partial,
  };
}

function input(partial: Partial<RookguardQuestInput> = {}): RookguardQuestInput {
  return {
    tutorial: tutorial(),
    trainingComplete: false,
    vocation: null,
    ...partial,
  };
}

function replay(receipts: AuditReceipt[]) {
  for (const receipt of receipts) {
    applyReceiptToRookguardQuest(receipt);
  }
}

test('initial quest starts at the move objective', () => {
  const state = input();
  const quest = buildRookguardQuestProgress(state);
  const routes = buildOnwardRouteProgress(state);
  assert(quest.phase === 'tutorial', `expected tutorial phase, got ${quest.phase}`);
  assert(rookguardQuestObjective(state) === 'Step onto the glowing move rune (east plaza, tile 3,2)', 'initial objective mismatch');
  assert(!rookguardGateOpen(state), 'gate must not open before tutorial/training/profession');
  assert(
    rookguardGateBlockedHint(state).includes('move rune'),
    'gate blocked hint should name the first missing proof'
  );
  assert(routes.every((route) => route.status === 'locked'), 'onward routes must start locked');
  assert(
    routes.some((route) => route.route_id === 'forgehold_route_slice_v1' && route.objectives.some((objective) => objective.system === 'crafting')),
    'Forgehold route should expose the crafting objective without unlocking it'
  );
  assert(
    routes.some((route) => route.route_id === 'moonspire_dream_gate_slice_v1' && route.objectives.some((objective) => objective.system === 'dream_gate')),
    'Moonspire route should expose the Dream Gate objective without unlocking it'
  );
});

test('move chat and Tem lead to training, not the gate', () => {
  const state = input({ tutorial: tutorial({ move: true, chat: true, tem: true }) });
  const quest = buildRookguardQuestProgress(state);
  assert(quest.phase === 'training', `expected training phase, got ${quest.phase}`);
  assert(rookguardQuestObjective(state) === 'Walk southeast to the training slime (tile 14,14) and tap Attack', 'training objective mismatch');
  assert(!rookguardGateOpen(state), 'gate must wait for training and vocation');
});

test('training slime completion points to Codex vocation choice', () => {
  const state = input({
    tutorial: tutorial({ move: true, chat: true, tem: true }),
    trainingComplete: true,
  });
  const quest = buildRookguardQuestProgress(state);
  assert(quest.phase === 'profession', `expected profession phase, got ${quest.phase}`);
  assert(
    rookguardQuestObjective(state) === 'Enter the guild hall and choose a Codex vocation',
    'profession objective mismatch'
  );
  assert(!rookguardGateOpen(state), 'gate must wait for vocation');
});

test('vocation declaration opens the gate but quest is not complete until handoff', () => {
  const state = input({
    tutorial: tutorial({ move: true, chat: true, tem: true }),
    trainingComplete: true,
    vocation: 'warden',
  });
  const quest = buildRookguardQuestProgress(state);
  assert(quest.phase === 'gate', `expected gate phase, got ${quest.phase}`);
  assert(rookguardGateOpen(state), 'gate should open after tutorial, training, and vocation');
  assert(
    rookguardGateBlockedHint(state).includes('Gate open'),
    'gate blocked hint should report open when requirements are met'
  );
  assert(!quest.completed, 'quest should wait for the gate step before completion');
});

test('gate step completes the Rookguard Codex path', () => {
  const state = input({
    tutorial: tutorial({ move: true, chat: true, tem: true, gate: true, complete: true }),
    trainingComplete: true,
    vocation: 'hexer',
  });
  const quest = buildRookguardQuestProgress(state);
  const routes = buildOnwardRouteProgress(state);
  const byStep = Object.fromEntries(quest.steps.map((step) => [step.step_id, step]));

  assert(quest.completed, 'quest should be complete');
  assert(quest.phase === 'complete', `expected complete phase, got ${quest.phase}`);
  assert(quest.codexProfession?.lore_id === 'codex_hexer', 'Codex profession should match selected vocation');
  assert(quest.codexProfession.codex_anchor.object_id === 'heroes-codex', 'profession should anchor to Heroes Codex');
  assert(quest.codexProfession.codex_anchor.status === 'accepted', 'Heroes Codex anchor should be accepted');
  assert(
    quest.codexProfession.starter_actions.includes('Read a chronicle entry'),
    'Hexer profile should expose proof-reading starter gameplay'
  );
  assert(quest.codexShelves.length === 6, `expected six Codex shelves, got ${quest.codexShelves.length}`);
  assert(
    quest.codexShelves.some((shelf) => shelf.object_id === 'heroes-codex' && shelf.role === 'active_profession_lore'),
    'Heroes Codex shelf should be active profession lore'
  );
  assert(
    quest.codexShelves.some((shelf) => shelf.object_id === 'chronicle-of-ages' && shelf.role === 'proof_history'),
    'Chronicle of Ages shelf should be proof history'
  );
  assert(byStep.training.receipt_actions.includes('mob_kill'), 'training step must cite mob_kill proof');
  assert(byStep.profession.receipt_actions.includes('vocation_declared'), 'profession step must cite vocation proof');
  assert(byStep.gate.receipt_actions.includes('tutorial_completed'), 'gate step must cite tutorial completion proof');
  assert(routes.every((route) => route.status === 'available'), 'completed Rookguard path should make onward routes available');
  const forgehold = routes.find((route) => route.route_id === 'forgehold_route_slice_v1');
  const moonspire = routes.find((route) => route.route_id === 'moonspire_dream_gate_slice_v1');
  assert(forgehold?.receipt_actions.includes('route_surveyed'), 'Forgehold route should cite route survey receipts');
  assert(forgehold?.receipt_actions.includes('forgehold_milepost_evidence_recovered'), 'Forgehold route should cite Act II evidence receipts');
  assert(moonspire?.receipt_actions.includes('route_surveyed'), 'Moonspire route should cite route survey receipts');
  assert(
    routes.every((route) => route.unlock_requirement.includes('Rookguard')),
    'onward routes should name Rookguard completion as unlock requirement'
  );
});

test('receipt projection restores partial Rookguard Codex path', () => {
  resetProjection();
  replay([
    buildReceipt({ actor_id: 'p1', action: 'tutorial_step_complete', inputs: { step: 'move' }, result: 'ok' }, { useChain: true }),
    buildReceipt({ actor_id: 'p1', action: 'tutorial_step_complete', inputs: { step: 'chat' }, result: 'ok' }, { useChain: true }),
    buildReceipt({ actor_id: 'p1', action: 'tutorial_step_complete', inputs: { step: 'tem' }, result: 'ok' }, { useChain: true }),
    buildReceipt(
      {
        actor_id: 'p1',
        action: 'mob_kill',
        inputs: { map: 'Rookguard', mob_type: 'training_slime', mob_id: 'rookguard-training-slime' },
        result: 'ok',
      },
      { useChain: true }
    ),
    buildReceipt(
      { actor_id: 'p1', action: VOCATION_DECLARED_ACTION, inputs: { vocation: 'cantor' }, result: 'ok' },
      { useChain: true }
    ),
  ]);

  const restored = getRookguardQuestInput('p1');
  const quest = buildRookguardQuestProgress(restored);

  assertEquals(restored.tutorial, tutorial({ move: true, chat: true, tem: true }), 'restored tutorial mismatch');
  assert(restored.trainingComplete, 'training slime completion should restore from mob_kill');
  assert(restored.vocation === 'cantor', `expected restored vocation cantor, got ${restored.vocation}`);
  assert(quest.phase === 'gate', `expected gate phase after restored vocation, got ${quest.phase}`);
  assert(rookguardGateOpen(restored), 'restored partial path should open the gate');
  assert(!quest.completed, 'partial restored path should wait for gate completion');
});

test('receipt projection restores completed Rookguard Codex path', () => {
  resetProjection();
  replay([
    buildReceipt({ actor_id: 'p2', action: 'tutorial_step_complete', inputs: { step: 'move' }, result: 'ok' }, { useChain: true }),
    buildReceipt({ actor_id: 'p2', action: 'tutorial_step_complete', inputs: { step: 'chat' }, result: 'ok' }, { useChain: true }),
    buildReceipt({ actor_id: 'p2', action: 'tutorial_step_complete', inputs: { step: 'tem' }, result: 'ok' }, { useChain: true }),
    buildReceipt(
      { actor_id: 'p2', action: 'mob_kill', inputs: { map: 'Rookguard', mob_type: 'training_slime' }, result: 'ok' },
      { useChain: true }
    ),
    buildReceipt(
      { actor_id: 'p2', action: VOCATION_DECLARED_ACTION, inputs: { vocation: 'reaver' }, result: 'ok' },
      { useChain: true }
    ),
    buildReceipt({ actor_id: 'p2', action: 'gate_unlock', inputs: {}, result: 'ok' }, { useChain: true }),
    buildReceipt({ actor_id: 'p2', action: 'tutorial_completed', inputs: {}, result: 'ok' }, { useChain: true }),
  ]);

  const restored = getRookguardQuestInput('p2');
  const quest = buildRookguardQuestProgress(restored);

  assertEquals(
    restored.tutorial,
    tutorial({ move: true, chat: true, tem: true, gate: true, complete: true }),
    'completed tutorial mismatch'
  );
  assert(restored.trainingComplete, 'completed replay should keep training complete');
  assert(restored.vocation === 'reaver', `expected restored vocation reaver, got ${restored.vocation}`);
  assert(quest.completed, 'completed replay should produce completed quest');
  assert(quest.phase === 'complete', `expected complete phase after replay, got ${quest.phase}`);
});

test('receipt projection ignores unrelated or rejected receipts', () => {
  resetProjection();
  replay([
    buildReceipt({ actor_id: 'p3', action: 'tutorial_step_complete', inputs: { step: 'dance' }, result: 'ok' }, { useChain: true }),
    buildReceipt({ actor_id: 'p3', action: 'mob_kill', inputs: { map: 'Azura', mob_type: 'training_slime' }, result: 'ok' }, { useChain: true }),
    buildReceipt({ actor_id: 'p3', action: 'mob_kill', inputs: { map: 'Rookguard', mob_type: 'city_rat' }, result: 'ok' }, { useChain: true }),
    buildReceipt(
      { actor_id: 'p3', action: VOCATION_DECLARED_ACTION, inputs: { vocation: 'warden' }, result: 'rejected' },
      { useChain: true }
    ),
  ]);

  const restored = getRookguardQuestInput('p3');
  assertEquals(restored, input(), 'unrelated/rejected receipts should leave default quest state');
});

console.log('\n✓ all Rookguard quest checks passed');
