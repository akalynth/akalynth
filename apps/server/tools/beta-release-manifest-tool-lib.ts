import { createHash } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import type { BetaPlatform } from '../../../packages/shared/http.js';
import {
  BETA_RELEASE_MANIFEST_SCHEMA_VERSION,
  type BetaReleaseLivePaths,
  type BetaReleaseManifestV1,
  type BoundBetaReleaseManifest,
  parseBetaReleaseManifest,
} from '../src/beta/releaseManifest.js';

export const BETA_RELEASE_MANIFEST_PREIMAGE_SCHEMA_VERSION =
  'akalynth.beta_release_manifest_preimage.v1' as const;

export interface BetaReleaseManifestPreimageV1 {
  schema_version: typeof BETA_RELEASE_MANIFEST_PREIMAGE_SCHEMA_VERSION;
  release_id: string;
  generated_at: string;
  platform: BetaPlatform;
  backend: {
    commit: string;
    build_info_file: string;
  };
  portal: {
    commit: string;
    root: string;
    files: string[];
  };
  web_client: {
    source_commit: string;
    root: string;
    files: string[];
  };
  policy: BetaReleaseManifestV1['policy'];
  routing: {
    caddy_config_file: string;
    beta_static_root: string;
    beta_api_upstream: string;
  };
  android?: {
    source_commit: string;
    version_code: number;
    version_name: string;
    apk_file: string;
  };
}

interface StableInput {
  absolute_path: string;
  bytes: Buffer;
  device_inode: string;
}

type JsonObject = Record<string, unknown>;

const GIT_COMMIT_RE = /^[0-9a-f]{40}$/;
const SAFE_FILE_RE = /^(?!\/)(?!.*(?:^|\/)\.\.(?:\/|$))[A-Za-z0-9._@+\/-]{1,240}$/;

function objectValue(value: unknown, label: string): JsonObject {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error(`${label}_must_be_an_object`);
  }
  return value as JsonObject;
}

function exactKeys(
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

function stringValue(value: unknown, label: string, maxLength = 512): string {
  if (typeof value !== 'string' || value.length === 0 || value.length > maxLength) {
    throw new Error(`${label}_must_be_a_nonempty_string`);
  }
  return value;
}

function absolutePathValue(value: unknown, label: string): string {
  const candidate = stringValue(value, label, 4096);
  if (!path.isAbsolute(candidate)) throw new Error(`${label}_must_be_absolute`);
  return path.resolve(candidate);
}

function gitCommit(value: unknown, label: string): string {
  if (typeof value !== 'string' || !GIT_COMMIT_RE.test(value)) {
    throw new Error(`${label}_must_be_a_full_lowercase_git_commit`);
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

function relativeFiles(value: unknown, label: string): string[] {
  if (!Array.isArray(value) || value.length === 0 || value.length > 128) {
    throw new Error(`${label}_must_contain_1_to_128_files`);
  }
  const files = value.map((entry, index) => {
    if (typeof entry !== 'string' || !SAFE_FILE_RE.test(entry)) {
      throw new Error(`${label}.${index}_path_invalid`);
    }
    return entry;
  });
  if (new Set(files).size !== files.length) {
    throw new Error(`${label}_contains_duplicate_paths`);
  }
  return files.sort((a, b) => a.localeCompare(b));
}

function parsePolicy(value: unknown): BetaReleaseManifestV1['policy'] {
  const policy = objectValue(value, 'preimage.policy');
  exactKeys(policy, 'preimage.policy', [
    'CHILL_ZONE_GATHER_ENABLED',
    'CHILL_ZONE_REFINE_ENABLED',
    'AKALYNTH_BETA_ENABLED',
    'AKALYNTH_BETA_REQUIRE_INVITE',
  ]);
  return {
    CHILL_ZONE_GATHER_ENABLED: booleanValue(
      policy.CHILL_ZONE_GATHER_ENABLED,
      'preimage.policy.CHILL_ZONE_GATHER_ENABLED',
    ),
    CHILL_ZONE_REFINE_ENABLED: booleanValue(
      policy.CHILL_ZONE_REFINE_ENABLED,
      'preimage.policy.CHILL_ZONE_REFINE_ENABLED',
    ),
    AKALYNTH_BETA_ENABLED: booleanValue(
      policy.AKALYNTH_BETA_ENABLED,
      'preimage.policy.AKALYNTH_BETA_ENABLED',
    ),
    AKALYNTH_BETA_REQUIRE_INVITE: booleanValue(
      policy.AKALYNTH_BETA_REQUIRE_INVITE,
      'preimage.policy.AKALYNTH_BETA_REQUIRE_INVITE',
    ),
  };
}

export function parseBetaReleaseManifestPreimage(
  json: string,
): BetaReleaseManifestPreimageV1 {
  let parsed: unknown;
  try {
    parsed = JSON.parse(json);
  } catch {
    throw new Error('release_manifest_preimage_invalid_json');
  }
  const root = objectValue(parsed, 'preimage');
  exactKeys(
    root,
    'preimage',
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
  if (root.schema_version !== BETA_RELEASE_MANIFEST_PREIMAGE_SCHEMA_VERSION) {
    throw new Error('release_manifest_preimage_schema_version_unsupported');
  }

  const backend = objectValue(root.backend, 'preimage.backend');
  exactKeys(backend, 'preimage.backend', ['commit', 'build_info_file']);
  const portal = objectValue(root.portal, 'preimage.portal');
  exactKeys(portal, 'preimage.portal', ['commit', 'root', 'files']);
  const webClient = objectValue(root.web_client, 'preimage.web_client');
  exactKeys(webClient, 'preimage.web_client', ['source_commit', 'root', 'files']);
  const routing = objectValue(root.routing, 'preimage.routing');
  exactKeys(routing, 'preimage.routing', [
    'caddy_config_file',
    'beta_static_root',
    'beta_api_upstream',
  ]);

  let android: BetaReleaseManifestPreimageV1['android'];
  if (root.android !== undefined) {
    const value = objectValue(root.android, 'preimage.android');
    exactKeys(value, 'preimage.android', [
      'source_commit',
      'version_code',
      'version_name',
      'apk_file',
    ]);
    android = {
      source_commit: gitCommit(value.source_commit, 'preimage.android.source_commit'),
      version_code: positiveInteger(value.version_code, 'preimage.android.version_code'),
      version_name: stringValue(value.version_name, 'preimage.android.version_name', 128),
      apk_file: absolutePathValue(value.apk_file, 'preimage.android.apk_file'),
    };
  }

  return {
    schema_version: BETA_RELEASE_MANIFEST_PREIMAGE_SCHEMA_VERSION,
    release_id: stringValue(root.release_id, 'preimage.release_id', 128),
    generated_at: stringValue(root.generated_at, 'preimage.generated_at', 64),
    platform: platformValue(root.platform, 'preimage.platform'),
    backend: {
      commit: gitCommit(backend.commit, 'preimage.backend.commit'),
      build_info_file: absolutePathValue(
        backend.build_info_file,
        'preimage.backend.build_info_file',
      ),
    },
    portal: {
      commit: gitCommit(portal.commit, 'preimage.portal.commit'),
      root: absolutePathValue(portal.root, 'preimage.portal.root'),
      files: relativeFiles(portal.files, 'preimage.portal.files'),
    },
    web_client: {
      source_commit: gitCommit(
        webClient.source_commit,
        'preimage.web_client.source_commit',
      ),
      root: absolutePathValue(webClient.root, 'preimage.web_client.root'),
      files: relativeFiles(webClient.files, 'preimage.web_client.files'),
    },
    policy: parsePolicy(root.policy),
    routing: {
      caddy_config_file: absolutePathValue(
        routing.caddy_config_file,
        'preimage.routing.caddy_config_file',
      ),
      beta_static_root: absolutePathValue(
        routing.beta_static_root,
        'preimage.routing.beta_static_root',
      ),
      beta_api_upstream: stringValue(
        routing.beta_api_upstream,
        'preimage.routing.beta_api_upstream',
      ),
    },
    ...(android ? { android } : {}),
  };
}

function assertNoSymlinkComponents(absolutePath: string, label: string): void {
  const parsed = path.parse(absolutePath);
  let current = parsed.root;
  for (const part of absolutePath.slice(parsed.root.length).split(path.sep).filter(Boolean)) {
    current = path.join(current, part);
    let stat: fs.Stats;
    try {
      stat = fs.lstatSync(current);
    } catch {
      throw new Error(`${label}_missing`);
    }
    if (stat.isSymbolicLink()) throw new Error(`${label}_symlink_rejected`);
  }
}

function sameStat(a: fs.BigIntStats, b: fs.BigIntStats): boolean {
  return a.dev === b.dev
    && a.ino === b.ino
    && a.size === b.size
    && a.mtimeNs === b.mtimeNs
    && a.ctimeNs === b.ctimeNs
    && a.nlink === b.nlink;
}

export function readStableRegularFile(
  file: string,
  label: string,
  seenInputs?: Map<string, string>,
): StableInput {
  const absolutePath = path.resolve(file);
  assertNoSymlinkComponents(absolutePath, label);
  let descriptor: number | null = null;
  try {
    descriptor = fs.openSync(
      absolutePath,
      fs.constants.O_RDONLY | fs.constants.O_NOFOLLOW,
    );
    const before = fs.fstatSync(descriptor, { bigint: true });
    if (!before.isFile()) throw new Error(`${label}_must_be_a_regular_file`);
    if (before.nlink !== 1n) throw new Error(`${label}_must_be_single_link`);
    if ((Number(before.mode) & 0o022) !== 0) {
      throw new Error(`${label}_must_not_be_group_or_other_writable`);
    }
    const bytes = fs.readFileSync(descriptor);
    const after = fs.fstatSync(descriptor, { bigint: true });
    const pathAfter = fs.lstatSync(absolutePath, { bigint: true });
    if (!sameStat(before, after) || !sameStat(after, pathAfter)) {
      throw new Error(`${label}_changed_while_reading`);
    }
    const deviceInode = `${before.dev.toString()}:${before.ino.toString()}`;
    const prior = seenInputs?.get(deviceInode);
    if (prior) throw new Error(`${label}_duplicates_input:${prior}`);
    seenInputs?.set(deviceInode, label);
    return { absolute_path: absolutePath, bytes, device_inode: deviceInode };
  } catch (error) {
    if (error instanceof Error && error.message.startsWith(`${label}_`)) throw error;
    throw new Error(`${label}_unreadable`);
  } finally {
    if (descriptor !== null) fs.closeSync(descriptor);
  }
}

function stableRootFile(
  root: string,
  relativeFile: string,
  label: string,
  seenInputs: Map<string, string>,
): StableInput {
  const resolvedRoot = path.resolve(root);
  assertNoSymlinkComponents(resolvedRoot, `${label}_root`);
  const rootStat = fs.lstatSync(resolvedRoot);
  if (!rootStat.isDirectory()) throw new Error(`${label}_root_must_be_a_directory`);
  const candidate = path.resolve(resolvedRoot, relativeFile);
  const relative = path.relative(resolvedRoot, candidate);
  if (relative.startsWith('..') || path.isAbsolute(relative)) {
    throw new Error(`${label}_escapes_root`);
  }
  const realRoot = fs.realpathSync(resolvedRoot);
  let realCandidate: string;
  try {
    realCandidate = fs.realpathSync(candidate);
  } catch {
    throw new Error(`${label}_missing`);
  }
  const realRelative = path.relative(realRoot, realCandidate);
  if (realRelative.startsWith('..') || path.isAbsolute(realRelative)) {
    throw new Error(`${label}_escapes_root`);
  }
  return readStableRegularFile(candidate, label, seenInputs);
}

function sha256Bytes(bytes: Buffer): string {
  return createHash('sha256').update(bytes).digest('hex');
}

function digestFiles(
  root: string,
  files: string[],
  label: string,
  seenInputs: Map<string, string>,
): Record<string, string> {
  return Object.fromEntries(
    files.map((file) => {
      const input = stableRootFile(root, file, `${label}:${file}`, seenInputs);
      return [file, sha256Bytes(input.bytes)];
    }),
  );
}

function assertBuildInfoCommit(bytes: Buffer, commit: string, label: string): void {
  let parsed: unknown;
  try {
    parsed = JSON.parse(bytes.toString('utf8'));
  } catch {
    throw new Error(`${label}_invalid_json`);
  }
  if (
    !parsed
    || typeof parsed !== 'object'
    || (parsed as Record<string, unknown>).commit !== commit
  ) {
    throw new Error(`${label}_commit_mismatch`);
  }
}

export function materializeBetaReleaseManifest(
  spec: BetaReleaseManifestPreimageV1,
): BoundBetaReleaseManifest {
  const seenInputs = new Map<string, string>();
  const buildInfo = readStableRegularFile(
    spec.backend.build_info_file,
    'preimage_backend_build_info',
    seenInputs,
  );
  assertBuildInfoCommit(buildInfo.bytes, spec.backend.commit, 'preimage_backend_build_info');
  const portalFiles = digestFiles(
    spec.portal.root,
    spec.portal.files,
    'preimage_portal_file',
    seenInputs,
  );
  const webClientFiles = digestFiles(
    spec.web_client.root,
    spec.web_client.files,
    'preimage_web_client_file',
    seenInputs,
  );
  const caddy = readStableRegularFile(
    spec.routing.caddy_config_file,
    'preimage_caddy_config',
    seenInputs,
  );

  let android: BetaReleaseManifestV1['android'];
  if (spec.android) {
    const apk = readStableRegularFile(
      spec.android.apk_file,
      'preimage_android_apk',
      seenInputs,
    );
    android = {
      source_commit: spec.android.source_commit,
      version_code: spec.android.version_code,
      version_name: spec.android.version_name,
      apk_sha256: sha256Bytes(apk.bytes),
      size_bytes: apk.bytes.length,
    };
  }

  const manifest: BetaReleaseManifestV1 = {
    schema_version: BETA_RELEASE_MANIFEST_SCHEMA_VERSION,
    release_id: spec.release_id,
    generated_at: spec.generated_at,
    platform: spec.platform,
    backend: {
      commit: spec.backend.commit,
      build_info_sha256: sha256Bytes(buildInfo.bytes),
    },
    portal: {
      commit: spec.portal.commit,
      files_sha256: portalFiles,
    },
    web_client: {
      source_commit: spec.web_client.source_commit,
      files_sha256: webClientFiles,
    },
    policy: spec.policy,
    routing: {
      caddy_config_sha256: sha256Bytes(caddy.bytes),
      beta_static_root: spec.routing.beta_static_root,
      beta_api_upstream: spec.routing.beta_api_upstream,
    },
    ...(android ? { android } : {}),
  };
  return parseBetaReleaseManifest(JSON.stringify(manifest));
}

export function readPreimageFile(file: string): BetaReleaseManifestPreimageV1 {
  const input = readStableRegularFile(file, 'release_manifest_preimage');
  return parseBetaReleaseManifestPreimage(input.bytes.toString('utf8'));
}

export function readBoundManifestFile(file: string): BoundBetaReleaseManifest {
  const input = readStableRegularFile(file, 'release_manifest');
  return parseBetaReleaseManifest(input.bytes.toString('utf8'));
}

export function writeCanonicalManifest(
  outputFile: string,
  bound: BoundBetaReleaseManifest,
): void {
  const absolutePath = path.resolve(outputFile);
  const parent = path.dirname(absolutePath);
  assertNoSymlinkComponents(parent, 'release_manifest_output_parent');
  if (!fs.lstatSync(parent).isDirectory()) {
    throw new Error('release_manifest_output_parent_must_be_a_directory');
  }
  try {
    fs.writeFileSync(absolutePath, `${bound.canonical_json}\n`, {
      encoding: 'utf8',
      flag: 'wx',
      mode: 0o600,
    });
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'EEXIST') {
      throw new Error('release_manifest_output_already_exists');
    }
    throw error;
  }
}

export function verifyBetaReleaseManifestPreimage(
  spec: BetaReleaseManifestPreimageV1,
  expected: BoundBetaReleaseManifest,
): BoundBetaReleaseManifest {
  const materialized = materializeBetaReleaseManifest(spec);
  if (
    materialized.sha256 !== expected.sha256
    || materialized.canonical_json !== expected.canonical_json
  ) {
    throw new Error('release_manifest_preimage_mismatch');
  }
  return materialized;
}

function assertDigest(input: StableInput, expected: string, label: string): void {
  if (sha256Bytes(input.bytes) !== expected) throw new Error(`${label}_sha256_mismatch`);
}

export function verifyBetaReleaseManifestLiveFilesStable(
  bound: BoundBetaReleaseManifest,
  live: BetaReleaseLivePaths,
): void {
  const manifest = bound.manifest;
  const portalRoot = path.resolve(live.portal_root);
  if (portalRoot !== path.resolve(manifest.routing.beta_static_root)) {
    throw new Error('live_portal_root_mismatch');
  }
  const playRoot = path.resolve(live.play_root);
  if (playRoot !== path.resolve(portalRoot, 'play')) {
    throw new Error('live_play_root_mismatch');
  }

  const seenInputs = new Map<string, string>();
  const buildInfo = readStableRegularFile(
    live.backend_build_info,
    'live_backend_build_info',
    seenInputs,
  );
  assertDigest(
    buildInfo,
    manifest.backend.build_info_sha256,
    'live_backend_build_info',
  );
  assertBuildInfoCommit(buildInfo.bytes, manifest.backend.commit, 'live_backend_build_info');

  for (const [file, expected] of Object.entries(manifest.portal.files_sha256)) {
    assertDigest(
      stableRootFile(portalRoot, file, `live_portal_file:${file}`, seenInputs),
      expected,
      `live_portal_file:${file}`,
    );
  }
  for (const [file, expected] of Object.entries(manifest.web_client.files_sha256)) {
    assertDigest(
      stableRootFile(playRoot, file, `live_play_file:${file}`, seenInputs),
      expected,
      `live_play_file:${file}`,
    );
  }
  assertDigest(
    readStableRegularFile(live.caddy_config, 'live_caddy_config', seenInputs),
    manifest.routing.caddy_config_sha256,
    'live_caddy_config',
  );

  if (manifest.android) {
    if (!live.android_apk) throw new Error('live_android_apk_required');
    const apk = readStableRegularFile(live.android_apk, 'live_android_apk', seenInputs);
    assertDigest(apk, manifest.android.apk_sha256, 'live_android_apk');
    if (apk.bytes.length !== manifest.android.size_bytes) {
      throw new Error('live_android_apk_size_mismatch');
    }
  }
}
