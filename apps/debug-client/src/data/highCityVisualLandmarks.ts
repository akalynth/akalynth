import type { MapName } from '@shared/http';
import type { WorldVisualAssetId, WorldVisualObjectPlacement } from './worldVisualAssets';

function obj(assetId: WorldVisualAssetId, x: number, y: number, instance = 0): WorldVisualObjectPlacement {
  return { id: `high-city:${assetId}:${x}:${y}:${instance}`, assetId, x, y };
}

function row(assetId: WorldVisualAssetId, x1: number, x2: number, y: number): WorldVisualObjectPlacement[] {
  const out: WorldVisualObjectPlacement[] = [];
  for (let x = x1; x <= x2; x += 1) out.push(obj(assetId, x, y));
  return out;
}

function col(assetId: WorldVisualAssetId, x: number, y1: number, y2: number): WorldVisualObjectPlacement[] {
  const out: WorldVisualObjectPlacement[] = [];
  for (let y = y1; y <= y2; y += 1) out.push(obj(assetId, x, y));
  return out;
}

function floorPatch(assetId: WorldVisualAssetId, x1: number, y1: number, x2: number, y2: number): WorldVisualObjectPlacement[] {
  const out: WorldVisualObjectPlacement[] = [];
  for (let y = y1; y <= y2; y += 1) {
    for (let x = x1; x <= x2; x += 1) out.push(obj(assetId, x, y));
  }
  return out;
}

const HIGH_CITY_VISUAL_LANDMARKS: WorldVisualObjectPlacement[] = [
  // Arrival spine: a civic road from the Guild Hall down through the spawn
  // court toward Central Plaza. Display only; tile walkability is unchanged.
  ...floorPatch('floor_cobble_01', 29, 18, 35, 48),
  ...floorPatch('floor_cobble_01', 24, 30, 39, 35),
  ...floorPatch('floor_stone_01', 27, 29, 37, 35),
  obj('fountain', 32, 33),
  obj('notice_board', 28, 32),
  obj('banner_blue', 26, 32),
  obj('banner_red', 38, 32),
  obj('bench', 29, 36),
  obj('bench', 36, 36, 1),

  // Guild Hall facade: present as a visible civic landmark, not an enterable
  // interior. The shared guild_hall landmark remains the authority boundary.
  ...floorPatch('floor_stone_01', 14, 8, 25, 19),
  ...row('wall_stone_north', 15, 24, 8),
  ...col('stone_column', 14, 9, 18),
  ...col('stone_column', 25, 9, 18),
  obj('wall_stone_corner_nw', 14, 8),
  obj('wall_stone_corner_ne', 25, 8),
  obj('door_wood_closed_south', 20, 18),
  obj('banner_blue', 17, 11),
  obj('banner_red', 23, 11),
  obj('notice_board', 24, 18),

  // House plot lane: three marked addresses below the Guild Hall, with claim
  // markers only. This does not add houses, interiors, prices, or ownership.
  ...floorPatch('floor_cobble_01', 8, 30, 22, 35),
  ...floorPatch('floor_wood_01', 10, 32, 11, 33),
  ...floorPatch('floor_wood_01', 14, 32, 15, 33),
  ...floorPatch('floor_wood_01', 18, 32, 19, 33),
  obj('notice_board', 10, 34),
  obj('notice_board', 14, 34, 1),
  obj('notice_board', 18, 34, 2),
  obj('banner_blue', 8, 32, 1),
  obj('banner_red', 21, 32, 1),

  // Central Plaza: reinforce the existing stone plaza with a visible monument
  // and social furniture while leaving all plaza mechanics unchanged.
  ...floorPatch('floor_cobble_01', 24, 46, 39, 57),
  ...floorPatch('floor_stone_01', 26, 48, 37, 55),
  obj('fountain', 32, 53, 1),
  obj('stone_column', 28, 50),
  obj('stone_column', 36, 50),
  obj('banner_blue', 27, 52, 2),
  obj('banner_red', 37, 52, 2),
  obj('bench', 27, 56, 2),
  obj('bench', 36, 56, 3),
  obj('notice_board', 32, 49, 3),
];

export function highCityVisualLandmarksForMap(mapName: MapName): WorldVisualObjectPlacement[] {
  return mapName === 'Azura' ? HIGH_CITY_VISUAL_LANDMARKS : [];
}
