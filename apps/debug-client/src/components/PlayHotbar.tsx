import {
  isUsableItemType,
  itemLabel,
  shortItemLabel,
  type InventoryItemRef,
} from '../data/inventoryPresentation';
import { ItemIcon } from './ItemIcon';

export const PLAY_HOTBAR_SLOT_COUNT = 4;

interface PlayHotbarProps {
  inventory: InventoryItemRef[];
  onUseItem: (itemId: string) => void;
  /** When false, render nothing (stage gate). */
  visible?: boolean;
  className?: string;
}

/**
 * Android-parity quick-item hotbar: 4 dark-iron slots, real icons, short captions.
 * Display-only projection of inventory — server remains item authority.
 */
export function PlayHotbar({
  inventory,
  onUseItem,
  visible = true,
  className,
}: PlayHotbarProps) {
  if (!visible) return null;

  const slots: Array<InventoryItemRef | null> = inventory.slice(0, PLAY_HOTBAR_SLOT_COUNT);
  while (slots.length < PLAY_HOTBAR_SLOT_COUNT) slots.push(null);

  return (
    <div
      className={['play-hotbar', className].filter(Boolean).join(' ')}
      role="toolbar"
      aria-label="Item hotbar"
      data-testid="PlayHotbar"
    >
      {slots.map((item, index) => {
        if (!item) {
          return (
            <div
              key={`empty-${index}`}
              className="play-hotbar__slot play-hotbar__slot--empty"
              data-testid={`PlayHotbar_Slot_${index}_Empty`}
              aria-label={`Empty slot ${index + 1}`}
            >
              <span className="play-hotbar__index">{index + 1}</span>
            </div>
          );
        }

        const usable = isUsableItemType(item.item_type);
        const label = itemLabel(item.item_type);
        const caption = shortItemLabel(item.item_type).slice(0, 6);
        const classNameSlot = [
          'play-hotbar__slot',
          usable ? 'play-hotbar__slot--usable' : '',
          item.slot === 'protected' ? 'play-hotbar__slot--protected' : '',
        ]
          .filter(Boolean)
          .join(' ');

        if (usable) {
          return (
            <button
              key={item.item_id}
              type="button"
              className={classNameSlot}
              title={`Use ${label}`}
              aria-label={`Use ${label}`}
              data-testid={`PlayHotbar_Slot_${index}`}
              onClick={() => onUseItem(item.item_id)}
            >
              <ItemIcon itemType={item.item_type} label={label} size={22} />
              <span className="play-hotbar__caption">{caption}</span>
            </button>
          );
        }

        return (
          <div
            key={item.item_id}
            className={classNameSlot}
            title={label}
            aria-label={label}
            role="img"
            data-testid={`PlayHotbar_Slot_${index}`}
          >
            <ItemIcon itemType={item.item_type} label={label} size={22} />
            <span className="play-hotbar__caption">{caption}</span>
          </div>
        );
      })}
    </div>
  );
}
