import { TileCode } from '@shared/types';

export const TILE_VISUALS: Array<{ code: TileCode; label: string; color: string }> = [
  { code: TileCode.Grass, label: 'Grass', color: '#5d7a41' },
  { code: TileCode.Stone, label: 'Stone', color: '#8d8a80' },
  { code: TileCode.Wall, label: 'Wall', color: '#2c313a' },
  { code: TileCode.Water, label: 'Water', color: '#3f77a0' },
  { code: TileCode.Door, label: 'Door', color: '#9b7043' },
  { code: TileCode.TutorialMove, label: 'Tutorial move', color: '#6a8f44' },
  { code: TileCode.TutorialChat, label: 'Tutorial chat', color: '#5b9bd5' },
  { code: TileCode.TutorialTem, label: 'Tutorial tem', color: '#b07a8a' },
  { code: TileCode.GateToAzura, label: 'Gate', color: '#7644a8' },
];

export function tileColor(code: number): string {
  return TILE_VISUALS.find((t) => t.code === code)?.color ?? '#444';
}