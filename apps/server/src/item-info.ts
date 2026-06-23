import fs from 'node:fs';
import path from 'node:path';

import {
  buildItemIconSpriteIndex,
  itemIconSpriteIdForType,
  type AssetManifest,
} from '../../../packages/shared/assetRegistry.js';
import type { ItemInfo } from '../../../packages/shared/protocol.js';

let itemIconIndex: ReadonlyMap<string, string> = new Map();

export function loadItemIconIndex(repoRoot: string): void {
  const registryPath = path.join(repoRoot, 'data/assets-built/registry.json');
  if (!fs.existsSync(registryPath)) {
    itemIconIndex = new Map();
    return;
  }

  const manifest = JSON.parse(fs.readFileSync(registryPath, 'utf8')) as AssetManifest;
  itemIconIndex = buildItemIconSpriteIndex(manifest);
}

export function toItemInfo(
  itemId: string,
  itemType: string,
  slot?: string | null
): ItemInfo {
  const icon_sprite_id = itemIconSpriteIdForType(itemType, itemIconIndex);
  return {
    item_id: itemId,
    item_type: itemType,
    ...(icon_sprite_id ? { icon_sprite_id } : {}),
    ...(slot !== undefined ? { slot } : {}),
  };
}

export function toItemInfoFromPersist(
  itemId: string,
  getItem: (id: string) => { item_type: string } | undefined,
  slot?: string | null
): ItemInfo {
  return toItemInfo(itemId, getItem(itemId)?.item_type ?? 'unknown', slot);
}