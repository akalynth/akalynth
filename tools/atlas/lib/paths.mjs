#!/usr/bin/env node
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

export const REPO_ROOT = fileURLToPath(new URL('../../../', import.meta.url));
export const ASSETS_SRC = join(REPO_ROOT, 'data/assets-src');
export const SPRITES_SRC = join(ASSETS_SRC, 'sprites');
export const ASSETS_BUILT = join(REPO_ROOT, 'data/assets-built');
export const REGISTRY_PATH = 'registry.json';
export const MANIFEST_PATH = 'sync-manifest.json';
export const ATLAS_REL = 'atlas';
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