export interface InventoryItemRef {
  item_id: string;
  item_type: string;
  slot?: string | null;
}

const USABLE_TYPES = new Set(['healing_herb', 'training_slime_goo', 'city_rat_goo']);

export function itemLabel(itemType: string): string {
  return itemType
    .replace(/_/g, ' ')
    .replace(/\b\w/g, c => c.toUpperCase());
}

export function shortItemLabel(itemType: string): string {
  return itemLabel(itemType)
    .split(' ')
    .map((part) => part.slice(0, 4))
    .join(' ');
}

export function isUsableItemType(itemType: string): boolean {
  return USABLE_TYPES.has(itemType);
}
