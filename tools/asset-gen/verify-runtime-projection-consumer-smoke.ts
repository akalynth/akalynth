import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import * as path from 'node:path';

type Json = Record<string, any>;

const REPO_ROOT = fileURLToPath(new URL('../../', import.meta.url));
const GATE_ROOT = path.join(REPO_ROOT, 'docs/asset-decisions/AKALYNTH_RUNTIME_MAP_PROJECTION_CONSUMER_SMOKE_TEST_V1');
const WRITE_REPORT = process.argv.includes('--write-report');

function readJson(relPath: string): Json {
  return JSON.parse(readFileSync(path.join(REPO_ROOT, relPath), 'utf8'));
}

function sha256(abs: string): string {
  return createHash('sha256').update(readFileSync(abs)).digest('hex');
}

function hasPngHeader(abs: string): boolean {
  const header = readFileSync(abs).subarray(0, 8);
  return header.equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]));
}

function flagsForPayload(payload: Json): string[] {
  const flags: string[] = [];
  for (const key of [
    'production_map_loaded',
    'runtime_authority',
    'runtime_collision_active',
    'runtime_walkability_active',
    'runtime_doors_active',
    'runtime_houses_active',
    'runtime_transitions_active',
    'npc_behavior',
    'mob_behavior',
    'shop',
    'dialogue',
    'spawn',
    'ai',
    'combat',
  ]) {
    // Presence, not truthiness: a forbidden field is a boundary leak even when
    // set to a falsy value (0 / "" / false), matching the strict !== false
    // boundary checks used for the real projection.
    if (Object.prototype.hasOwnProperty.call(payload, key)) flags.push(`consumer_forbidden_field:${key}`);
  }
  if (payload.shared_map_path && payload.shared_map_path !== 'none') flags.push('consumer_forbidden_field:shared_map_path');
  return [...new Set(flags)];
}

function run() {
  const projection = readJson('docs/asset-decisions/AKALYNTH_HIGH_CITY_RUNTIME_MAP_PROJECTION_CANDIDATE_V1/projection/high_city_runtime_map_projection.v1.draft.json');
  const collision = readJson('docs/asset-decisions/AKALYNTH_COLLISION_WALKABILITY_FIXTURE_CANDIDATE_V1/candidates/refined_high_city_collision_candidates.v1.draft.json');
  const walkability = readJson('docs/asset-decisions/AKALYNTH_COLLISION_WALKABILITY_FIXTURE_CANDIDATE_V1/candidates/refined_high_city_walkability_candidates.v1.draft.json');
  const doors = readJson('docs/asset-decisions/AKALYNTH_DOOR_HOUSE_AUTHORITY_FIXTURE_CANDIDATE_V1/candidates/refined_high_city_door_candidates.v1.draft.json');
  const houses = readJson('docs/asset-decisions/AKALYNTH_DOOR_HOUSE_AUTHORITY_FIXTURE_CANDIDATE_V1/candidates/refined_high_city_house_candidates.v1.draft.json');
  const transitions = readJson('docs/asset-decisions/AKALYNTH_TRANSITION_AUTHORITY_FIXTURE_CANDIDATE_V1/candidates/refined_high_city_transition_candidates.v1.draft.json');
  const overlays = readJson('docs/asset-decisions/AKALYNTH_VISUAL_MAP_OBJECT_FIXTURE_EXPORT_V1/exports/refined_high_city_overlay_zones.v1.draft.json');
  const negativeCases = readJson('docs/asset-decisions/AKALYNTH_RUNTIME_MAP_PROJECTION_CONSUMER_SMOKE_TEST_V1/validation/negative_projection_consumer_cases.json').cases as Json[];
  const smokeSource = readFileSync(path.join(REPO_ROOT, 'apps/debug-client/src/components/VisualSmokeReview.tsx'), 'utf8');
  const mapCanvasSource = readFileSync(path.join(REPO_ROOT, 'apps/debug-client/src/components/MapCanvas.tsx'), 'utf8');
  const reviewDataSource = readFileSync(path.join(REPO_ROOT, 'apps/debug-client/src/data/runtimeProjectionReview.ts'), 'utf8');
  const routes = [
    'runtime_projection_overview',
    'runtime_projection_collision_walkability',
    'runtime_projection_door_house',
    'runtime_projection_transitions',
    'runtime_projection_overlay_visibility',
    'runtime_projection_combined_review',
  ];
  const routeResults = routes.map((route) => ({ route, present: smokeSource.includes(route) && reviewDataSource.includes(route) }));
  const countChecks = {
    overlay_zones_match: projection.layers.overlay_presentation_layer.source_count === overlays.overlay_zones.length,
    collision_cells_match: projection.layers.collision_layer.source_count === collision.cells.length,
    walkability_cells_match: projection.layers.walkability_layer.source_count === walkability.cells.length,
    door_candidates_match: projection.layers.door_house_layer.source_counts.door_candidates === doors.candidates.length,
    house_candidates_match: projection.layers.door_house_layer.source_counts.house_candidates === houses.candidates.length,
    transition_candidates_match: projection.layers.transition_layer.source_counts.transition_candidates === transitions.candidates.length,
  };
  const negativeResults = negativeCases.map((test) => {
    const observed = flagsForPayload(test.payload);
    const expected = test.expected_flags as string[];
    return { id: test.id, expected_flags: expected, observed_flags: observed, result: expected.every((flag) => observed.includes(flag)) ? 'flagged' : 'missed' };
  });
  const screenshots = [
    'screenshots/01_projection_consumer_overview.png',
    'screenshots/02_projection_consumer_collision_walkability.png',
    'screenshots/03_projection_consumer_door_house.png',
    'screenshots/04_projection_consumer_transitions.png',
    'screenshots/05_projection_consumer_overlay_visibility.png',
    'screenshots/06_projection_consumer_combined_review.png',
  ].map((file) => {
    const abs = path.join(GATE_ROOT, file);
    return { file, exists: existsSync(abs), bytes: existsSync(abs) ? readFileSync(abs).length : 0, png: existsSync(abs) ? hasPngHeader(abs) : false, sha256: existsSync(abs) ? sha256(abs) : null };
  });
  const boundaryFlags: string[] = [];
  if (projection.runtime_authority !== false) boundaryFlags.push('projection_runtime_authority_not_false');
  if (projection.server_authoritative !== false) boundaryFlags.push('projection_server_authoritative_not_false');
  if (projection.production_map_promoted !== false) boundaryFlags.push('projection_production_map_promoted_not_false');
  if (projection.shared_map_path !== 'none') boundaryFlags.push('projection_shared_map_path_not_none');
  if (projection.mechanics !== null) boundaryFlags.push('projection_mechanics_not_null');
  const report = {
    id: 'AKALYNTH_RUNTIME_MAP_PROJECTION_CONSUMER_SMOKE_TEST_V1_REPORT',
    status: routeResults.every((r) => r.present) && Object.values(countChecks).every(Boolean) && mapCanvasSource.includes('debugOverlays') && reviewDataSource.includes('projection/high_city_runtime_map_projection.v1.draft.json') && negativeResults.every((r) => r.result === 'flagged') && screenshots.every((s) => s.exists && s.png && s.bytes > 1000) && boundaryFlags.length === 0 ? 'pass' : 'fail',
    generated_by: 'tools/asset-gen/verify-runtime-projection-consumer-smoke.ts',
    checks: {
      projection_consumer_routes_present: routeResults.every((r) => r.present) ? 'pass' : 'fail',
      projection_artifact_imported_by_debug_client: reviewDataSource.includes('projection/high_city_runtime_map_projection.v1.draft.json') ? 'pass' : 'fail',
      projection_counts_match_candidate_sources: Object.values(countChecks).every(Boolean) ? 'pass' : 'fail',
      debug_overlay_renderer_present: mapCanvasSource.includes('debugOverlays') ? 'pass' : 'fail',
      negative_projection_consumer_cases_flagged: negativeResults.every((r) => r.result === 'flagged') ? 'pass' : 'fail',
      screenshots_exist_and_are_nonblank_pngs: screenshots.every((s) => s.exists && s.png && s.bytes > 1000) ? 'pass' : 'fail',
      boundary_flags_zero: boundaryFlags.length === 0 ? 'pass' : 'fail'
    },
    route_results: routeResults,
    count_checks: countChecks,
    negative_results: negativeResults,
    screenshot_results: screenshots,
    boundary_flags: boundaryFlags,
    notes: [
      'Validator checks debug-client route wiring and projection/candidate metadata consistency.',
      'Screenshots are deterministic reference canvas artifacts for the projection consumer review routes.',
      'No production map, shared schema, server movement, collision, walkability, door, house, transition, or gameplay authority is created.'
    ]
  };
  if (WRITE_REPORT) {
    const out = path.join(GATE_ROOT, 'validation/projection_consumer_smoke_validation_report.json');
    mkdirSync(path.dirname(out), { recursive: true });
    writeFileSync(out, JSON.stringify(report, null, 2) + '\n');
  }
  console.log(JSON.stringify({ status: report.status, routes: routeResults.length, negatives: negativeResults.length, screenshots: screenshots.length }, null, 2));
  if (report.status !== 'pass') process.exit(1);
}

run();
