import { useEffect, useRef } from 'react';
import type { AccountCharacterOutfitColors } from '@shared/http';
import {
  renderOutfitRecolorPreview,
  supportsOutfitRecolorPreview,
} from '../data/outfitRecolorEngine';

const PREVIEW_SCALE = 1.5;
const FRAME_SIZE = 64;
const CANVAS_SIZE = Math.round(FRAME_SIZE * PREVIEW_SCALE);

interface OutfitRecolorPreviewProps {
  outfitId: string;
  colors: AccountCharacterOutfitColors;
  spriteLabel: string;
  className?: string;
}

/** Tibia-style mask recolor preview for supported outfits. */
export function OutfitRecolorPreview({
  outfitId,
  colors,
  spriteLabel,
  className,
}: OutfitRecolorPreviewProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !supportsOutfitRecolorPreview(outfitId)) return;
    let cancelled = false;
    void renderOutfitRecolorPreview(canvas, outfitId, colors).then((ok) => {
      if (cancelled || ok || !canvasRef.current) return;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;
      ctx.fillStyle = '#2a2a4a';
      ctx.fillRect(0, 0, CANVAS_SIZE, CANVAS_SIZE);
      ctx.fillStyle = '#9d9a91';
      ctx.font = '11px "DM Sans", sans-serif';
      ctx.fillText('Recolor pending', 8, CANVAS_SIZE / 2);
    });
    return () => {
      cancelled = true;
    };
  }, [outfitId, colors.head, colors.body, colors.legs, colors.feet]);

  return (
    <div
      className={['character-sprite-preview', 'character-sprite-preview--recolor', className]
        .filter(Boolean)
        .join(' ')}
      data-testid="CharacterCreateScreen_Preview"
    >
      <canvas
        ref={canvasRef}
        width={CANVAS_SIZE}
        height={CANVAS_SIZE}
        className="character-sprite-preview__canvas"
        aria-hidden
      />
      <span className="character-sprite-preview__label" data-testid="CharacterCreateScreen_SpriteId">
        {spriteLabel} · recolor
      </span>
    </div>
  );
}