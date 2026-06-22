#!/usr/bin/env node
/**
 * Compile normalized registry entries from verified asset sources (PR-005).
 * See tools/atlas/NORMALIZATION.md.
 */
import { existsSync, readFileSync, readdirSync, realpathSync, statSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import {
  AKALYNTH_STYLE_CONTRACT,
  ASSET_REGISTRY_SCHEMA_VERSION,
  ASSETS_SRC,
  HAS_PNG_STATUS,
  REPO_ROOT,
  SPRITES_SRC,
  UI_PACK_REL,
} from './paths.mjs';

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

/** Repo-relative path under data/assets-built/ for a source PNG. */
function builtRelFromSrcPng(absPng) {
  const rel = relative(ASSETS_SRC, absPng).split(sep).join('/');
  if (rel.startsWith('sprites/world/') || rel.startsWith('sprites/ui/')) {
    return rel.slice('sprites/'.length);
  }
  return rel;
}

export function normalizeFactoryEntry(manifest, builtRel) {
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

export function normalizeWorldEntry(manifest, builtRel) {
  const frame = manifest.frame;
  if (!frame || typeof frame.width !== 'number' || typeof frame.height !== 'number') return null;
  const rendering = manifest.rendering;
  if (!rendering || typeof rendering.draw_scale !== 'number' || rendering.draw_scale <= 0) {
    return null;
  }
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

export function normalizeUiEntry(asset) {
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

function addEntry(registryById, collisions, entry, sourceLabel) {
  if (!entry?.asset_id) return;
  const existing = registryById.get(entry.asset_id);
  if (existing) {
    collisions.push({
      asset_id: entry.asset_id,
      first: existing._sourceLabel,
      second: sourceLabel,
    });
    return;
  }
  registryById.set(entry.asset_id, { ...entry, _sourceLabel: sourceLabel });
}

function stripInternalLabels(entry) {
  const { _sourceLabel: _ignored, ...rest } = entry;
  return rest;
}

/**
 * Merge factory sidecars, ui_gameplay_v1.json, and world sidecars into registry entries.
 * Assumes verify:assets already passed. Fails on asset_id collisions.
 */
export function compileRegistryEntries() {
  const registryById = new Map();
  const collisions = [];

  const entries = walkFiles(SPRITES_SRC);
  const pngs = entries.filter((e) => e.endsWith('.png'));
  const rels = new Set(entries.map((e) => relative(REPO_ROOT, e)));

  for (const pngPath of pngs) {
    const relFromSprites = relative(SPRITES_SRC, pngPath);
    const builtRel = builtRelFromSrcPng(pngPath);
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
      addEntry(registryById, collisions, entry, sidecarRel);
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
    addEntry(registryById, collisions, entry, sidecarRel);
  }

  const uiPackPath = join(REPO_ROOT, UI_PACK_REL);
  if (existsSync(uiPackPath)) {
    const pack = readJson(uiPackPath);
    for (const asset of pack.assets ?? []) {
      const entry = normalizeUiEntry(asset);
      const label = `${UI_PACK_REL}#${asset.asset_id ?? asset.file ?? 'unknown'}`;
      addEntry(registryById, collisions, entry, label);
    }
  }

  if (collisions.length) {
    const details = collisions
      .map((c) => `${c.asset_id} (${c.first} vs ${c.second})`)
      .join('; ');
    throw new Error(`asset_id collision(s): ${details}`);
  }

  const registryEntries = [...registryById.values()]
    .map(stripInternalLabels)
    .sort((a, b) => a.asset_id.localeCompare(b.asset_id));

  return registryEntries;
}

export function buildRegistryManifest(entries) {
  return {
    schema_version: ASSET_REGISTRY_SCHEMA_VERSION,
    entries,
  };
}

export function readCompiledRegistry(absPath) {
  const registry = readJson(absPath);
  if (registry?.schema_version !== ASSET_REGISTRY_SCHEMA_VERSION) {
    throw new Error(`invalid schema_version in ${absPath}`);
  }
  if (!Array.isArray(registry.entries)) {
    throw new Error(`invalid entries array in ${absPath}`);
  }
  return registry.entries;
}