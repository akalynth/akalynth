import type { WorldVisualAssetId, WorldVisualVisibility } from './worldVisualAssets';

export type TilePoint = {
  x: number;
  y: number;
};

export type ReviewRect = {
  x: number;
  y: number;
  width: number;
  height: number;
};

export type OverlayVisibility = WorldVisualVisibility;

export type BuildingOverlayReviewFixture = {
  id: string;
  buildingId: string;
  /** Debug-client review only. Not collision, walkability, server house bounds, or ownership. */
  interiorFootprint: ReviewRect;
  /** Debug-client review only. Not a door permission model. */
  doorwayTiles: TilePoint[];
  overlays: Array<{
    id: string;
    assetId: WorldVisualAssetId;
    anchorTile: TilePoint;
    layer: 'floor_overlay';
    visibilityModes: OverlayVisibility[];
  }>;
  reviewPositions: {
    outside: TilePoint;
    doorway: TilePoint;
    inside: TilePoint;
  };
};

export function sameTile(a: TilePoint, b: TilePoint): boolean {
  return a.x === b.x && a.y === b.y;
}

export function containsTile(rect: ReviewRect, tile: TilePoint): boolean {
  return (
    tile.x >= rect.x &&
    tile.x < rect.x + rect.width &&
    tile.y >= rect.y &&
    tile.y < rect.y + rect.height
  );
}

export function overlayVisibilityForReview(
  playerTile: TilePoint,
  buildingInterior: ReviewRect,
  doorwayTiles: TilePoint[],
): OverlayVisibility {
  if (doorwayTiles.some((doorwayTile) => sameTile(doorwayTile, playerTile))) {
    return 'faded';
  }
  return containsTile(buildingInterior, playerTile) ? 'hidden' : 'visible';
}

export const BUILDING_OVERLAY_REVIEW_FIXTURES: Record<string, BuildingOverlayReviewFixture> = {
  small_house_01: {
    id: 'small_house_01_overlay_visibility_review',
    buildingId: 'small_house_01',
    interiorFootprint: { x: 7, y: 9, width: 7, height: 4 },
    doorwayTiles: [{ x: 10, y: 13 }, { x: 10, y: 14 }],
    overlays: [{
      id: 'small_house_roof_overlay',
      assetId: 'roof_red_small_overlay',
      anchorTile: { x: 6, y: 7 },
      layer: 'floor_overlay',
      visibilityModes: ['visible', 'faded', 'hidden'],
    }],
    reviewPositions: {
      outside: { x: 10, y: 15 },
      doorway: { x: 10, y: 14 },
      inside: { x: 10, y: 12 },
    },
  },
  market_shop_01: {
    id: 'market_shop_01_overlay_visibility_review',
    buildingId: 'market_shop_01',
    interiorFootprint: { x: 6, y: 8, width: 12, height: 6 },
    doorwayTiles: [{ x: 11, y: 14 }, { x: 11, y: 15 }],
    overlays: [{
      id: 'market_shop_awning_overlay',
      assetId: 'market_awning_overlay',
      anchorTile: { x: 6, y: 7 },
      layer: 'floor_overlay',
      visibilityModes: ['visible', 'faded', 'hidden'],
    }],
    reviewPositions: {
      // One row below the lowest doorway tile (y:15) so 'outside' is genuinely
      // outside the door, not on it (which would classify as 'faded').
      outside: { x: 11, y: 16 },
      doorway: { x: 11, y: 14 },
      inside: { x: 11, y: 12 },
    },
  },
  castle_meeting_hall_01: {
    id: 'castle_meeting_hall_01_overlay_visibility_review',
    buildingId: 'castle_meeting_hall_01',
    interiorFootprint: { x: 5, y: 7, width: 14, height: 8 },
    doorwayTiles: [{ x: 11, y: 15 }, { x: 11, y: 16 }],
    overlays: [{
      id: 'castle_hall_roof_overlay',
      assetId: 'roof_castle_overlay',
      anchorTile: { x: 4, y: 6 },
      layer: 'floor_overlay',
      visibilityModes: ['visible', 'faded', 'hidden'],
    }],
    reviewPositions: {
      // One row below the lowest doorway tile (y:16) so 'outside' is not on a door tile.
      outside: { x: 11, y: 17 },
      doorway: { x: 11, y: 15 },
      inside: { x: 12, y: 12 },
    },
  },
};
