// Display-only Tibia-style palette (indices 0–63). Server validates indices;
// hex values mirror Studio outfits-catalog.js for picker swatches.
export const OUTFIT_PALETTE_SIZE = 64;

export const OUTFIT_PALETTE_HEX: readonly string[] = [
  '#ffffff', '#ffd4bf', '#deb887', '#c8a882', '#a08060', '#806040', '#604020', '#402010',
  '#ff6060', '#e03030', '#b01010', '#801010', '#ff9040', '#e07020', '#b05010', '#ffd040',
  '#e0b020', '#b08010', '#90d040', '#60b030', '#308020', '#206010', '#40c080', '#2080c0',
  '#1060a0', '#104080', '#2040a0', '#6060c0', '#8040c0', '#6020a0', '#402080', '#c060c0',
  '#e080c0', '#c04080', '#a02060', '#808080', '#606060', '#404040', '#202020', '#101010',
  '#c0c0c0', '#a0a0b0', '#8090a0', '#607080', '#d0b090', '#b09070', '#907050', '#705030',
  '#f0e8d8', '#e8d8c0', '#d8c8a8', '#c0a878', '#90c8e8', '#60a8d8', '#4088b8', '#286898',
  '#68d8a8', '#48b888', '#88e868', '#e8c848', '#d8a030', '#c87820', '#a85818', '#e5b75c',
];

export function outfitPaletteHex(index: number): string {
  if (!Number.isInteger(index) || index < 0 || index >= OUTFIT_PALETTE_SIZE) return '#808080';
  return OUTFIT_PALETTE_HEX[index] ?? '#808080';
}