import { createHash } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { canonicalJson } from '../../../../packages/shared/hashPrimitive.js';
import type { BetaPlatform } from '../../../../packages/shared/http.js';

export const BETA_RELEASE_MANIFEST_SCHEMA_VERSION =
  'akalynth.beta_release_manifest.v1' as const;

export interface BetaReleaseManifestV1 {
  schema_version: typeof BETA_RELEASE_MANIFEST_SCHEMA_VERSION;
  release_id: string;
  generated_at: string;
  platform: BetaPlatform;
  backend: {
    commit: string;
    build_info_sha256: string;
  };
  portal: {
    commit: string;
    files_sha256: Record<string, string>;
  };
  web_client: {
    source_commit: string;
    files_sha256: Record<string, string>;
  };
  policy: {
    CHILL_ZONE_GATHER_ENABLED: boolean;
    CHILL_ZONE_REFINE_ENABLED: boolean;
    AKALYNTH_BETA_ENABLED: boolean;
    AKALYNTH_BETA_REQUIRE_INVITE: boolean;
  };
  routing: {
    caddy_config_sha256: string;
    beta_static_root: string;
    beta_api_upstream: string;
  };
  android?: {
    source_commit: string;
    version_code: number;
    version_name: string;
    apk_sha256: string;
    size_bytes: number;
  };
}

export interface BoundBetaReleaseManifest {
  manifest: BetaReleaseManifestV1;
  canonical_json: string;
  sha256: string;
}

export interface BetaReleaseLivePaths {
  backend_build_info: string;
  portal_root: string;
  play_root: string;
  caddy_config: string;
  android_apk?: string;
}

type JsonObject = Record<string, unknown>;

const SHA256_RE = /^[0-9a-f]{64}$/;
const GIT_COMMIT_RE = /^[0-9a-f]{40}$/;
const SAFE_ID_RE = /^[A-Za-z0-9._:-]{1,128}$/;
const SAFE_FILE_RE = /^(?!\/)(?!.*(?:^|\/)\.\.(?:\/|$))[A-Za-z0-9._@+\/-]{1,240}$/;
const REQUIRED_PORTAL_FILES = [
  'index.html',
  'account.html',
  'register.html',
  'forgot.html',
  'beta.html',
  'js/app.js',
  'css/style.css',
] as const;

export function isSha256Hex(value: unknown): value is string {
  return typeof value === 'string' && SHA256_RE.test(value);
}

function objectValue(value: unknown, label: string): JsonObject {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error(`${label}_must_be_an_object`);
  }
  return value as JsonObject;
}

function assertExactKeys(
  value: JsonObject,
  label: string,
  required: readonly string[],
  optional: readonly string[] = [],
): void {
  const allowed = new Set([...required, ...optional]);
  const missing = required.filter((key) => !(key in value));
  const unexpected = Object.keys(value).filter((key) => !allowed.has(key));
  if (missing.length || unexpected.length) {
    throw new Error(
      `${label}_keys_invalid: missing=[${missing.join(',')}] unexpected=[${unexpected.join(',')}]`,
    );
  }
}

function stringValue(
  value: unknown,
  label: string,
  maxLength = 512,
): string {
  if (typeof value !== 'string' || value.length === 0 || value.length > maxLength) {
    throw new Error(`${label}_must_be_a_nonempty_string`);
  }
  return value;
}

function gitCommit(value: unknown, label: string): string {
  if (typeof value !== 'string' || !GIT_COMMIT_RE.test(value)) {
    throw new Error(`${label}_must_be_a_full_lowercase_git_commit`);
  }
  return value;
}

function sha256(value: unknown, label: string): string {
  if (!isSha256Hex(value)) {
    throw new Error(`${label}_must_be_lowercase_sha256`);
  }
  return value;
}

function booleanValue(value: unknown, label: string): boolean {
  if (typeof value !== 'boolean') throw new Error(`${label}_must_be_boolean`);
  return value;
}

function positiveInteger(value: unknown, label: string): number {
  if (typeof value !== 'number' || !Number.isSafeInteger(value) || value <= 0) {
    throw new Error(`${label}_must_be_a_positive_integer`);
  }
  return value;
}

function platformValue(value: unknown, label: string): BetaPlatform {
  if (value !== 'web' && value !== 'android' && value !== 'mixed') {
    throw new Error(`${label}_must_be_web_android_or_mixed`);
  }
  return value;
}

function isoTimestamp(value: unknown, label: string): string {
  const timestamp = stringValue(value, label, 64);
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z$/.test(timestamp)
      || !Number.isFinite(Date.parse(timestamp))) {
    throw new Error(`${label}_must_be_an_utc_iso_timestamp`);
  }
  return timestamp;
}

function fileDigests(value: unknown, label: string): Record<string, string> {
  const files = objectValue(value, label);
  const entries = Object.entries(files);
  if (entries.length === 0 || entries.length > 128) {
    throw new Error(`${label}_must_contain_1_to_128_files`);
  }
  for (const [file, digest] of entries) {
    if (!SAFE_FILE_RE.test(file)) throw new Error(`${label}_path_invalid: ${file}`);
    sha256(digest, `${label}.${file}`);
  }
  return files as Record<string, string>;
}

export function parseBetaReleaseManifest(json: string): BoundBetaReleaseManifest {
  let parsed: unknown;
  try {
    parsed = JSON.parse(json);
  } catch {
    throw new Error('release_manifest_invalid_json');
  }

  const root = objectValue(parsed, 'release_manifest');
  assertExactKeys(
    root,
    'release_manifest',
    [
      'schema_version',
      'release_id',
      'generated_at',
      'platform',
      'backend',
      'portal',
      'web_client',
      'policy',
      'routing',
    ],
    ['android'],
  );
  if (root.schema_version !== BETA_RELEASE_MANIFEST_SCHEMA_VERSION) {
    throw new Error('release_manifest_schema_version_unsupported');
  }
  if (typeof root.release_id !== 'string' || !SAFE_ID_RE.test(root.release_id)) {
    throw new Error('release_manifest.release_id_invalid');
  }
  isoTimestamp(root.generated_at, 'release_manifest.generated_at');
  const platform = platformValue(root.platform, 'release_manifest.platform');

  const backend = objectValue(root.backend, 'release_manifest.backend');
  assertExactKeys(backend, 'release_manifest.backend', ['commit', 'build_info_sha256']);
  gitCommit(backend.commit, 'release_manifest.backend.commit');
  sha256(backend.build_info_sha256, 'release_manifest.backend.build_info_sha256');

  const portal = objectValue(root.portal, 'release_manifest.portal');
  assertExactKeys(portal, 'release_manifest.portal', ['commit', 'files_sha256']);
  gitCommit(portal.commit, 'release_manifest.portal.commit');
  const portalFiles = fileDigests(
    portal.files_sha256,
    'release_manifest.portal.files_sha256',
  );
  for (const file of REQUIRED_PORTAL_FILES) {
    if (!(file in portalFiles)) {
      throw new Error(`release_manifest.portal.files_sha256_missing: ${file}`);
    }
  }

  const webClient = objectValue(root.web_client, 'release_manifest.web_client');
  assertExactKeys(webClient, 'release_manifest.web_client', ['source_commit', 'files_sha256']);
  gitCommit(webClient.source_commit, 'release_manifest.web_client.source_commit');
  const webClientFiles = fileDigests(
    webClient.files_sha256,
    'release_manifest.web_client.files_sha256',
  );
  if (!('index.html' in webClientFiles)) {
    throw new Error('release_manifest.web_client.files_sha256_missing: index.html');
  }
  if (!Object.keys(webClientFiles).some((file) => /^assets\/.+\.js$/.test(file))) {
    throw new Error('release_manifest.web_client.files_sha256_missing: assets/*.js');
  }
  if (!Object.keys(webClientFiles).some((file) => /^assets\/.+\.css$/.test(file))) {
    throw new Error('release_manifest.web_client.files_sha256_missing: assets/*.css');
  }

  const policy = objectValue(root.policy, 'release_manifest.policy');
  assertExactKeys(policy, 'release_manifest.policy', [
    'CHILL_ZONE_GATHER_ENABLED',
    'CHILL_ZONE_REFINE_ENABLED',
    'AKALYNTH_BETA_ENABLED',
    'AKALYNTH_BETA_REQUIRE_INVITE',
  ]);
  booleanValue(policy.CHILL_ZONE_GATHER_ENABLED, 'release_manifest.policy.CHILL_ZONE_GATHER_ENABLED');
  booleanValue(policy.CHILL_ZONE_REFINE_ENABLED, 'release_manifest.policy.CHILL_ZONE_REFINE_ENABLED');
  booleanValue(policy.AKALYNTH_BETA_ENABLED, 'release_manifest.policy.AKALYNTH_BETA_ENABLED');
  booleanValue(policy.AKALYNTH_BETA_REQUIRE_INVITE, 'release_manifest.policy.AKALYNTH_BETA_REQUIRE_INVITE');

  const routing = objectValue(root.routing, 'release_manifest.routing');
  assertExactKeys(routing, 'release_manifest.routing', [
    'caddy_config_sha256',
    'beta_static_root',
    'beta_api_upstream',
  ]);
  sha256(routing.caddy_config_sha256, 'release_manifest.routing.caddy_config_sha256');
  const staticRoot = stringValue(
    routing.beta_static_root,
    'release_manifest.routing.beta_static_root',
  );
  if (!staticRoot.startsWith('/')) {
    throw new Error('release_manifest.routing.beta_static_root_must_be_absolute');
  }
  stringValue(routing.beta_api_upstream, 'release_manifest.routing.beta_api_upstream');

  if (root.android !== undefined) {
    const android = objectValue(root.android, 'release_manifest.android');
    assertExactKeys(android, 'release_manifest.android', [
      'source_commit',
      'version_code',
      'version_name',
      'apk_sha256',
      'size_bytes',
    ]);
    gitCommit(android.source_commit, 'release_manifest.android.source_commit');
    positiveInteger(android.version_code, 'release_manifest.android.version_code');
    stringValue(android.version_name, 'release_manifest.android.version_name', 128);
    sha256(android.apk_sha256, 'release_manifest.android.apk_sha256');
    positiveInteger(android.size_bytes, 'release_manifest.android.size_bytes');
  } else if (platform === 'android' || platform === 'mixed') {
    throw new Error('release_manifest.android_required_for_platform');
  }

  const canonical = canonicalJson(root);
  return {
    manifest: root as unknown as BetaReleaseManifestV1,
    canonical_json: canonical,
    sha256: createHash('sha256').update(canonical, 'utf8').digest('hex'),
  };
}

export function bindCohortReleaseManifests(input: {
  release_json: string;
  rollback_json: string;
  active_release_json: string;
  release_commit: string;
  rollback_commit: string;
  platform: BetaPlatform;
}): {
  release: BoundBetaReleaseManifest;
  rollback: BoundBetaReleaseManifest;
} {
  const release = parseBetaReleaseManifest(input.release_json);
  const rollback = parseBetaReleaseManifest(input.rollback_json);
  const active = parseBetaReleaseManifest(input.active_release_json);

  if (release.sha256 !== active.sha256) {
    throw new Error('active_release_manifest_mismatch');
  }
  if (release.manifest.backend.commit !== input.release_commit) {
    throw new Error('release_manifest_backend_commit_mismatch');
  }
  if (rollback.manifest.backend.commit !== input.rollback_commit) {
    throw new Error('rollback_manifest_backend_commit_mismatch');
  }
  if (release.manifest.platform !== input.platform) {
    throw new Error('release_manifest_platform_mismatch');
  }
  if (rollback.manifest.platform !== input.platform) {
    throw new Error('rollback_manifest_platform_mismatch');
  }

  return { release, rollback };
}

export function assertActiveReleaseManifest(
  activeReleaseJson: string,
  expectedSha256: string,
): BoundBetaReleaseManifest {
  const active = parseBetaReleaseManifest(activeReleaseJson);
  if (!isSha256Hex(expectedSha256) || active.sha256 !== expectedSha256) {
    throw new Error('active_release_manifest_mismatch');
  }
  return active;
}

function sha256File(file: string, label: string): string {
  let bytes: Buffer;
  try {
    bytes = fs.readFileSync(file);
  } catch {
    throw new Error(`${label}_unreadable`);
  }
  return createHash('sha256').update(bytes).digest('hex');
}

function resolveBoundFile(root: string, file: string, label: string): string {
  const resolvedRoot = path.resolve(root);
  const resolvedFile = path.resolve(resolvedRoot, file);
  const relative = path.relative(resolvedRoot, resolvedFile);
  if (relative.startsWith('..') || path.isAbsolute(relative)) {
    throw new Error(`${label}_escapes_root`);
  }
  return resolvedFile;
}

function assertFileDigest(file: string, expected: string, label: string): void {
  if (sha256File(file, label) !== expected) {
    throw new Error(`${label}_sha256_mismatch`);
  }
}

export function verifyBetaReleaseManifestAgainstLiveFiles(
  bound: BoundBetaReleaseManifest,
  live: BetaReleaseLivePaths,
): void {
  const manifest = bound.manifest;
  const portalRoot = path.resolve(live.portal_root);
  if (portalRoot !== path.resolve(manifest.routing.beta_static_root)) {
    throw new Error('live_portal_root_mismatch');
  }

  assertFileDigest(
    path.resolve(live.backend_build_info),
    manifest.backend.build_info_sha256,
    'live_backend_build_info',
  );
  let buildInfo: unknown;
  try {
    buildInfo = JSON.parse(fs.readFileSync(path.resolve(live.backend_build_info), 'utf8'));
  } catch {
    throw new Error('live_backend_build_info_invalid_json');
  }
  if (
    !buildInfo
    || typeof buildInfo !== 'object'
    || (buildInfo as Record<string, unknown>).commit !== manifest.backend.commit
  ) {
    throw new Error('live_backend_commit_mismatch');
  }

  for (const [file, expected] of Object.entries(manifest.portal.files_sha256)) {
    assertFileDigest(
      resolveBoundFile(portalRoot, file, 'live_portal_file'),
      expected,
      `live_portal_file:${file}`,
    );
  }
  const playRoot = path.resolve(live.play_root);
  if (playRoot !== path.resolve(portalRoot, 'play')) {
    throw new Error('live_play_root_mismatch');
  }
  for (const [file, expected] of Object.entries(manifest.web_client.files_sha256)) {
    assertFileDigest(
      resolveBoundFile(playRoot, file, 'live_play_file'),
      expected,
      `live_play_file:${file}`,
    );
  }
  assertFileDigest(
    path.resolve(live.caddy_config),
    manifest.routing.caddy_config_sha256,
    'live_caddy_config',
  );

  if (manifest.android) {
    if (!live.android_apk) throw new Error('live_android_apk_required');
    const apk = path.resolve(live.android_apk);
    assertFileDigest(apk, manifest.android.apk_sha256, 'live_android_apk');
    let stat: fs.Stats;
    try {
      stat = fs.statSync(apk);
    } catch {
      throw new Error('live_android_apk_unreadable');
    }
    if (stat.size !== manifest.android.size_bytes) {
      throw new Error('live_android_apk_size_mismatch');
    }
  }
}
