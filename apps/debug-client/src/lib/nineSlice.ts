/**
 * Canvas nine-slice blitter — mirrors Android UiTextures.drawNineSlice (PR-024).
 * Uses nearest-neighbor scaling; callers should set imageSmoothingEnabled = false.
 */

export interface NineSliceBlit {
  srcX: number;
  srcY: number;
  srcW: number;
  srcH: number;
  dstX: number;
  dstY: number;
  dstW: number;
  dstH: number;
}

function blit(
  ctx: CanvasRenderingContext2D,
  image: HTMLImageElement | HTMLCanvasElement,
  patch: NineSliceBlit,
): void {
  const { srcX, srcY, srcW, srcH, dstX, dstY, dstW, dstH } = patch;
  if (dstW <= 0 || dstH <= 0 || srcW <= 0 || srcH <= 0) return;
  ctx.drawImage(image, srcX, srcY, srcW, srcH, dstX, dstY, dstW, dstH);
}

/** Expand a source frame into destination width/height using symmetric slice insets. */
export function drawNineSlice(
  ctx: CanvasRenderingContext2D,
  image: HTMLImageElement | HTMLCanvasElement,
  slicePx: number,
  dstW: number,
  dstH: number,
): void {
  const iw = image.width;
  const ih = image.height;
  if (iw <= 0 || ih <= 0 || dstW <= 0 || dstH <= 0 || slicePx <= 0) return;

  const sl = slicePx;
  const st = slicePx;
  const sr = slicePx;
  const sb = slicePx;

  const leftW = sl * (dstW / iw);
  const rightW = sr * (dstW / iw);
  const topH = st * (dstH / ih);
  const bottomH = sb * (dstH / ih);
  const centerW = Math.max(0, dstW - leftW - rightW);
  const centerH = Math.max(0, dstH - topH - bottomH);

  const srcCenterW = Math.max(1, iw - sl - sr);
  const srcCenterH = Math.max(1, ih - st - sb);

  // corners
  blit(ctx, image, { srcX: 0, srcY: 0, srcW: sl, srcH: st, dstX: 0, dstY: 0, dstW: leftW, dstH: topH });
  blit(ctx, image, {
    srcX: iw - sr,
    srcY: 0,
    srcW: sr,
    srcH: st,
    dstX: dstW - rightW,
    dstY: 0,
    dstW: rightW,
    dstH: topH,
  });
  blit(ctx, image, {
    srcX: 0,
    srcY: ih - sb,
    srcW: sl,
    srcH: sb,
    dstX: 0,
    dstY: dstH - bottomH,
    dstW: leftW,
    dstH: bottomH,
  });
  blit(ctx, image, {
    srcX: iw - sr,
    srcY: ih - sb,
    srcW: sr,
    srcH: sb,
    dstX: dstW - rightW,
    dstY: dstH - bottomH,
    dstW: rightW,
    dstH: bottomH,
  });

  // edges
  blit(ctx, image, {
    srcX: sl,
    srcY: 0,
    srcW: srcCenterW,
    srcH: st,
    dstX: leftW,
    dstY: 0,
    dstW: centerW,
    dstH: topH,
  });
  blit(ctx, image, {
    srcX: sl,
    srcY: ih - sb,
    srcW: srcCenterW,
    srcH: sb,
    dstX: leftW,
    dstY: dstH - bottomH,
    dstW: centerW,
    dstH: bottomH,
  });
  blit(ctx, image, {
    srcX: 0,
    srcY: st,
    srcW: sl,
    srcH: srcCenterH,
    dstX: 0,
    dstY: topH,
    dstW: leftW,
    dstH: centerH,
  });
  blit(ctx, image, {
    srcX: iw - sr,
    srcY: st,
    srcW: sr,
    srcH: srcCenterH,
    dstX: dstW - rightW,
    dstY: topH,
    dstW: rightW,
    dstH: centerH,
  });

  // center
  blit(ctx, image, {
    srcX: sl,
    srcY: st,
    srcW: srcCenterW,
    srcH: srcCenterH,
    dstX: leftW,
    dstY: topH,
    dstW: centerW,
    dstH: centerH,
  });
}