// Verify live beta/staging Rookguard presentation screenshot proof contract.
//
// Proof target: live_lane_presentation_screenshot_v1
// Parent proof: rookguard_first30_presentation_v1
//
// Validates the screenshot register schema contract and bundled canonical sample.
// Live capture runs from akalynth-ops (operator-authorized, not CI-deployed).

import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const PACKET_AUTHORITY = 'AKALYNTH_LIVE_BETA_STAGING_SCREENSHOT_PROOF_V1';
const PROOF_TARGET = 'live_lane_presentation_screenshot_v1';
const PARENT_PROOF_TARGET = 'rookguard_first30_presentation_v1';
const SCHEMA_VERSION = 'live-lane-screenshot-register/v1';
const REQUIRED_VIEWPORTS = ['desktop_1440x900', 'mobile_landscape_932x430'] as const;
const REQUIRED_LANES = ['beta', 'staging'] as const;

const TOOL_DIR = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(TOOL_DIR, '../../..');
const SAMPLE_PATH = path.join(
  REPO_ROOT,
  'docs/engineering-loop/AKALYNTH_ENGINEERING_LOOP_LIVE_LANE_PRESENTATION_SCREENSHOT_PROOF_V1/live_lane_screenshot_register.sample.json',
);

interface ScreenshotEntry {
  file: string;
  lane: string;
  viewport: string;
  bytes: number;
  sha256_prefix: string;
  map_hint?: string;
}

interface LaneEntry {
  lane: string;
  webBase: string;
  apiBase: string;
  wsUrl: string;
  probe: {
    play: { status: number; ok: boolean };
    account: { status: number; ok: boolean };
    worlds: { status: number; ok: boolean };
  };
  playable: boolean;
  screenshots: ScreenshotEntry[];
  smoke: { character_name: string; mode: string } | null;
  status: 'passed' | 'blocked' | 'failed';
  blocked_reason?: string;
  error?: string;
}

interface ScreenshotRegister {
  schema_version: string;
  packet_authority: string;
  proof_target: string;
  captured_utc: string;
  ops_host: string;
  lanes: LaneEntry[];
}

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

function readSample(): ScreenshotRegister {
  const raw = readFileSync(SAMPLE_PATH, 'utf8');
  return JSON.parse(raw) as ScreenshotRegister;
}

function laneConfig(lane: string) {
  if (lane === 'beta') {
    return {
      webBase: 'https://beta.akalynth.com',
      apiBase: 'https://beta-api.akalynth.com',
      wsUrl: 'wss://beta-api.akalynth.com',
    };
  }
  return {
    webBase: 'https://staging.akalynth.com',
    apiBase: 'https://staging-api.akalynth.com',
    wsUrl: 'wss://staging-api.akalynth.com',
  };
}

test('packet authority and proof target constants', () => {
  assert(PACKET_AUTHORITY === 'AKALYNTH_LIVE_BETA_STAGING_SCREENSHOT_PROOF_V1', 'packet authority drift');
  assert(PROOF_TARGET === 'live_lane_presentation_screenshot_v1', 'proof target drift');
  assert(PARENT_PROOF_TARGET === 'rookguard_first30_presentation_v1', 'parent proof drift');
});

test('bundled screenshot register sample loads', () => {
  const sample = readSample();
  assert(sample.schema_version === SCHEMA_VERSION, 'schema_version mismatch');
  assert(sample.packet_authority === PACKET_AUTHORITY, 'packet_authority mismatch');
  assert(sample.proof_target === PROOF_TARGET, 'proof_target mismatch');
  assert(typeof sample.captured_utc === 'string' && sample.captured_utc.length > 10, 'captured_utc missing');
  assert(typeof sample.ops_host === 'string' && sample.ops_host.length > 0, 'ops_host missing');
});

test('sample includes beta and staging lanes with required viewports', () => {
  const sample = readSample();
  const lanes = new Map(sample.lanes.map((entry) => [entry.lane, entry]));
  for (const laneId of REQUIRED_LANES) {
    const entry = lanes.get(laneId);
    assert(entry, `missing lane ${laneId}`);
    const expected = laneConfig(laneId);
    assert(entry.webBase === expected.webBase, `${laneId} webBase drift`);
    assert(entry.apiBase === expected.apiBase, `${laneId} apiBase drift`);
    assert(entry.wsUrl === expected.wsUrl, `${laneId} wsUrl drift`);
    assert(entry.playable === true, `${laneId} must be playable in canonical sample`);
    assert(entry.status === 'passed', `${laneId} canonical sample must be passed`);
    assert(entry.probe.play.status === 200 && entry.probe.play.ok, `${laneId} /play/ probe must be 200`);
    assert(entry.probe.worlds.status === 200 && entry.probe.worlds.ok, `${laneId} worlds probe must be 200`);
    assert(entry.smoke?.mode === 'disposable-account', `${laneId} smoke mode must be disposable-account`);
    const viewports = new Set(entry.screenshots.map((shot) => shot.viewport));
    for (const viewport of REQUIRED_VIEWPORTS) {
      assert(viewports.has(viewport), `${laneId} missing viewport ${viewport}`);
    }
    for (const shot of entry.screenshots) {
      assert(shot.lane === laneId, `${laneId} screenshot lane mismatch`);
      assert(shot.bytes > 0, `${laneId} screenshot bytes must be positive`);
      assert(/^[a-f0-9]{16}$/.test(shot.sha256_prefix), `${laneId} sha256_prefix format`);
      assert(shot.file.includes('rookguard'), `${laneId} screenshot filename must reference rookguard`);
    }
  }
});

test('runbook and shell verifier exist', () => {
  const runbook = path.join(REPO_ROOT, 'docs/LIVE_LANE_PRESENTATION_SCREENSHOT_RUNBOOK.md');
  const shell = path.join(REPO_ROOT, 'scripts/verify-live-lane-presentation-screenshot.sh');
  const packet = path.join(
    REPO_ROOT,
    'docs/codex-work-packets/live-lane-presentation-screenshot-proof-v1/LiveLanePresentationScreenshotProof.v1.md',
  );
  assert(readFileSync(runbook, 'utf8').includes(PROOF_TARGET), 'runbook missing proof target');
  assert(readFileSync(runbook, 'utf8').includes(PARENT_PROOF_TARGET), 'runbook missing parent proof');
  assert(readFileSync(shell, 'utf8').includes('verify:live-lane-presentation-screenshot'), 'shell verifier drift');
  assert(readFileSync(packet, 'utf8').includes(PACKET_AUTHORITY), 'codex work packet drift');
});

console.log(`\n${PROOF_TARGET} contract checks passed (${PACKET_AUTHORITY}).`);