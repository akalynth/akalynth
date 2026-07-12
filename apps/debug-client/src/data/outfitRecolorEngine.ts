import type { AccountCharacterOutfitColors } from '@shared/http';
import { outfitPaletteHex } from './outfitPalette';

const RECOLOR_OUTFIT_IDS = new Set(['male_guard', 'female_guard']);
const GUARD_ASSET_ROOT = 'outfits/guard_city_01';
const FRAME = 64;

const SLOT_MASKS: Array<{ key: keyof AccountCharacterOutfitColors; mask: string }> = [
  { key: 'head', mask: 'hair' },
  { key: 'body', mask: 'primary_cloth' },
  { key: 'legs', mask: 'secondary_cloth' },
  { key: 'feet', mask: 'boots' },
];

const imageCache = new Map<string, HTMLImageElement>();

function assetUrl(relativePath: string): string {
  const base = import.meta.env.BASE_URL ?? '/';
  const normalizedBase = base.endsWith('/') ? base : `${base}/`;
  return `${normalizedBase}${relativePath}`;
}

function hexToRgb(hex: string): [number, number, number] {
  const h = hex.replace('#', '');
  return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
}

function loadImage(src: string): Promise<HTMLImageElement> {
  const cached = imageCache.get(src);
  if (cached) return Promise.resolve(cached);
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      imageCache.set(src, img);
      resolve(img);
    };
    img.onerror = () => reject(new Error(`failed to load ${src}`));
    img.src = src;
  });
}

function getImageData(ctx: CanvasRenderingContext2D, img: HTMLImageElement, w: number, h: number): ImageData {
  ctx.clearRect(0, 0, w, h);
  ctx.drawImage(img, 0, 0, w, h);
  return ctx.getImageData(0, 0, w, h);
}

function applyMaskTint(
  data: Uint8ClampedArray,
  maskData: Uint8ClampedArray,
  w: number,
  h: number,
  tr: number,
  tg: number,
  tb: number,
): void {
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = (y * w + x) * 4;
      const ma = maskData[i + 3];
      if (ma < 24) continue;
      const mr = maskData[i];
      const mg = maskData[i + 1];
      const mb = maskData[i + 2];
      const maskLum = (mr + mg + mb) / (3 * 255);
      if (maskLum < 0.08 && ma < 128) continue;
      const r = data[i];
      const g = data[i + 1];
      const b = data[i + 2];
      const lum = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
      const shade = Math.max(0.15, Math.min(1, lum * 0.85 + maskLum * 0.35));
      const weight = Math.min(1, ma / 255);
      data[i] = Math.round(data[i] * (1 - weight) + tr * shade * weight);
      data[i + 1] = Math.round(data[i + 1] * (1 - weight) + tg * shade * weight);
      data[i + 2] = Math.round(data[i + 2] * (1 - weight) + tb * shade * weight);
    }
  }
}

export function supportsOutfitRecolorPreview(outfitId: string): boolean {
  return RECOLOR_OUTFIT_IDS.has(outfitId);
}

export async function renderGuardRecolorPreview(
  canvas: HTMLCanvasElement,
  colors: AccountCharacterOutfitColors,
): Promise<boolean> {
  const w = FRAME;
  const h = FRAME;
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  if (!ctx) return false;
  ctx.imageSmoothingEnabled = false;

  try {
    const base = await loadImage(assetUrl(`${GUARD_ASSET_ROOT}/native_64/guard_city_01_front.png`));
    const off = document.createElement('canvas');
    off.width = w;
    off.height = h;
    const octx = off.getContext('2d');
    if (!octx) return false;
    const data = getImageData(octx, base, w, h);

    for (const slot of SLOT_MASKS) {
      const maskPath = `${GUARD_ASSET_ROOT}/masks/front/${slot.mask}.png`;
      let maskImg: HTMLImageElement;
      try {
        maskImg = await loadImage(assetUrl(maskPath));
      } catch {
        continue;
      }
      const colorIdx = colors[slot.key];
      const [tr, tg, tb] = hexToRgb(outfitPaletteHex(colorIdx));
      octx.clearRect(0, 0, w, h);
      octx.drawImage(maskImg, 0, 0, w, h);
      const maskData = octx.getImageData(0, 0, w, h).data;
      applyMaskTint(data.data, maskData, w, h, tr, tg, tb);
    }

    octx.putImageData(data, 0, 0);
    ctx.clearRect(0, 0, w, h);
    ctx.drawImage(off, 0, 0);
    return true;
  } catch {
    return false;
  }
}

export function clearOutfitRecolorCache(): void {
  imageCache.clear();
}