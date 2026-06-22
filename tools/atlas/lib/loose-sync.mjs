#!/usr/bin/env node
/**
 * Shared loose-PNG sync helpers (PR-004).
 * Source of truth: data/assets-src/sprites/ (after verify:assets).
 * Canonical built mirror: data/assets-built/
 * Client mirrors: Android assets/ + debug-client public/atlas/
 */
import { createHash } from 'node:crypto';
import {
  copyFileSync,
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  realpathSync,
  statSync,
  writeFileSync,
} from 'node:fs';
import { dirname, join, relative, sep } from 'node:path';
import {
  ASSET_REGISTRY_SCHEMA_VERSION,
  ASSETS_BUILT,
  ASSETS_SRC,
  CLIENT_MIRRORS,
  MANIFEST_PATH,
  REGISTRY_PATH,
  SPRITES_SRC,
} from './paths.mjs';
import {
  buildRegistryManifest,
  compileRegistryEntries,
} from './registry-compile.mjs';

export {
  AKALYNTH_STYLE_CONTRACT,
  ASSETS_BUILT,
  ASSETS_SRC,
  CLIENT_MIRRORS,
  HAS_PNG_STATUS,
  MANIFEST_PATH,
  REGISTRY_PATH,
  REPO_ROOT,
  SPRITES_SRC,
  UI_PACK_REL,
} from './paths.mjs';

/** Repo-relative path under data/assets-built/ for a source PNG. */
export function builtRelFromSrcPng(absPng) {
  const rel = relative(ASSETS_SRC, absPng).split(sep).join('/');
  if (rel.startsWith('sprites/world/') || rel.startsWith('sprites/ui/')) {
    return rel.slice('sprites/'.length);
  }
  return rel;
}

function walkFiles(dir, seen = new Set()) {
  const out = [];
  if (!existsSync(dir)) return out;
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const abs = join(dir, entry.name);
    let stat;
    try {
      stat = statSync(abs);
    } catch {
      continue;
    }
    if (stat.isDirectory()) {
      const real = realpathSync(abs);
      if (seen.has(real)) continue;
      seen.add(real);
      out.push(...walkFiles(abs, seen));
    } else if (stat.isFile()) {
      out.push(abs);
    }
  }
  return out;
}

/**
 * Collect verified loose PNGs and registry entries from compile-registry logic.
 * Assumes verify:assets already passed.
 */
export function collectLooseSyncPlan() {
  const entries = walkFiles(SPRITES_SRC);
  const pngs = entries.filter((e) => e.endsWith('.png'));

  const pngFiles = pngs.map((srcAbs) => ({
    srcAbs,
    builtRel: builtRelFromSrcPng(srcAbs),
  }));

  const registryEntries = compileRegistryEntries();

  return { pngFiles, registryEntries };
}

export function sha256File(abs) {
  return createHash('sha256').update(readFileSync(abs)).digest('hex');
}

function ensureParent(abs) {
  mkdirSync(dirname(abs), { recursive: true });
}

function copyTo(abs, srcAbs) {
  ensureParent(abs);
  copyFileSync(srcAbs, abs);
}

/** Copy one loose PNG into built + client mirrors. */
export function mirrorPng({ srcAbs, builtRel }) {
  const builtAbs = join(ASSETS_BUILT, builtRel);
  copyTo(builtAbs, srcAbs);
  for (const { root } of CLIENT_MIRRORS) {
    copyTo(join(root, builtRel), srcAbs);
  }
  return { builtRel, sha256: sha256File(srcAbs) };
}

/** Write registry.json + sync-manifest.json to built + client mirrors. */
export function writeSyncArtifacts({ registryEntries, fileHashes }) {
  const registry = buildRegistryManifest(registryEntries);
  const registryJson = `${JSON.stringify(registry, null, 2)}\n`;

  const manifest = {
    schema_version: ASSET_REGISTRY_SCHEMA_VERSION,
    mode: 'loose_png',
    generated_at: new Date().toISOString(),
    files: [...fileHashes].sort((a, b) => a.path.localeCompare(b.path)),
  };
  const manifestJson = `${JSON.stringify(manifest, null, 2)}\n`;

  const targets = [ASSETS_BUILT, ...CLIENT_MIRRORS.map((m) => m.root)];
  for (const root of targets) {
    ensureParent(join(root, REGISTRY_PATH));
    writeFileSync(join(root, REGISTRY_PATH), registryJson, 'utf8');
    writeFileSync(join(root, MANIFEST_PATH), manifestJson, 'utf8');
  }

  return {
    registryCount: registryEntries.length,
    pngCount: fileHashes.length,
  };
}

/** List every synced artifact path (PNGs + registry + manifest) under assets-built. */
export function listBuiltSyncArtifacts() {
  const { pngFiles } = collectLooseSyncPlan();
  const paths = pngFiles.map((f) => f.builtRel);
  paths.push(REGISTRY_PATH, MANIFEST_PATH);
  return [...new Set(paths)].sort();
}