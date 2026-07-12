import fs from 'node:fs';
import path from 'node:path';
import { buildItemIconSpriteIndex, itemIconSpriteIdForType, } from '../../../packages/shared/assetRegistry.js';
let itemIconIndex = new Map();
export function loadItemIconIndex(repoRoot) {
    const registryPath = path.join(repoRoot, 'data/assets-built/registry.json');
    if (!fs.existsSync(registryPath)) {
        itemIconIndex = new Map();
        return;
    }
    const manifest = JSON.parse(fs.readFileSync(registryPath, 'utf8'));
    itemIconIndex = buildItemIconSpriteIndex(manifest);
}
export function toItemInfo(itemId, itemType, slot) {
    const icon_sprite_id = itemIconSpriteIdForType(itemType, itemIconIndex);
    return {
        item_id: itemId,
        item_type: itemType,
        ...(icon_sprite_id ? { icon_sprite_id } : {}),
        ...(slot !== undefined ? { slot } : {}),
    };
}
export function toItemInfoFromPersist(itemId, getItem, slot) {
    return toItemInfo(itemId, getItem(itemId)?.item_type ?? 'unknown', slot);
}
