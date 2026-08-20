#!/usr/bin/env tsx
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {
  BETA_RELEASE_MANIFEST_PREIMAGE_SCHEMA_VERSION,
} from './beta-release-manifest-tool-lib.js';
import { parseBetaReleaseManifest } from '../src/beta/releaseManifest.js';

const repoRoot = path.resolve(import.meta.dirname, '../../..');
const tsx = path.join(repoRoot, 'node_modules/.bin/tsx');
const tool = path.join(repoRoot, 'apps/server/tools/beta-release-manifest.ts');
const temporaryRoot = fs.mkdtempSync(
  path.join(os.tmpdir(), 'akalynth-beta-release-manifest-tool-'),
);
const sentinelDb = path.join(temporaryRoot, 'must-not-exist.db');

function write(file: string, content: string | Buffer, mode = 0o644): void {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, content, { mode });
  fs.chmodSync(file, mode);
}

function writeJson(file: string, value: unknown): void {
  write(file, `${JSON.stringify(value, null, 2)}\n`);
}

function run(args: string[]) {
  return spawnSync(tsx, [tool, ...args], {
    cwd: repoRoot,
    encoding: 'utf8',
    env: { ...process.env, AKALYNTH_DB_PATH: sentinelDb },
  });
}

try {
  assert.ok(fs.existsSync(tsx), `tsx executable missing: ${tsx}`);
  const portalRoot = path.join(temporaryRoot, 'portal');
  const playRoot = path.join(portalRoot, 'play');
  const buildInfo = path.join(temporaryRoot, 'BUILD_INFO.json');
  const caddy = path.join(temporaryRoot, 'Caddyfile');
  const releaseCommit = '1'.repeat(40);
  const portalCommit = '2'.repeat(40);
  const playCommit = '3'.repeat(40);
  writeJson(buildInfo, { commit: releaseCommit, built_at: '2026-08-12T00:00:00.000Z' });
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
  for (const [file, content] of Object.entries(portalFiles)) {
    write(path.join(portalRoot, file), content);
  }
  for (const [file, content] of Object.entries(playFiles)) {
    write(path.join(playRoot, file), content);
  }
  write(caddy, 'beta.akalynth.test { root * /tmp/beta }\n');

  const spec = {
    schema_version: BETA_RELEASE_MANIFEST_PREIMAGE_SCHEMA_VERSION,
    release_id: 'frozen-first-playable-proof',
    generated_at: '2026-08-12T00:00:00.000Z',
    platform: 'web',
    backend: { commit: releaseCommit, build_info_file: buildInfo },
    portal: {
      commit: portalCommit,
      root: portalRoot,
      files: Object.keys(portalFiles).reverse(),
    },
    web_client: {
      source_commit: playCommit,
      root: playRoot,
      files: Object.keys(playFiles).reverse(),
    },
    policy: {
      CHILL_ZONE_GATHER_ENABLED: true,
      CHILL_ZONE_REFINE_ENABLED: true,
      AKALYNTH_BETA_ENABLED: true,
      AKALYNTH_BETA_REQUIRE_INVITE: false,
    },
    routing: {
      caddy_config_file: caddy,
      beta_static_root: portalRoot,
      beta_api_upstream: '127.0.0.1:3010',
    },
  };
  const specPath = path.join(temporaryRoot, 'proof-preimage.json');
  const reorderedSpecPath = path.join(temporaryRoot, 'proof-preimage-reordered.json');
  const manifestPath = path.join(temporaryRoot, 'proof-manifest.json');
  const reorderedManifestPath = path.join(temporaryRoot, 'proof-manifest-reordered.json');
  writeJson(specPath, spec);
  writeJson(reorderedSpecPath, {
    routing: spec.routing,
    policy: spec.policy,
    web_client: spec.web_client,
    portal: spec.portal,
    backend: spec.backend,
    platform: spec.platform,
    generated_at: spec.generated_at,
    release_id: spec.release_id,
    schema_version: spec.schema_version,
  });

  const first = run(['materialize', '--spec', specPath, '--output', manifestPath]);
  assert.equal(first.status, 0, first.stderr || first.stdout);
  const second = run([
    'materialize',
    '--output', reorderedManifestPath,
    '--spec', reorderedSpecPath,
  ]);
  assert.equal(second.status, 0, second.stderr || second.stdout);
  assert.equal(
    fs.readFileSync(manifestPath, 'utf8'),
    fs.readFileSync(reorderedManifestPath, 'utf8'),
    'canonical output must ignore spec key and file-list ordering',
  );
  const proof = parseBetaReleaseManifest(fs.readFileSync(manifestPath, 'utf8'));
  assert.equal(JSON.parse(first.stdout).sha256, proof.sha256);
  assert.equal(fs.statSync(manifestPath).mode & 0o777, 0o600);

  const preimageVerified = run([
    'verify-preimage',
    '--spec', specPath,
    '--manifest', manifestPath,
  ]);
  assert.equal(preimageVerified.status, 0, preimageVerified.stderr || preimageVerified.stdout);
  const liveVerified = run([
    'verify-live',
    '--manifest', manifestPath,
    '--backend-build-info', buildInfo,
    '--portal-root', portalRoot,
    '--play-root', playRoot,
    '--caddy-config', caddy,
  ]);
  assert.equal(liveVerified.status, 0, liveVerified.stderr || liveVerified.stdout);

  const pilotSpecPath = path.join(temporaryRoot, 'pilot-preimage.json');
  const pilotManifestPath = path.join(temporaryRoot, 'pilot-manifest.json');
  writeJson(pilotSpecPath, {
    ...spec,
    policy: { ...spec.policy, AKALYNTH_BETA_REQUIRE_INVITE: true },
  });
  const pilot = run([
    'materialize',
    '--spec', pilotSpecPath,
    '--output', pilotManifestPath,
  ]);
  assert.equal(pilot.status, 0, pilot.stderr || pilot.stdout);
  assert.notEqual(
    parseBetaReleaseManifest(fs.readFileSync(pilotManifestPath, 'utf8')).sha256,
    proof.sha256,
    'invite policy must change release identity',
  );

  const overwrite = run(['materialize', '--spec', specPath, '--output', manifestPath]);
  assert.notEqual(overwrite.status, 0);
  assert.match(overwrite.stderr, /release_manifest_output_already_exists/);

  const unknownSpecPath = path.join(temporaryRoot, 'unknown.json');
  writeJson(unknownSpecPath, { ...spec, unexpected: true });
  const unknown = run([
    'materialize',
    '--spec', unknownSpecPath,
    '--output', path.join(temporaryRoot, 'unknown-manifest.json'),
  ]);
  assert.notEqual(unknown.status, 0);
  assert.match(unknown.stderr, /unexpected=\[unexpected\]/);

  const duplicateSpecPath = path.join(temporaryRoot, 'duplicate.json');
  writeJson(duplicateSpecPath, {
    ...spec,
    portal: { ...spec.portal, files: [...spec.portal.files, spec.portal.files[0]] },
  });
  const duplicate = run([
    'materialize',
    '--spec', duplicateSpecPath,
    '--output', path.join(temporaryRoot, 'duplicate-manifest.json'),
  ]);
  assert.notEqual(duplicate.status, 0);
  assert.match(duplicate.stderr, /contains_duplicate_paths/);

  const symlinkTarget = path.join(playRoot, 'assets/index.js');
  const symlinkFile = path.join(playRoot, 'assets/symlink.js');
  fs.symlinkSync(symlinkTarget, symlinkFile);
  const symlinkSpecPath = path.join(temporaryRoot, 'symlink.json');
  writeJson(symlinkSpecPath, {
    ...spec,
    web_client: {
      ...spec.web_client,
      files: ['index.html', 'assets/index.css', 'assets/symlink.js'],
    },
  });
  const symlink = run([
    'materialize',
    '--spec', symlinkSpecPath,
    '--output', path.join(temporaryRoot, 'symlink-manifest.json'),
  ]);
  assert.notEqual(symlink.status, 0);
  assert.match(symlink.stderr, /symlink_rejected/);

  fs.chmodSync(caddy, 0o666);
  const mutable = run([
    'materialize',
    '--spec', specPath,
    '--output', path.join(temporaryRoot, 'mutable-manifest.json'),
  ]);
  assert.notEqual(mutable.status, 0);
  assert.match(mutable.stderr, /must_not_be_group_or_other_writable/);
  fs.chmodSync(caddy, 0o644);

  write(path.join(playRoot, 'assets/index.js'), 'console.log("drifted");\n');
  const drifted = run([
    'verify-live',
    '--manifest', manifestPath,
    '--backend-build-info', buildInfo,
    '--portal-root', portalRoot,
    '--play-root', playRoot,
    '--caddy-config', caddy,
  ]);
  assert.notEqual(drifted.status, 0);
  assert.match(drifted.stderr, /live_play_file:assets\/index\.js_sha256_mismatch/);

  assert.equal(fs.existsSync(sentinelDb), false, 'read-only tool must not create a database');
  console.log(
    '[verify-beta-release-manifest-tool] PASS: canonical proof/pilot identities materialize read-only; unknown, duplicate, symlinked, writable, overwritten, and drifted inputs fail closed',
  );
} finally {
  fs.rmSync(temporaryRoot, { recursive: true, force: true });
}
