#!/usr/bin/env tsx
// Read-only materialization and verification for Beta Release Manifest v1.
// This tool never opens the Akalynth database or receipt chain.
import path from 'node:path';
import {
  materializeBetaReleaseManifest,
  readBoundManifestFile,
  readPreimageFile,
  verifyBetaReleaseManifestLiveFilesStable,
  verifyBetaReleaseManifestPreimage,
  writeCanonicalManifest,
} from './beta-release-manifest-tool-lib.js';

function usage(): string {
  return [
    'Usage:',
    '  npm -w apps/server run beta:release-manifest -- materialize --spec <preimage.json> --output <manifest.json>',
    '  npm -w apps/server run beta:release-manifest -- verify-preimage --spec <preimage.json> --manifest <manifest.json>',
    '  npm -w apps/server run beta:release-manifest -- verify-live --manifest <manifest.json> --backend-build-info <file> --portal-root <dir> --play-root <dir> --caddy-config <file> [--android-apk <file>]',
  ].join('\n');
}

function options(
  argv: string[],
  allowed: readonly string[],
  required: readonly string[],
): Map<string, string> {
  const values = new Map<string, string>();
  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (!token.startsWith('--')) throw new Error(`unexpected_argument:${token}`);
    const name = token.slice(2);
    if (!allowed.includes(name)) throw new Error(`unknown_option:--${name}`);
    if (values.has(name)) throw new Error(`duplicate_option:--${name}`);
    const value = argv[index + 1];
    if (!value || value.startsWith('--')) throw new Error(`missing_value:--${name}`);
    values.set(name, value);
    index += 1;
  }
  for (const name of required) {
    if (!values.has(name)) throw new Error(`missing_option:--${name}`);
  }
  return values;
}

function resolved(values: Map<string, string>, name: string): string {
  const value = values.get(name);
  if (!value) throw new Error(`missing_option:--${name}`);
  return path.resolve(value);
}

function printResult(result: Record<string, unknown>): void {
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
}

function main(): void {
  const [command, ...argv] = process.argv.slice(2);
  if (!command || command === '--help' || command === 'help') {
    process.stdout.write(`${usage()}\n`);
    return;
  }

  if (command === 'materialize') {
    const args = options(argv, ['spec', 'output'], ['spec', 'output']);
    const spec = readPreimageFile(resolved(args, 'spec'));
    const bound = materializeBetaReleaseManifest(spec);
    const output = resolved(args, 'output');
    writeCanonicalManifest(output, bound);
    printResult({
      ok: true,
      command,
      output,
      schema_version: bound.manifest.schema_version,
      release_id: bound.manifest.release_id,
      platform: bound.manifest.platform,
      sha256: bound.sha256,
    });
    return;
  }

  if (command === 'verify-preimage') {
    const args = options(argv, ['spec', 'manifest'], ['spec', 'manifest']);
    const expected = readBoundManifestFile(resolved(args, 'manifest'));
    verifyBetaReleaseManifestPreimage(
      readPreimageFile(resolved(args, 'spec')),
      expected,
    );
    printResult({
      ok: true,
      command,
      release_id: expected.manifest.release_id,
      sha256: expected.sha256,
    });
    return;
  }

  if (command === 'verify-live') {
    const args = options(
      argv,
      [
        'manifest',
        'backend-build-info',
        'portal-root',
        'play-root',
        'caddy-config',
        'android-apk',
      ],
      ['manifest', 'backend-build-info', 'portal-root', 'play-root', 'caddy-config'],
    );
    const bound = readBoundManifestFile(resolved(args, 'manifest'));
    verifyBetaReleaseManifestLiveFilesStable(bound, {
      backend_build_info: resolved(args, 'backend-build-info'),
      portal_root: resolved(args, 'portal-root'),
      play_root: resolved(args, 'play-root'),
      caddy_config: resolved(args, 'caddy-config'),
      ...(args.has('android-apk')
        ? { android_apk: resolved(args, 'android-apk') }
        : {}),
    });
    printResult({
      ok: true,
      command,
      release_id: bound.manifest.release_id,
      sha256: bound.sha256,
    });
    return;
  }

  throw new Error(`unknown_command:${command}`);
}

try {
  main();
} catch (error) {
  const message = error instanceof Error ? error.message : String(error);
  process.stderr.write(`[beta-release-manifest] FAIL: ${message}\n`);
  process.exitCode = 1;
}
