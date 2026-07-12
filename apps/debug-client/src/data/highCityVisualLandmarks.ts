import type { MapName } from '@shared/http';
import type { RegistryWorldVisualAssetId, RegistryWorldVisualPlacement } from './worldVisualRegistry';

function obj(assetId: RegistryWorldVisualAssetId, x: number, y: number, instance = 0, prefix = 'high-city'): RegistryWorldVisualPlacement {
  return { id: `${prefix}:${assetId}:${x}:${y}:${instance}`, assetId, x, y };
}

function row(assetId: RegistryWorldVisualAssetId, x1: number, x2: number, y: number, prefix = 'high-city'): RegistryWorldVisualPlacement[] {
  const out: RegistryWorldVisualPlacement[] = [];
  for (let x = x1; x <= x2; x += 1) out.push(obj(assetId, x, y, 0, prefix));
  return out;
}

function col(assetId: RegistryWorldVisualAssetId, x: number, y1: number, y2: number, prefix = 'high-city'): RegistryWorldVisualPlacement[] {
  const out: RegistryWorldVisualPlacement[] = [];
  for (let y = y1; y <= y2; y += 1) out.push(obj(assetId, x, y, 0, prefix));
  return out;
}

function floorPatch(assetId: RegistryWorldVisualAssetId, x1: number, y1: number, x2: number, y2: number, prefix = 'high-city'): RegistryWorldVisualPlacement[] {
  const out: RegistryWorldVisualPlacement[] = [];
  for (let y = y1; y <= y2; y += 1) {
    for (let x = x1; x <= x2; x += 1) out.push(obj(assetId, x, y, 0, prefix));
  }
  return out;
}

const ROOKGUARD_VISUAL_LANDMARKS: RegistryWorldVisualPlacement[] = [
  // Plaza and tutorial corridor. Display only; leave tutorial-code tiles
  // uncovered so their Classic-32 rune sprites remain visible.
  ...floorPatch('floor_cobble_01', 1, 1, 10, 1, 'rookguard'),
  ...row('floor_cobble_01', 1, 2, 2, 'rookguard'),
  obj('floor_cobble_01', 4, 2, 0, 'rookguard'),
  obj('floor_cobble_01', 6, 2, 0, 'rookguard'),
  ...row('floor_cobble_01', 8, 9, 2, 'rookguard'),
  ...floorPatch('floor_cobble_01', 1, 3, 10, 6, 'rookguard'),
  obj('notice_board', 9, 5, 0, 'rookguard'),
  obj('bench', 3, 5, 0, 'rookguard'),
  obj('banner_blue', 1, 5, 0, 'rookguard'),
  obj('rookguard_amber_lantern', 5, 6, 0, 'rookguard'),
  obj('rookguard_supply_sack', 6, 6, 0, 'rookguard'),
  obj('rookguard_waymarker', 7, 6, 0, 'rookguard'),
  obj('rookguard_fishing_post', 10, 6, 0, 'rookguard'),
  obj('rookguard_bait_crate', 9, 6, 0, 'rookguard'),
  obj('rookguard_canal_reeds', 11, 7, 0, 'rookguard'),

  // Guild/profession hall. The shared `guild_hall` landmark is the place
  // boundary; these sprites do not create doors, interiors, or access rules.
  ...floorPatch('floor_stone_01', 11, 1, 18, 6, 'rookguard'),
  ...row('wall_stone_north', 12, 18, 1, 'rookguard'),
  obj('door_wood_closed_south', 14, 5, 0, 'rookguard'),
  obj('weapon_rack', 13, 4, 0, 'rookguard'),
  obj('bookshelf', 17, 3, 0, 'rookguard'),
  obj('banner_red', 18, 2, 0, 'rookguard'),

  // Training yard around the existing Rookguard training mob. The slime pool is
  // a visual cue only; mob HP, attacks, drops, and respawns remain server state.
  ...floorPatch('floor_cobble_01', 12, 12, 17, 17, 'rookguard'),
  obj('slime_pool', 14, 14, 0, 'rookguard'),
  obj('weapon_rack', 12, 17, 1, 'rookguard'),

  // New district: Rookguard North Ward. Expanded layout for a second playable
  // district with landmark anchors and visual boundaries in static atlas output.
  ...floorPatch('floor_stone_01', 20, 18, 37, 35, 'rookguard'),
  obj('notice_board', 21, 20, 5, 'rookguard'),
  obj('bench', 24, 21, 5, 'rookguard'),
  obj('banner_blue', 22, 19, 5, 'rookguard'),
  obj('banner_red', 36, 19, 5, 'rookguard'),
  obj('wall_stone_corner_ne', 37, 18, 5, 'rookguard'),
  obj('wall_stone_corner_ne', 37, 35, 5, 'rookguard'),
];

const HIGH_CITY_VISUAL_LANDMARKS: RegistryWorldVisualPlacement[] = [
  // Arrival spine: a civic road from the Guild Hall down through the spawn
  // court toward Central Plaza. Display only; tile walkability is unchanged.
  ...floorPatch('high_city_cobble_var_02', 29, 18, 35, 48),
  ...floorPatch('high_city_cobble_var_03', 24, 30, 39, 35),
  ...floorPatch('floor_stone_01', 27, 29, 37, 35),
  obj('high_city_crystal_fountain', 32, 33),
  obj('high_city_witness_lantern', 28, 32),
  obj('high_city_sigil_banner_blue', 26, 32),
  obj('high_city_sigil_banner_red', 38, 32),
  obj('high_city_lantern_post', 32, 40),
  obj('high_city_lantern_post', 32, 44, 1),
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
  obj('high_city_plot_stake', 10, 34),
  obj('high_city_plot_stake', 14, 34, 1),
  obj('high_city_plot_stake', 18, 34, 2),
  obj('high_city_sigil_banner_blue', 8, 32, 1),
  obj('high_city_sigil_banner_red', 21, 32, 1),

  // Central Plaza: reinforce the existing stone plaza with a visible monument
  // and social furniture while leaving all plaza mechanics unchanged.
  ...floorPatch('floor_cobble_01', 24, 46, 39, 57),
  ...floorPatch('floor_stone_01', 26, 48, 37, 55),
  obj('high_city_crystal_fountain', 32, 53, 1),
  obj('stone_column', 28, 50),
  obj('stone_column', 36, 50),
  obj('high_city_sigil_banner_blue', 27, 52, 2),
  obj('high_city_sigil_banner_red', 37, 52, 2),
  obj('high_city_lantern_post', 30, 50, 2),
  obj('high_city_lantern_post', 34, 50, 3),
  obj('bench', 27, 56, 2),
  obj('bench', 36, 56, 3),
  obj('notice_board', 32, 49, 3),

  // Market Spine: display-only vendor silhouettes and awnings so the planned
  // market district reads as a place. Shop authority remains the server economy
  // endpoints; these stalls do not create prices, inventory, or interactions.
  ...floorPatch('floor_cobble_01', 42, 22, 55, 32),
  obj('market_food_stall', 44, 26),
  obj('market_cloth_stall', 49, 26),
  obj('market_food_stall', 54, 26, 1),
  obj('high_city_merchant_crate', 47, 28),
  obj('high_city_merchant_crate', 52, 28, 1),
  obj('market_awning_overlay', 44, 25),
  obj('market_awning_overlay', 49, 25, 1),
  obj('market_awning_overlay', 54, 25, 2),
  obj('bench', 46, 31, 4),
  obj('notice_board', 52, 31, 4),

  // Temple Steps: readable civic destination near the plaza. No healing,
  // respawn, tithe, or work-contract mechanics are attached to these visuals.
  ...floorPatch('floor_stone_01', 45, 42, 57, 50),
  ...row('wall_stone_north', 46, 56, 42),
  obj('wall_stone_corner_nw', 45, 42, 1),
  obj('wall_stone_corner_ne', 57, 42, 1),
  obj('stone_column', 47, 45, 1),
  obj('stone_column', 55, 45, 1),
  obj('high_city_sigil_banner_blue', 48, 47, 3),
  obj('high_city_sigil_banner_red', 54, 47, 3),
  obj('high_city_temple_brazier', 51, 49, 2),

  // Craft Quarter: workshop flavor for future equipment/spellcraft loops. The
  // racks and benches are visual only; crafting remains receipt-gated elsewhere.
  ...floorPatch('floor_wood_01', 5, 43, 18, 55),
  ...row('wall_stone_north', 6, 17, 43),
  obj('weapon_rack', 8, 48, 2),
  obj('weapon_rack', 15, 48, 3),
  obj('table_small', 11, 51),
  obj('chest_small', 17, 54),
  obj('bookshelf', 6, 46),
  obj('door_wood_closed_south', 12, 55, 1),
];

export function highCityVisualLandmarksForMap(mapName: MapName): RegistryWorldVisualPlacement[] {
  if (mapName === 'Azura') return HIGH_CITY_VISUAL_LANDMARKS;
  if (mapName === 'Rookguard') return ROOKGUARD_VISUAL_LANDMARKS;
  return [];
}
