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
}

interface InventoryGroup {
  key: string;
  itemType: string;
  slot: string | null;
  count: number;
  firstItemId: string;
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

export function BackpackSheet({ open, inventory, onClose, onUseItem }: BackpackSheetProps) {
  if (!open) return null;
  const groups = groupedInventory(inventory);

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
                {usable ? (
                  <button
                    type="button"
                    className="backpack-use-btn"
                    onClick={() => onUseItem(group.firstItemId)}
                    aria-label={`Use ${label}`}
                  >
                    Use
                  </button>
                ) : (
                  <span className="backpack-held-label">Held</span>
                )}
              </div>
            );
          })}
        </div>
        <div className="backpack-sheet__note">
          Display only. Uses existing item intents where available.
        </div>
      </div>
    </div>
  );
}
