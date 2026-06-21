// Verify Rookguard First30 presentation transcript.
//
// Proof target: rookguard_first30_presentation_v1
// Links sim snapshot gameplan + newcomer timeline to the source contract in
// docs/ROOKGUARD_FIRST_30_MINUTES_V1.md without claiming beta polish or launch.

import type { SimLifeRookguardGameplanStep, SimLifeSnapshotResponse } from '../../../packages/shared/http.js';
import type { MapData } from '../../../packages/shared/types.js';
import { buildSimLifeSnapshot } from '../src/simulation/simLifeSnapshot.js';

const PACKET_AUTHORITY = 'AKALYNTH_ROOKGUARD_FIRST30_PRESENTATION_V1';
const PROOF_TARGET = 'rookguard_first30_presentation_v1';
const NEWCOMER_AGENT_ID = 'sim:rookguard:newcomer:1';

interface PresentationWindow {
  window_id: string;
  from_minute: number;
  to_minute: number;
  lane: 'live' | 'sim_debug' | 'sim_optional';
  player_beat: string;
  receipt_actions: string[];
  sim_frame_labels: string[];
  live_proof_ref?: string;
}

interface PresentationTranscript {
  schema_version: 'rookguard-presentation-transcript/v1';
  packet_authority: typeof PACKET_AUTHORITY;
  proof_target: typeof PROOF_TARGET;
  source_contract: 'docs/ROOKGUARD_FIRST_30_MINUTES_V1.md';
  windows: PresentationWindow[];
  sim_snapshot: {
    mode: 'sim_life_viewer_v1';
    rookguard_newcomer_agent_id: typeof NEWCOMER_AGENT_ID;
    gameplan_step_count: 6;
    newcomer_timeline_frame_count: number;
  };
  authority_boundary: {
    sim_receipts: 'simulated_receipts_only';
    live_ws_proof: 'rookguard_codex_path_ws_e2e_verified';
  };
}

const CONTRACT_WINDOWS: Array<{
  from_minute: number;
  to_minute: number;
  lane: PresentationWindow['lane'];
  receipt_actions: string[];
  live_proof_ref?: string;
}> = [
  {
    from_minute: 0,
    to_minute: 5,
    lane: 'live',
    receipt_actions: ['presence_entered', 'tutorial_step_complete'],
    live_proof_ref: 'verify-rookguard-codex-path:movement',
  },
  {
    from_minute: 5,
    to_minute: 10,
    lane: 'live',
    receipt_actions: ['chat', 'tutorial_step_complete'],
    live_proof_ref: 'verify-rookguard-codex-path:chat',
  },
  {
    from_minute: 10,
    to_minute: 15,
    lane: 'live',
    receipt_actions: ['tem_challenge_issued', 'tem_challenge_passed', 'tutorial_step_complete'],
    live_proof_ref: 'verify-rookguard-codex-path:tem',
  },
  {
    from_minute: 15,
    to_minute: 20,
    lane: 'sim_debug',
    receipt_actions: ['runestone_cast', 'presence_lingered'],
  },
  {
    from_minute: 20,
    to_minute: 25,
    lane: 'sim_optional',
    receipt_actions: ['legend_sighted'],
  },
  {
    from_minute: 25,
    to_minute: 30,
    lane: 'live',
    receipt_actions: ['mob_kill', 'item_minted', 'vocation_declared', 'gate_unlock', 'tutorial_completed'],
    live_proof_ref: 'verify-rookguard-codex-path:training_vocation_gate',
  },
];

function assert(condition: unknown, msg: string): asserts condition {
  if (!condition) throw new Error(msg);
}

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

function mockMap(): MapData {
  return {
    width: 20,
    height: 20,
    spawn: { x: 6, y: 6 },
    tiles: [],
    landmarks: [],
  };
}

function buildSnapshot(): SimLifeSnapshotResponse {
  return buildSimLifeSnapshot([
    { name: 'Rookguard', map: mockMap() },
    { name: 'Azura', map: mockMap() },
  ]);
}

function newcomerFrames(snapshot: SimLifeSnapshotResponse) {
  return snapshot.timeline.filter((frame) => frame.agent_id === NEWCOMER_AGENT_ID);
}

function framesInWindow(
  snapshot: SimLifeSnapshotResponse,
  fromMinute: number,
  toMinute: number
) {
  const fromMs = fromMinute * 60_000;
  const toMs = toMinute * 60_000;
  return newcomerFrames(snapshot).filter(
    (frame) => frame.elapsed_ms >= fromMs && frame.elapsed_ms < toMs
  );
}

function receiptActionsForStep(step: SimLifeRookguardGameplanStep): string[] {
  return [...step.receipt_actions];
}

function buildPresentationTranscript(snapshot: SimLifeSnapshotResponse): PresentationTranscript {
  const gameplan = snapshot.rookguard_0_30_gameplan;
  const newcomerTimeline = newcomerFrames(snapshot);

  const windows: PresentationWindow[] = CONTRACT_WINDOWS.map((contract, index) => {
    const step = gameplan[index];
    assert(step, `missing gameplan step for window ${contract.from_minute}-${contract.to_minute}`);
    const windowFrames = framesInWindow(snapshot, contract.from_minute, contract.to_minute);
    return {
      window_id: `rookguard_minute_${contract.from_minute}_${contract.to_minute}`,
      from_minute: contract.from_minute,
      to_minute: contract.to_minute,
      lane: contract.lane,
      player_beat: step.player_goal,
      receipt_actions: contract.receipt_actions,
      sim_frame_labels: windowFrames.map((frame) => frame.label),
      ...(contract.live_proof_ref ? { live_proof_ref: contract.live_proof_ref } : {}),
    };
  });

  return {
    schema_version: 'rookguard-presentation-transcript/v1',
    packet_authority: PACKET_AUTHORITY,
    proof_target: PROOF_TARGET,
    source_contract: 'docs/ROOKGUARD_FIRST_30_MINUTES_V1.md',
    windows,
    sim_snapshot: {
      mode: 'sim_life_viewer_v1',
      rookguard_newcomer_agent_id: NEWCOMER_AGENT_ID,
      gameplan_step_count: 6,
      newcomer_timeline_frame_count: newcomerTimeline.length,
    },
    authority_boundary: {
      sim_receipts: 'simulated_receipts_only',
      live_ws_proof: 'rookguard_codex_path_ws_e2e_verified',
    },
  };
}

test('sim snapshot exposes six-window rookguard_0_30_gameplan', () => {
  const snapshot = buildSnapshot();
  assert(snapshot.mode === 'sim_life_viewer_v1', 'snapshot mode mismatch');
  assert(snapshot.rookguard_0_30_gameplan.length === 6, 'gameplan should have six windows');
  assert(snapshot.authority.receipt_boundary === 'simulated_receipts_only', 'sim receipt boundary mismatch');

  const minutes = snapshot.rookguard_0_30_gameplan.map((step) => [step.from_minute, step.to_minute]);
  assert(
    JSON.stringify(minutes) === JSON.stringify([
      [0, 5],
      [5, 10],
      [10, 15],
      [15, 20],
      [20, 25],
      [25, 30],
    ]),
    'gameplan minute windows mismatch'
  );
});

test('gameplan receipt actions match ROOKGUARD_FIRST_30_MINUTES_V1 contract', () => {
  const snapshot = buildSnapshot();
  for (let i = 0; i < CONTRACT_WINDOWS.length; i += 1) {
    const contract = CONTRACT_WINDOWS[i];
    const step = snapshot.rookguard_0_30_gameplan[i];
    const stepActions = receiptActionsForStep(step);
    for (const action of contract.receipt_actions) {
      assert(stepActions.includes(action), `window ${contract.from_minute}-${contract.to_minute} missing ${action}`);
    }
    assert(step.server_state_touched.length > 0, `window ${contract.from_minute}-${contract.to_minute} should name server state`);
    assert(step.playtest_check.length > 0, `window ${contract.from_minute}-${contract.to_minute} should name playtest check`);
  }
});

test('rookguard newcomer timeline covers contract receipt actions', () => {
  const snapshot = buildSnapshot();
  const newcomerActions = new Set(newcomerFrames(snapshot).map((frame) => frame.receipt.action));

  const requiredLiveActions = [
    'tutorial_step_complete',
    'chat',
    'tem_challenge_issued',
    'tem_challenge_passed',
    'runestone_cast',
    'legend_sighted',
    'mob_kill',
    'item_minted',
    'vocation_declared',
    'gate_unlock',
    'tutorial_completed',
  ];

  for (const action of requiredLiveActions) {
    assert(newcomerActions.has(action), `newcomer timeline missing receipt action ${action}`);
  }

  assert(newcomerFrames(snapshot).length >= 10, 'newcomer should have at least ten timeline frames');
});

test('receipt_actions_covered includes all gameplan actions', () => {
  const snapshot = buildSnapshot();
  const covered = new Set(snapshot.receipt_actions_covered);
  for (const step of snapshot.rookguard_0_30_gameplan) {
    for (const action of step.receipt_actions) {
      assert(covered.has(action), `receipt_actions_covered missing ${action}`);
    }
  }
});

test('presentation transcript builds with lane split and live proof refs', () => {
  const snapshot = buildSnapshot();
  const transcript = buildPresentationTranscript(snapshot);

  assert(transcript.schema_version === 'rookguard-presentation-transcript/v1', 'schema version mismatch');
  assert(transcript.proof_target === PROOF_TARGET, 'proof target mismatch');
  assert(transcript.windows.length === 6, 'transcript should have six windows');

  const liveWindows = transcript.windows.filter((window) => window.lane === 'live');
  assert(liveWindows.length === 4, 'four windows should be live lane');
  assert(transcript.windows.some((window) => window.lane === 'sim_debug'), 'runestone window should be sim_debug');
  assert(transcript.windows.some((window) => window.lane === 'sim_optional'), 'legend window should be sim_optional');

  for (const window of liveWindows) {
    assert(window.live_proof_ref?.startsWith('verify-rookguard-codex-path:'), `${window.window_id} should name live proof ref`);
  }

  const runestoneWindow = transcript.windows.find((window) => window.window_id === 'rookguard_minute_15_20');
  assert(runestoneWindow?.sim_frame_labels.some((label) => label.includes('Runestone')), 'runestone window should name runestone frame');

  const gateWindow = transcript.windows.find((window) => window.window_id === 'rookguard_minute_25_30');
  assert(gateWindow?.sim_frame_labels.some((label) => label.includes('gate') || label.includes('Gate') || label.includes('tutorial')), 'final window should name gate/tutorial frames');

  assert(transcript.sim_snapshot.newcomer_timeline_frame_count >= 10, 'transcript newcomer frame count too low');
});

test('sim timeline spans full thirty-minute playback window', () => {
  const snapshot = buildSnapshot();
  assert(snapshot.duration_ms === 30 * 60 * 1000, 'snapshot duration should be thirty minutes');
  const maxElapsed = Math.max(...snapshot.timeline.map((frame) => frame.elapsed_ms));
  assert(maxElapsed >= 1_800_000, 'timeline should reach minute thirty');
  const closingFrame = snapshot.timeline.find((frame) => frame.label.includes('30-minute'));
  assert(closingFrame, 'timeline should include thirty-minute close frame');
});

console.log(`\n✓ ${PROOF_TARGET} checks passed`);