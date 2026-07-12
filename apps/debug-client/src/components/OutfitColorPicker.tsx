import { useMemo, useState } from 'react';
import type { AccountCharacterOutfitColors, AccountCharacterOutfitEngineMeta } from '@shared/http';
import { outfitPaletteHex, OUTFIT_PALETTE_SIZE } from '../data/outfitPalette';

type ColorSlotKey = keyof AccountCharacterOutfitColors;

interface OutfitColorPickerProps {
  engine: AccountCharacterOutfitEngineMeta;
  value: AccountCharacterOutfitColors;
  onChange: (next: AccountCharacterOutfitColors) => void;
  disabled?: boolean;
}

export function OutfitColorPicker({ engine, value, onChange, disabled }: OutfitColorPickerProps) {
  const slots = engine.color_slots;
  const [activeSlot, setActiveSlot] = useState<ColorSlotKey>(slots[0]?.key ?? 'head');

  const activeIndex = value[activeSlot];
  const swatchRows = useMemo(() => {
    const rows: number[][] = [];
    for (let i = 0; i < OUTFIT_PALETTE_SIZE; i += 8) {
      rows.push(Array.from({ length: 8 }, (_, j) => i + j));
    }
    return rows;
  }, []);

  return (
    <div className="outfit-color-picker" aria-label="outfit colors">
      <span className="outfit-color-picker__kicker">Outfit colors</span>
      <div className="outfit-color-picker__slots" role="tablist" aria-label="color slots">
        {slots.map((slot: { key: ColorSlotKey; label: string }) => {
          const index = value[slot.key];
          const selected = slot.key === activeSlot;
          return (
            <button
              key={slot.key}
              type="button"
              role="tab"
              aria-selected={selected}
              className={`outfit-color-picker__slot${selected ? ' outfit-color-picker__slot--active' : ''}`}
              disabled={disabled}
              onClick={() => setActiveSlot(slot.key)}
            >
              <span
                className="outfit-color-picker__slot-swatch"
                style={{ backgroundColor: outfitPaletteHex(index) }}
                aria-hidden
              />
              <span className="outfit-color-picker__slot-label">{slot.label}</span>
              <span className="outfit-color-picker__slot-index">{index}</span>
            </button>
          );
        })}
      </div>
      <div className="outfit-color-picker__grid" role="tabpanel" aria-label={`${activeSlot} palette`}>
        {swatchRows.map((row) => (
          <div key={row[0]} className="outfit-color-picker__row">
            {row.map((index) => {
              const selected = index === activeIndex;
              return (
                <button
                  key={index}
                  type="button"
                  className={`outfit-color-picker__swatch${selected ? ' outfit-color-picker__swatch--active' : ''}`}
                  style={{ backgroundColor: outfitPaletteHex(index) }}
                  disabled={disabled}
                  aria-label={`color ${index}`}
                  aria-pressed={selected}
                  onClick={() => onChange({ ...value, [activeSlot as string]: index } as any)}
                />
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}