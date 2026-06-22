import { TileCode } from '@shared/types';
import grassTile from '../../../../data/assets-src/sprites/tile__grass.png?url';
import stoneTile from '../../../../data/assets-src/sprites/tile__stone_ground.png?url';
import tutorialChatTile from '../../../../data/assets-src/sprites/tile__tutorial_chat.png?url';
import gateToAzuraTile from '../../../../data/assets-src/sprites/tile__gate_to_azura.png?url';
import tutorialMoveTile from '../../../../data/assets-src/sprites/tile__tutorial_move.png?url';
import tutorialTemTile from '../../../../data/assets-src/sprites/tile__tutorial_tem.png?url';
import waterTile from '../../../../data/assets-src/sprites/tile__water.png?url';
import wallTile from '../../../../data/assets-src/sprites/structures__stone_wall.png?url';
import { useImagePreloader } from './useImagePreloader';

function publicAsset(path: string): string {
  return `${import.meta.env.BASE_URL}${path.replace(/^\/+/, '')}`;
}

// Canonical Classic-32 tiles from data/assets-src/sprites/. Display-only; server
// tile codes remain authority for walkability.
const TILE_SPRITE_SRC: Partial<Record<TileCode, string>> = {
  [TileCode.Grass]: grassTile,
  [TileCode.Stone]: stoneTile,
  [TileCode.Wall]: wallTile,
  [TileCode.Water]: waterTile,
  [TileCode.Door]: publicAsset('tiles/structures__door.png'),
  [TileCode.TutorialMove]: tutorialMoveTile,
  [TileCode.TutorialChat]: tutorialChatTile,
  [TileCode.TutorialTem]: tutorialTemTile,
  [TileCode.GateToAzura]: gateToAzuraTile,
};

const TILE_SPRITE_ENTRIES = Object.entries(TILE_SPRITE_SRC).map(([code, src]) => ({
  key: Number(code),
  src: src as string,
}));

export function useTileSprites(): { images: Map<number, HTMLImageElement>; ready: number } {
  return useImagePreloader<number>(TILE_SPRITE_ENTRIES);
}
