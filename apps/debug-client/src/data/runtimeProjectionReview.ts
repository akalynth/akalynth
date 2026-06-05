import type { MapDebugOverlay } from '../components/MapCanvas';

import projection from '../../../../docs/asset-decisions/AKALYNTH_HIGH_CITY_RUNTIME_MAP_PROJECTION_CANDIDATE_V1/projection/high_city_runtime_map_projection.v1.draft.json';
import collisionCandidates from '../../../../docs/asset-decisions/AKALYNTH_COLLISION_WALKABILITY_FIXTURE_CANDIDATE_V1/candidates/refined_high_city_collision_candidates.v1.draft.json';
import walkabilityCandidates from '../../../../docs/asset-decisions/AKALYNTH_COLLISION_WALKABILITY_FIXTURE_CANDIDATE_V1/candidates/refined_high_city_walkability_candidates.v1.draft.json';
import doorCandidates from '../../../../docs/asset-decisions/AKALYNTH_DOOR_HOUSE_AUTHORITY_FIXTURE_CANDIDATE_V1/candidates/refined_high_city_door_candidates.v1.draft.json';
import houseCandidates from '../../../../docs/asset-decisions/AKALYNTH_DOOR_HOUSE_AUTHORITY_FIXTURE_CANDIDATE_V1/candidates/refined_high_city_house_candidates.v1.draft.json';
import transitionCandidates from '../../../../docs/asset-decisions/AKALYNTH_TRANSITION_AUTHORITY_FIXTURE_CANDIDATE_V1/candidates/refined_high_city_transition_candidates.v1.draft.json';
import overlayZones from '../../../../docs/asset-decisions/AKALYNTH_VISUAL_MAP_OBJECT_FIXTURE_EXPORT_V1/exports/refined_high_city_overlay_zones.v1.draft.json';

type Tile = readonly [number, number];
type Rect = { x: number; y: number; width: number; height: number };

export const RUNTIME_PROJECTION_SMOKE_SCENARIOS = [
  'runtime_projection_overview',
  'runtime_projection_collision_walkability',
  'runtime_projection_door_house',
  'runtime_projection_transitions',
  'runtime_projection_overlay_visibility',
  'runtime_projection_combined_review',
] as const;

export type RuntimeProjectionSmokeScenario = typeof RUNTIME_PROJECTION_SMOKE_SCENARIOS[number];

type RuntimeProjectionRefinedScenario =
  | 'high_city_refined_overview'
  | 'high_city_refined_gate_to_plaza'
  | 'high_city_refined_market_lane'
  | 'high_city_refined_house_block'
  | 'high_city_refined_castle_meeting'
  | 'high_city_refined_sewer_hint';

export function runtimeProjectionRefinedScenarioFor(scenario: RuntimeProjectionSmokeScenario): RuntimeProjectionRefinedScenario {
  switch (scenario) {
    case 'runtime_projection_collision_walkability':
      return 'high_city_refined_gate_to_plaza';
    case 'runtime_projection_door_house':
      return 'high_city_refined_house_block';
    case 'runtime_projection_transitions':
      return 'high_city_refined_sewer_hint';
    case 'runtime_projection_overlay_visibility':
      return 'high_city_refined_castle_meeting';
    case 'runtime_projection_combined_review':
    case 'runtime_projection_overview':
    default:
      return 'high_city_refined_overview';
  }
}

function tile(id: string, [x, y]: Tile, fill: string, stroke: string, label?: string): MapDebugOverlay {
  return { id, x, y, fill, stroke, label };
}

function rect(id: string, bounds: Rect, fill: string, stroke: string, label?: string): MapDebugOverlay {
  return { id, x: bounds.x, y: bounds.y, width: bounds.width, height: bounds.height, fill, stroke, label };
}

function collisionWalkabilityOverlays(): MapDebugOverlay[] {
  const overlays: MapDebugOverlay[] = [];
  for (const cell of collisionCandidates.cells) {
    const state = cell.collision_state;
    const fill = state === 'blocked' ? 'rgba(239, 68, 68, 0.32)' : state === 'clear' ? 'rgba(34, 197, 94, 0.22)' : 'rgba(250, 204, 21, 0.34)';
    const stroke = state === 'blocked' ? '#ef4444' : state === 'clear' ? '#22c55e' : '#facc15';
    overlays.push(tile('projection-collision:' + cell.tile.join(','), cell.tile as unknown as Tile, fill, stroke));
  }
  for (const cell of walkabilityCandidates.cells) {
    const state = cell.walkability_state;
    const fill = state === 'walkable' ? 'rgba(59, 130, 246, 0.18)' : state === 'not_walkable' ? 'rgba(244, 63, 94, 0.18)' : 'rgba(250, 204, 21, 0.20)';
    const stroke = state === 'walkable' ? '#60a5fa' : state === 'not_walkable' ? '#fb7185' : '#facc15';
    overlays.push(tile('projection-walkability:' + cell.tile.join(','), cell.tile as unknown as Tile, fill, stroke));
  }
  return overlays;
}

function doorHouseOverlays(): MapDebugOverlay[] {
  const overlays: MapDebugOverlay[] = [];
  for (const candidate of houseCandidates.candidates) {
    overlays.push(rect(
      'projection-house:' + candidate.id,
      candidate.interior_candidate_bounds,
      'rgba(14, 165, 233, 0.14)',
      '#38bdf8',
      'house',
    ));
  }
  for (const candidate of doorCandidates.candidates) {
    for (const t of candidate.threshold_tiles) {
      overlays.push(tile('projection-door:' + candidate.id + ':' + t.join(','), t as unknown as Tile, 'rgba(250, 204, 21, 0.36)', '#fde047', 'door'));
    }
  }
  return overlays;
}

function transitionOverlays(): MapDebugOverlay[] {
  const overlays: MapDebugOverlay[] = [];
  for (const candidate of transitionCandidates.candidates) {
    for (const t of candidate.source_tiles) {
      overlays.push(tile('projection-transition:' + candidate.id + ':' + t.join(','), t as unknown as Tile, 'rgba(217, 70, 239, 0.34)', '#e879f9', 'transition'));
    }
  }
  return overlays;
}

function overlayPresentationOverlays(): MapDebugOverlay[] {
  const overlays: MapDebugOverlay[] = [];
  for (const zone of overlayZones.overlay_zones) {
    overlays.push(rect(
      'projection-overlay-zone:' + zone.id,
      zone.review_only_context.interior_footprint,
      'rgba(168, 85, 247, 0.12)',
      '#c084fc',
      'overlay',
    ));
    for (const t of zone.review_only_context.doorway_tiles) {
      overlays.push(tile('projection-overlay-doorway:' + zone.id + ':' + t.join(','), t as unknown as Tile, 'rgba(45, 212, 191, 0.30)', '#5eead4'));
    }
  }
  return overlays;
}

export function runtimeProjectionDebugOverlaysForScenario(scenario: RuntimeProjectionSmokeScenario): MapDebugOverlay[] {
  if (scenario === 'runtime_projection_collision_walkability') return collisionWalkabilityOverlays();
  if (scenario === 'runtime_projection_door_house') return doorHouseOverlays();
  if (scenario === 'runtime_projection_transitions') return transitionOverlays();
  if (scenario === 'runtime_projection_overlay_visibility') return overlayPresentationOverlays();
  if (scenario === 'runtime_projection_combined_review') {
    return [
      ...collisionWalkabilityOverlays(),
      ...doorHouseOverlays(),
      ...transitionOverlays(),
      ...overlayPresentationOverlays(),
    ];
  }
  return [
    rect('projection-bounds:visual', projection.bounds.visual_fixture, 'rgba(255, 255, 255, 0.04)', 'rgba(255, 255, 255, 0.35)', 'projection'),
  ];
}

export const runtimeProjectionConsumerSummary = {
  projectionId: projection.id,
  status: projection.status,
  runtimeAuthority: projection.runtime_authority,
  serverAuthoritative: projection.server_authoritative,
  productionMapPromoted: projection.production_map_promoted,
  sharedMapPath: projection.shared_map_path,
  counts: {
    visualObjects: projection.layers.visual_object_layer.source_count,
    overlayZones: projection.layers.overlay_presentation_layer.source_count,
    collisionCells: projection.layers.collision_layer.source_count,
    walkabilityCells: projection.layers.walkability_layer.source_count,
    doorCandidates: projection.layers.door_house_layer.source_counts.door_candidates,
    houseCandidates: projection.layers.door_house_layer.source_counts.house_candidates,
    transitionCandidates: projection.layers.transition_layer.source_counts.transition_candidates,
  },
  candidateCounts: {
    overlayZones: overlayZones.overlay_zones.length,
    collisionCells: collisionCandidates.cells.length,
    walkabilityCells: walkabilityCandidates.cells.length,
    doorCandidates: doorCandidates.candidates.length,
    houseCandidates: houseCandidates.candidates.length,
    transitionCandidates: transitionCandidates.candidates.length,
  },
  mechanics: projection.mechanics,
} as const;

export function runtimeProjectionConsumerCountsMatch(): boolean {
  return runtimeProjectionConsumerSummary.counts.overlayZones === runtimeProjectionConsumerSummary.candidateCounts.overlayZones &&
    runtimeProjectionConsumerSummary.counts.collisionCells === runtimeProjectionConsumerSummary.candidateCounts.collisionCells &&
    runtimeProjectionConsumerSummary.counts.walkabilityCells === runtimeProjectionConsumerSummary.candidateCounts.walkabilityCells &&
    runtimeProjectionConsumerSummary.counts.doorCandidates === runtimeProjectionConsumerSummary.candidateCounts.doorCandidates &&
    runtimeProjectionConsumerSummary.counts.houseCandidates === runtimeProjectionConsumerSummary.candidateCounts.houseCandidates &&
    runtimeProjectionConsumerSummary.counts.transitionCandidates === runtimeProjectionConsumerSummary.candidateCounts.transitionCandidates;
}
