#!/usr/bin/env tsx
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import Database from 'better-sqlite3';
import {
  BETA_RELEASE_MANIFEST_SCHEMA_VERSION,
  parseBetaReleaseManifest,
} from '../src/beta/releaseManifest.js';

const repoRoot = path.resolve(import.meta.dirname, '../../..');
const cli = path.join(repoRoot, 'node_modules/.bin/tsx');
const tool = path.join(repoRoot, 'apps/server/tools/beta-cohort.ts');
const reportTool = path.join(
  repoRoot,
  'apps/server/tools/beta-player-readiness-report.ts',
);
const releaseCommit = '1'.repeat(40);
const rollbackCommit = '2'.repeat(40);
const releaseBuildInfo = `${JSON.stringify({
  commit: releaseCommit,
  built_at: '2026-08-12T00:00:00.000Z',
})}\n`;
const portalFiles: Record<string, string> = {
  'index.html': '<html>index</html>\n',
  'account.html': '<html>account</html>\n',
  'register.html': '<html>register</html>\n',
  'forgot.html': '<html>forgot</html>\n',
  'beta.html': '<html>beta</html>\n',
  'js/app.js': 'console.log("portal");\n',
  'css/style.css': ':root { color: white; }\n',
};
const playFiles: Record<string, string> = {
  'index.html': '<html>play</html>\n',
  'assets/index.js': 'console.log("play");\n',
  'assets/index.css': '#root { display: block; }\n',
};
const caddyConfig = 'beta.akalynth.test { root * /tmp/beta }\n';

function sha256(value: string): string {
  return createHash('sha256').update(value, 'utf8').digest('hex');
}

function manifest(commit: string, releaseId: string, portalRoot: string) {
  return {
    schema_version: BETA_RELEASE_MANIFEST_SCHEMA_VERSION,
    release_id: releaseId,
    generated_at: '2026-08-12T00:00:00.000Z',
    platform: 'web',
    backend: {
      commit,
      build_info_sha256: commit === releaseCommit
        ? sha256(releaseBuildInfo)
        : sha256('rollback-build-info-fixture'),
    },
    portal: {
      commit: '4'.repeat(40),
      files_sha256: Object.fromEntries(
        Object.entries(portalFiles).map(([file, content]) => [file, sha256(content)]),
      ),
    },
    web_client: {
      source_commit: '6'.repeat(40),
      files_sha256: Object.fromEntries(
        Object.entries(playFiles).map(([file, content]) => [file, sha256(content)]),
      ),
    },
    policy: {
      CHILL_ZONE_GATHER_ENABLED: true,
      CHILL_ZONE_REFINE_ENABLED: true,
      AKALYNTH_BETA_ENABLED: true,
      AKALYNTH_BETA_REQUIRE_INVITE: true,
    },
    routing: {
      caddy_config_sha256: sha256(caddyConfig),
      beta_static_root: portalRoot,
      beta_api_upstream: '127.0.0.1:3010',
    },
  };
}

function writeJson(file: string, value: unknown): void {
  fs.writeFileSync(file, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
}

const temporaryRoot = fs.mkdtempSync(
  path.join(os.tmpdir(), 'akalynth-beta-cohort-cli-'),
);

try {
  assert.ok(fs.existsSync(cli), `tsx executable missing: ${cli}`);
  const dbPath = path.join(temporaryRoot, 'akalynth.db');
  const receiptsPath = path.join(temporaryRoot, 'receipts.jsonl');
  const keyPath = path.join(temporaryRoot, 'chronicle.key');
  const releasePath = path.join(temporaryRoot, 'release.json');
  const rollbackPath = path.join(temporaryRoot, 'rollback.json');
  const activePath = path.join(temporaryRoot, 'active.json');
  const driftedPath = path.join(temporaryRoot, 'active-drifted.json');
  const portalRoot = path.join(temporaryRoot, 'portal');
  const playRoot = path.join(portalRoot, 'play');
  const buildInfoPath = path.join(temporaryRoot, 'BUILD_INFO.json');
  const caddyPath = path.join(temporaryRoot, 'Caddyfile');
  for (const [file, content] of Object.entries(portalFiles)) {
    const target = path.join(portalRoot, file);
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.writeFileSync(target, content, 'utf8');
  }
  for (const [file, content] of Object.entries(playFiles)) {
    const target = path.join(playRoot, file);
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.writeFileSync(target, content, 'utf8');
  }
  fs.writeFileSync(buildInfoPath, releaseBuildInfo, 'utf8');
  fs.writeFileSync(caddyPath, caddyConfig, 'utf8');
  fs.writeFileSync(keyPath, Buffer.alloc(32, 7));
  fs.chmodSync(keyPath, 0o600);

  const release = manifest(releaseCommit, 'release-fixture', portalRoot);
  const rollback = manifest(rollbackCommit, 'rollback-fixture', portalRoot);
  writeJson(releasePath, release);
  writeJson(rollbackPath, rollback);
  writeJson(activePath, {
    routing: release.routing,
    policy: release.policy,
    web_client: release.web_client,
    portal: release.portal,
    backend: release.backend,
    platform: release.platform,
    generated_at: release.generated_at,
    release_id: release.release_id,
    schema_version: release.schema_version,
  });
  writeJson(
    driftedPath,
    manifest(releaseCommit, 'drifted-live-state', portalRoot),
  );

  const baseArgs = [
    tool,
    'create',
    '--release', releaseCommit,
    '--rollback', rollbackCommit,
    '--platform', 'web',
    '--cap', '3',
    '--release-manifest', releasePath,
    '--rollback-manifest', rollbackPath,
    '--backend-build-info', buildInfoPath,
    '--portal-root', portalRoot,
    '--play-root', playRoot,
    '--caddy-config', caddyPath,
  ];
  const env = {
    ...process.env,
    AKALYNTH_DB_PATH: dbPath,
    AKALYNTH_RECEIPT_CHAIN_PATH: receiptsPath,
    CHRONICLE_KEY_PATH: keyPath,
    NODE_ENV: 'test',
  };

  const created = spawnSync(
    cli,
    [...baseArgs, '--cohort', 'cli-bound', '--active-manifest', activePath],
    { cwd: repoRoot, env, encoding: 'utf8' },
  );
  assert.equal(created.status, 0, created.stderr || created.stdout);
  const output = JSON.parse(created.stdout) as Record<string, unknown>;
  const expectedReleaseDigest = parseBetaReleaseManifest(
    fs.readFileSync(releasePath, 'utf8'),
  ).sha256;
  const expectedRollbackDigest = parseBetaReleaseManifest(
    fs.readFileSync(rollbackPath, 'utf8'),
  ).sha256;
  assert.equal(output.release_manifest_sha256, expectedReleaseDigest);
  assert.equal(output.rollback_manifest_sha256, expectedRollbackDigest);

  fs.writeFileSync(
    path.join(playRoot, 'assets/index.js'),
    'console.log("drifted");\n',
    'utf8',
  );
  const liveDrift = spawnSync(
    cli,
    [...baseArgs, '--cohort', 'cli-live-drift', '--active-manifest', activePath],
    { cwd: repoRoot, env, encoding: 'utf8' },
  );
  assert.notEqual(liveDrift.status, 0);
  assert.match(liveDrift.stderr, /live_play_file:assets\/index\.js_sha256_mismatch/);
  fs.writeFileSync(
    path.join(playRoot, 'assets/index.js'),
    playFiles['assets/index.js'] ?? '',
    'utf8',
  );

  const db = new Database(dbPath, { readonly: true });
  try {
    assert.deepEqual(
      db.prepare(`
        SELECT release_commit, release_manifest_sha256, rollback_commit,
               rollback_manifest_sha256, platform, invite_cap, status
        FROM beta_cohorts
        WHERE cohort_id = 'cli-bound'
      `).get(),
      {
        release_commit: releaseCommit,
        release_manifest_sha256: expectedReleaseDigest,
        rollback_commit: rollbackCommit,
        rollback_manifest_sha256: expectedRollbackDigest,
        platform: 'web',
        invite_cap: 3,
        status: 'open',
      },
    );
  } finally {
    db.close();
  }

  const reported = spawnSync(
    cli,
    [reportTool, '--cohort', 'cli-bound'],
    { cwd: repoRoot, env, encoding: 'utf8' },
  );
  assert.equal(reported.status, 0, reported.stderr || reported.stdout);
  const report = JSON.parse(reported.stdout) as {
    cohorts?: Array<{
      cohort?: {
        release_manifest_sha256?: string;
        rollback_manifest_sha256?: string;
      };
    }>;
  };
  assert.equal(
    report.cohorts?.[0]?.cohort?.release_manifest_sha256,
    expectedReleaseDigest,
  );
  assert.equal(
    report.cohorts?.[0]?.cohort?.rollback_manifest_sha256,
    expectedRollbackDigest,
  );

  const driftedIssue = spawnSync(
    cli,
    [
      tool,
      'issue',
      '--cohort', 'cli-bound',
      '--count', '1',
      '--active-manifest', driftedPath,
    ],
    { cwd: repoRoot, env, encoding: 'utf8' },
  );
  assert.notEqual(driftedIssue.status, 0);
  assert.match(driftedIssue.stderr, /active_release_manifest_mismatch/);

  const issued = spawnSync(
    cli,
    [
      tool,
      'issue',
      '--cohort', 'cli-bound',
      '--count', '1',
      '--active-manifest', activePath,
    ],
    { cwd: repoRoot, env, encoding: 'utf8' },
  );
  assert.equal(issued.status, 0, issued.stderr || issued.stdout);
  const issuedBody = JSON.parse(issued.stdout) as { invites?: unknown[] };
  assert.equal(issuedBody.invites?.length, 1);
  const receipt = fs.readFileSync(receiptsPath, 'utf8')
    .trim()
    .split('\n')
    .map((line) => JSON.parse(line) as { inputs?: Record<string, unknown> })
    .at(-1);
  assert.equal(receipt?.inputs?.release_manifest_sha256, expectedReleaseDigest);

  const drifted = spawnSync(
    cli,
    [...baseArgs, '--cohort', 'cli-drifted', '--active-manifest', driftedPath],
    { cwd: repoRoot, env, encoding: 'utf8' },
  );
  assert.notEqual(drifted.status, 0);
  assert.match(drifted.stderr, /active_release_manifest_mismatch/);

  const missingActive = spawnSync(
    cli,
    [...baseArgs, '--cohort', 'cli-missing-active'],
    { cwd: repoRoot, env, encoding: 'utf8' },
  );
  assert.notEqual(missingActive.status, 0);
  assert.match(missingActive.stderr, /--active-manifest is required/);

  const verifyDb = new Database(dbPath, { readonly: true });
  try {
    const failedRows = verifyDb.prepare(`
      SELECT COUNT(*) AS count
      FROM beta_cohorts
      WHERE cohort_id IN (
        'cli-drifted',
        'cli-live-drift',
        'cli-missing-active'
      )
    `).get() as { count: number };
    assert.equal(failedRows.count, 0);
    const inviteRows = verifyDb.prepare(`
      SELECT COUNT(*) AS count
      FROM beta_invites
      WHERE cohort_id = 'cli-bound'
    `).get() as { count: number };
    assert.equal(inviteRows.count, 1);
  } finally {
    verifyDb.close();
  }

  console.log(
    '[verify-beta-cohort-cli] PASS: canonical digests persist, report, and receipt; missing or drifted active manifests fail closed',
  );
} finally {
  fs.rmSync(temporaryRoot, { recursive: true, force: true });
}
