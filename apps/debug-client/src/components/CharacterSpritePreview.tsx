import { useEffect, useRef } from 'react';
import {
  DIRECTION_ROW,
  FEET_ANCHOR,
  FRAME_SIZE,
  type CharacterSpriteId,
} from '../data/characterSprites';
import { useCharacterSprites } from '../hooks/useCharacterSprites';

const PREVIEW_SCALE = 1.5;
const CANVAS_SIZE = Math.round(FRAME_SIZE * PREVIEW_SCALE);

interface CharacterSpritePreviewProps {
  spriteId: CharacterSpriteId;
  spriteLabel: string;
  className?: string;
}

/** South-facing character sheet preview for create form (PR-025). */
export function CharacterSpritePreview({
  spriteId,
  spriteLabel,
  className,
}: CharacterSpritePreviewProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const { images, ready } = useCharacterSprites();

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.clearRect(0, 0, CANVAS_SIZE, CANVAS_SIZE);
    const image = images.get(spriteId);
    if (!image) {
      ctx.fillStyle = '#2a2a4a';
      ctx.fillRect(0, 0, CANVAS_SIZE, CANVAS_SIZE);
      ctx.fillStyle = '#9d9a91';
      ctx.font = '11px "DM Sans", sans-serif';
      ctx.fillText('Loading…', 12, CANVAS_SIZE / 2);
      return;
    }

    const feetX = CANVAS_SIZE / 2;
    const feetY = CANVAS_SIZE - 8;
    const dx = Math.round(feetX - FEET_ANCHOR.x * PREVIEW_SCALE);
    const dy = Math.round(feetY - FEET_ANCHOR.y * PREVIEW_SCALE);

    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(
      image,
      0,
      DIRECTION_ROW.south * FRAME_SIZE,
      FRAME_SIZE,
      FRAME_SIZE,
      dx,
      dy,
      FRAME_SIZE * PREVIEW_SCALE,
      FRAME_SIZE * PREVIEW_SCALE,
    );
  }, [images, ready, spriteId]);

  return (
    <div
      className={['character-sprite-preview', className].filter(Boolean).join(' ')}
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
        {spriteLabel}
      </span>
    </div>
  );
}