import { CHARACTER_SPRITES, type CharacterSpriteId } from '../data/characterSprites';
import { useImagePreloader } from './useImagePreloader';

const CHARACTER_SPRITE_ENTRIES = Object.values(CHARACTER_SPRITES).map((def) => ({
  key: def.id,
  src: def.src,
}));

export function useCharacterSprites(): { images: Map<CharacterSpriteId, HTMLImageElement>; ready: number } {
  return useImagePreloader<CharacterSpriteId>(CHARACTER_SPRITE_ENTRIES);
}
