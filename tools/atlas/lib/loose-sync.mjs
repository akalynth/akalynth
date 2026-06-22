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
import { fileURLToPath } from 'node:url';

export const REPO_ROOT = fileURLToPath(new URL('../../../', import.meta.url));
export const ASSETS_SRC = join(REPO_ROOT, 'data/assets-src');
export const SPRITES_SRC = join(ASSETS_SRC, 'sprites');
export const ASSETS_BUILT = join(REPO_ROOT, 'data/assets-built');
export const REGISTRY_PATH = 'registry.json';
export const MANIFEST_PATH = 'sync-manifest.json';
export const UI_PACK_REL = 'data/assets-src/sprites/ui/ui_gameplay_v1.json';

export const AKALYNTH_STYLE_CONTRACT =
  'nostalgic_top_down_mmo_readability_original_akalynth_assets_v1';
export const ASSET_REGISTRY_SCHEMA_VERSION = 1;

export const HAS_PNG_STATUS = new Set([
  'cleaned_png',
  'manifest_recorded',
  'tilemap_tested',
  'human_reviewed',
  'promoted',
  'legacy',
]);

export const CLIENT_MIRRORS = [
  { name: 'android', root: join(REPO_ROOT, 'apps/android/app/src/main/assets') },
  { name: 'debug-client', root: join(REPO_ROOT, 'apps/debug-client/public/atlas') },
];

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

function readJson(abs) {
  return JSON.parse(readFileSync(abs, 'utf8'));
}

function normalizeFactoryEntry(manifest, builtRel) {
  if (manifest.asset_type === 'item') {
    if (manifest.status !== 'promoted' || typeof manifest.item_type !== 'string') {
      return null;
    }
  }
  const dp = manifest.dimensions_px;
  if (!Array.isArray(dp) || dp.length !== 2) return null;
  const entry = {
    asset_id: manifest.asset_id,
    source: 'factory',
    asset_type: manifest.asset_type,
    file: builtRel,
    frame: { w: dp[0], h: dp[1] },
    style_contract: manifest.style_contract,
    mechanics: null,
  };
  if (typeof manifest.item_type === 'string') entry.item_type = manifest.item_type;
  if (typeof manifest.chronicle_kind === 'string') entry.chronicle_kind = manifest.chronicle_kind;
  return entry;
}

function normalizeWorldEntry(manifest, builtRel) {
  const frame = manifest.frame;
  if (!frame || typeof frame.width !== 'number' || typeof frame.height !== 'number') return null;
  return {
    asset_id: `akalynth_world_${manifest.id}`,
    source: 'world_sidecar',
    asset_type: manifest.asset_type,
    file: builtRel,
    frame: { w: frame.width, h: frame.height },
    style_contract: AKALYNTH_STYLE_CONTRACT,
    mechanics: null,
    rendering: manifest.rendering,
  };
}

function normalizeUiEntry(asset) {
  const dp = asset.dimensions_px;
  if (!Array.isArray(dp) || dp.length !== 2) return null;
  return {
    asset_id: asset.asset_id,
    source: 'ui_pack',
    asset_type: 'ui',
    file: `ui/${asset.file}`,
    frame: { w: dp[0], h: dp[1] },
    kind: asset.kind,
    slice_px: asset.slice_px,
    style_contract: asset.style_contract,
    mechanics: null,
  };
}

/**
 * Collect verified loose PNGs and optional registry entries.
 * Assumes verify:assets already passed.
 */
export function collectLooseSyncPlan() {
  const pngFiles = [];
  const registryById = new Map();

  const entries = walkFiles(SPRITES_SRC);
  const pngs = entries.filter((e) => e.endsWith('.png'));
  const rels = new Set(entries.map((e) => relative(REPO_ROOT, e)));

  for (const pngPath of pngs) {
    const relFromSprites = relative(SPRITES_SRC, pngPath);
    const builtRel = builtRelFromSrcPng(pngPath);
    pngFiles.push({ srcAbs: pngPath, builtRel });

    const sidecarRel = relative(REPO_ROOT, pngPath).replace(/\.png$/, '.json');
    if (!rels.has(sidecarRel)) continue;

    const sidecarPath = join(REPO_ROOT, sidecarRel);
    let manifest;
    try {
      manifest = readJson(sidecarPath);
    } catch {
      continue;
    }

    if (relFromSprites.startsWith(`ui${sep}`)) continue;

    if (relFromSprites.startsWith(`world${sep}`)) {
      const entry = normalizeWorldEntry(manifest, builtRel);
      if (entry) registryById.set(entry.asset_id, entry);
      continue;
    }

    if (
      relFromSprites.startsWith(`characters${sep}`) ||
      relFromSprites.startsWith(`creatures${sep}`)
    ) {
      continue;
    }

    if (!HAS_PNG_STATUS.has(manifest.status)) continue;
    const entry = normalizeFactoryEntry(manifest, builtRel);
    if (entry) registryById.set(entry.asset_id, entry);
  }

  const uiPackPath = join(REPO_ROOT, UI_PACK_REL);
  if (existsSync(uiPackPath)) {
    const pack = readJson(uiPackPath);
    for (const asset of pack.assets ?? []) {
      const entry = normalizeUiEntry(asset);
      if (entry) registryById.set(entry.asset_id, entry);
    }
  }

  const registryEntries = [...registryById.values()].sort((a, b) =>
    a.asset_id.localeCompare(b.asset_id),
  );

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
  const registry = {
    schema_version: ASSET_REGISTRY_SCHEMA_VERSION,
    entries: registryEntries,
  };
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