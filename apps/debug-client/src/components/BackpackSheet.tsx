import {
  isUsableItemType,
  itemLabel,
  type InventoryItemRef,
} from '../data/inventoryPresentation';

interface BackpackSheetProps {
  open: boolean;
  inventory: InventoryItemRef[];
  onClose: () => void;
  onUseItem: (itemId: string) => void;
  onDrop: (itemId: string) => void;
  onProtect: (itemId: string) => void;
}

interface InventoryGroup {
  key: string;
  itemType: string;
  slot: string | null;
  count: number;
  firstItemId: string;
}

const EQUIPMENT_SLOTS = ['hand', 'body', 'trinket'] as const;

function slotLabel(slot: string): string {
  return slot
    .replace(/_/g, ' ')
    .replace(/\b\w/g, c => c.toUpperCase());
}

function equippedLoadout(items: InventoryItemRef[]): Array<{ slot: string; itemType: string | null }> {
  return EQUIPMENT_SLOTS.map((slot) => {
    const item = items.find((entry) => entry.slot === slot);
    return {
      slot,
      itemType: item?.item_type ?? null,
    };
  });
}

function groupedInventory(items: InventoryItemRef[]): InventoryGroup[] {
  const groups = new Map<string, InventoryGroup>();
  for (const item of items) {
    const slot = item.slot ?? null;
    const key = `${item.item_type}:${slot ?? 'none'}`;
    const existing = groups.get(key);
    if (existing) {
      existing.count += 1;
      continue;
    }
    groups.set(key, {
      key,
      itemType: item.item_type,
      slot,
      count: 1,
      firstItemId: item.item_id,
    });
  }
  return Array.from(groups.values()).sort((a, b) => itemLabel(a.itemType).localeCompare(itemLabel(b.itemType)));
}

export function BackpackSheet({ open, inventory, onClose, onUseItem, onDrop, onProtect }: BackpackSheetProps) {
  if (!open) return null;
  const groups = groupedInventory(inventory);
  const loadout = equippedLoadout(inventory);

  return (
    <div className="mobile-sheet-layer mobile-sheet-layer--backpack">
      <button
        type="button"
        className="mobile-sheet-backdrop"
        onClick={onClose}
        aria-label="Close backpack"
      />
      <div className="backpack-sheet" role="dialog" aria-modal="true" aria-label="Backpack">
        <div className="backpack-sheet__header">
          <div>
            <span>Backpack</span>
            <strong>{inventory.length} item{inventory.length === 1 ? '' : 's'}</strong>
          </div>
          <button type="button" onClick={onClose} aria-label="Close backpack">x</button>
        </div>
        <div className="backpack-sheet__body">
          {groups.length === 0 && (
            <div className="backpack-empty">No items carried.</div>
          )}
          {groups.length > 0 && (
            <div className="backpack-row" aria-label="Equipped loadout">
              <div className="backpack-row__icon" aria-hidden="true">
                Eq
              </div>
              <div className="backpack-row__main">
                <strong>Equipped Loadout</strong>
                <span>
                  {loadout
                    .map(({ slot, itemType }) => `${slotLabel(slot)}: ${itemType ? itemLabel(itemType) : 'empty'}`)
                    .join(' · ')}
                </span>
              </div>
              <span className="backpack-held-label">Slots</span>
            </div>
          )}
          {groups.map((group) => {
            const label = itemLabel(group.itemType);
            const usable = isUsableItemType(group.itemType);
            return (
              <div key={group.key} className={`backpack-row ${usable ? 'backpack-row--usable' : ''}`}>
                <div className="backpack-row__icon" aria-hidden="true">
                  {label.slice(0, 1)}
                </div>
                <div className="backpack-row__main">
                  <strong>{label}</strong>
                  <span>
                    x{group.count}{group.slot ? ` · ${group.slot}` : ''}
                  </span>
                </div>
                <div className="backpack-row__actions">
                  {usable && (
                    <button
                      type="button"
                      className="backpack-use-btn"
                      onClick={() => onUseItem(group.firstItemId)}
                      aria-label={`Use ${label}`}
                    >
                      Use
                    </button>
                  )}
                  {group.slot !== 'protected' && (
                    <button
                      type="button"
                      className="backpack-protect-btn"
                      onClick={() => onProtect(group.firstItemId)}
                      aria-label={`Protect ${label}`}
                    >
                      Prot
                    </button>
                  )}
                  <button
                    type="button"
                    className="backpack-drop-btn"
                    onClick={() => onDrop(group.firstItemId)}
                    aria-label={`Drop ${label}`}
                  >
                    Drop
                  </button>
                </div>
              </div>
            );
          })}
        </div>
        <div className="backpack-sheet__note">
          Drop removes item from inventory. Prot marks item as protected (last survivor on death).
        </div>
      </div>
    </div>
  );
}
