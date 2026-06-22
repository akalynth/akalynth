#!/usr/bin/env node
/**
 * PR-004: SHA256 drift check between data/assets-built/ and client mirrors.
 * Compares every path listed in sync-manifest.json across all mirrors.
 */
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  ASSETS_BUILT,
  CLIENT_MIRRORS,
  MANIFEST_PATH,
  REPO_ROOT,
  sha256File,
} from './lib/loose-sync.mjs';

function readManifest(root) {
  const abs = join(root, MANIFEST_PATH);
  if (!existsSync(abs)) return null;
  try {
    return JSON.parse(readFileSync(abs, 'utf8'));
  } catch (err) {
    return { error: err.message };
  }
}

function main() {
  const builtManifest = readManifest(ASSETS_BUILT);
  if (!builtManifest || builtManifest.error) {
    console.error(
      `✗ verify:asset-sync — missing or invalid ${MANIFEST_PATH} under data/assets-built/ (run npm run sync:assets first)`,
    );
    if (builtManifest?.error) console.error(`  parse error: ${builtManifest.error}`);
    process.exit(1);
  }

  const files = Array.isArray(builtManifest.files) ? builtManifest.files : [];
  if (files.length === 0) {
    console.error('✗ verify:asset-sync — sync-manifest.json has no files');
    process.exit(1);
  }

  const errors = [];

  for (const { path: rel, sha256: expected } of files) {
    const builtAbs = join(ASSETS_BUILT, rel);
    if (!existsSync(builtAbs)) {
      errors.push(`data/assets-built/${rel}: missing (expected sha256 ${expected})`);
      continue;
    }
    const builtSha = sha256File(builtAbs);
    if (builtSha !== expected) {
      errors.push(
        `data/assets-built/${rel}: sha256 drift (manifest ${expected} vs disk ${builtSha})`,
      );
    }

    for (const { name, root } of CLIENT_MIRRORS) {
      const mirrorAbs = join(root, rel);
      if (!existsSync(mirrorAbs)) {
        errors.push(`${name}:${rel}: missing mirror file`);
        continue;
      }
      const mirrorSha = sha256File(mirrorAbs);
      if (mirrorSha !== expected) {
        errors.push(
          `${name}:${rel}: sha256 drift (source ${expected} vs mirror ${mirrorSha})`,
        );
      }
    }
  }

  // Registry + manifest themselves must match across mirrors.
  for (const meta of [MANIFEST_PATH, 'registry.json']) {
    const builtAbs = join(ASSETS_BUILT, meta);
    if (!existsSync(builtAbs)) {
      errors.push(`data/assets-built/${meta}: missing`);
      continue;
    }
    const builtSha = sha256File(builtAbs);
    for (const { name, root } of CLIENT_MIRRORS) {
      const mirrorAbs = join(root, meta);
      if (!existsSync(mirrorAbs)) {
        errors.push(`${name}:${meta}: missing mirror file`);
        continue;
      }
      const mirrorSha = sha256File(mirrorAbs);
      if (mirrorSha !== builtSha) {
        errors.push(`${name}:${meta}: sha256 drift vs data/assets-built/`);
      }
    }
  }

  if (errors.length) {
    console.error(`\n✗ verify:asset-sync — ${errors.length} drift(s):`);
    for (const e of errors) console.error(`  - ${e}`);
    process.exit(1);
  }

  console.log(
    `✓ verify:asset-sync — ${files.length} loose PNG(s) + registry in sync across data/assets-built/ and ${CLIENT_MIRRORS.length} client mirror(s)`,
  );
}

main();