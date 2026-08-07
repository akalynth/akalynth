import { useState } from 'react';
import { atlasPublicUrl } from '../lib/atlasPaths';
import { shortItemLabel } from '../data/inventoryPresentation';

interface ItemIconProps {
  itemType: string;
  label?: string;
  size?: number;
  className?: string;
}

/**
 * Display-only item icon — same atlas path Android uses (`sprites/item__{type}.png`).
 * Falls back to short label text if the PNG is missing.
 */
export function ItemIcon({ itemType, label, size = 28, className }: ItemIconProps) {
  const [failed, setFailed] = useState(false);
  const src = atlasPublicUrl(`sprites/item__${itemType}.png`);
  const text = label ?? shortItemLabel(itemType);

  if (failed || !itemType) {
    return (
      <span
        className={['item-icon', 'item-icon--fallback', className].filter(Boolean).join(' ')}
        style={{ width: size, height: size }}
        aria-hidden="true"
      >
        {text.slice(0, 3)}
      </span>
    );
  }

  return (
    <img
      className={['item-icon', className].filter(Boolean).join(' ')}
      src={src}
      alt=""
      width={size}
      height={size}
      draggable={false}
      onError={() => setFailed(true)}
      style={{ width: size, height: size, imageRendering: 'pixelated' }}
    />
  );
}
