import { useEffect, useState } from 'react';
import {
  chronicleGlyphExportLabel,
  chronicleGlyphKindFromEvent,
  chronicleGlyphUrl,
  type ChronicleGlyphKind,
} from '../chronicle/chronicleGlyphs';

interface ChronicleGlyphIconProps {
  eventKind: string;
  size?: number;
  className?: string;
  testId?: string;
}

/** 24×24 chronicle glyph with ASCII fallback (PR-026). */
export function ChronicleGlyphIcon({
  eventKind,
  size = 24,
  className,
  testId,
}: ChronicleGlyphIconProps) {
  const glyphKind = chronicleGlyphKindFromEvent(eventKind);
  return (
    <GlyphImage
      kind={glyphKind}
      size={size}
      className={className}
      testId={testId ?? `ChronicleGlyph_${glyphKind}`}
    />
  );
}

function GlyphImage({
  kind,
  size,
  className,
  testId,
}: {
  kind: ChronicleGlyphKind;
  size: number;
  className?: string;
  testId: string;
}) {
  const [failed, setFailed] = useState(false);
  const src = chronicleGlyphUrl(kind);

  useEffect(() => {
    setFailed(false);
  }, [src]);

  if (failed) {
    return (
      <span
        className={['chronicle-glyph-fallback', className].filter(Boolean).join(' ')}
        data-testid={testId}
        style={{ width: size, height: size, fontSize: size * 0.45 }}
      >
        {chronicleGlyphExportLabel(kind)}
      </span>
    );
  }

  return (
    <img
      src={src}
      alt=""
      width={size}
      height={size}
      className={['chronicle-glyph', className].filter(Boolean).join(' ')}
      data-testid={testId}
      style={{ imageRendering: 'pixelated' }}
      onError={() => setFailed(true)}
    />
  );
}