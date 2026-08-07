import { identityLabel } from '../data/outfitIdentity';

interface IdentityStripProps {
  name?: string | null;
  outfitId?: string | null;
  spriteId?: string | null;
  className?: string;
}

/**
 * Minimal play-surface identity: name + outfit/sprite label.
 * Outfit pickers must not live here — create / character sheet only.
 */
export function IdentityStrip({ name, outfitId, spriteId, className = '' }: IdentityStripProps) {
  const label = identityLabel({ name, outfitId, spriteId });
  return (
    <div
      className={`identity-strip ${className}`.trim()}
      role="status"
      aria-label="Character identity"
      data-ui="identity-strip"
    >
      <span className="identity-strip__kicker">You</span>
      <strong className="identity-strip__label">{label}</strong>
    </div>
  );
}
