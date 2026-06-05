import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import * as path from 'node:path';

type Json = Record<string, any>;

type CaseResult = {
  id: string;
  expected_flags?: string[];
  observed_flags: string[];
  result: 'pass' | 'flagged' | 'missed' | 'failed';
};

const REPO_ROOT = fileURLToPath(new URL('../../', import.meta.url));
const GATE_ROOT = path.join(REPO_ROOT, 'docs/asset-decisions/AKALYNTH_HIGH_CITY_RUNTIME_MAP_PROJECTION_CANDIDATE_V1');
const WRITE_REPORT = process.argv.includes('--write-report');

function readJson(abs: string): Json {
  return JSON.parse(readFileSync(abs, 'utf8'));
}

function rel(abs: string): string {
  return path.relative(REPO_ROOT, abs).replace(/\\/g, '/');
}

function sha256(abs: string): string {
  return createHash('sha256').update(readFileSync(abs)).digest('hex');
}

function hasOwn(obj: any, key: string): boolean {
  return Object.prototype.hasOwnProperty.call(obj ?? {}, key);
}

function flagsForPayload(payload: Json): string[] {
  const flags: string[] = [];
  if (payload.production_map_promoted === true) flags.push('production_map_promoted_forbidden');
  if (payload.server_authoritative === true) flags.push('server_authoritative_forbidden');
  if (payload.runtime_authority === true) flags.push('runtime_authority_forbidden');
  if (hasOwn(payload, 'shared_map_path') && payload.shared_map_path !== 'none') flags.push('shared_map_path_forbidden');
  if (payload.layer === 'runtime_collision_layer') {
    for (const key of ['render', 'sprite', 'asset_id', 'visual_object_id']) {
      if (hasOwn(payload.cell, key)) flags.push(`runtime_collision_layer_forbidden_field:${key}`);
    }
  }
  if (payload.layer === 'runtime_walkability_layer') {
    for (const key of ['transition_to', 'destination_map', 'door_permissions']) {
      if (hasOwn(payload.cell, key)) flags.push(`runtime_walkability_layer_forbidden_field:${key}`);
    }
  }
  if (payload.layer === 'runtime_door_house_layer') {
    for (const key of ['access_list_enforced', 'owner_account_id', 'collision_resolution', 'walkability_resolution']) {
      if (hasOwn(payload.door_record, key) || hasOwn(payload.house_record, key)) flags.push(`runtime_door_house_layer_forbidden_field:${key}`);
    }
  }
  if (payload.layer === 'runtime_transition_layer') {
    if (payload.endpoint?.destination_exists === true && !payload.endpoint?.promotion_receipt) flags.push('runtime_destination_existence_forbidden');
    if (payload.runtime_enabled === true) flags.push('runtime_transition_enabled_forbidden');
  }
  for (const key of ['npc_behavior', 'mob_behavior', 'shop', 'dialogue', 'spawn', 'ai', 'combat']) {
    if (hasOwn(payload, key)) flags.push(`runtime_schema_forbidden_field:${key}`);
  }
  if (payload.source_receipts) {
    for (const receipt of Object.values(payload.source_receipts) as Json[]) {
      if (!String(receipt.status ?? '').startsWith('accepted_')) flags.push('source_receipt_not_accepted');
    }
  }
  if (payload.artifact_hash_check && payload.artifact_hash_check.expected !== payload.artifact_hash_check.actual) flags.push('artifact_hash_mismatch');
  return [...new Set(flags)];
}

function assertProjectionBoundary(projection: Json): string[] {
  const flags: string[] = flagsForPayload(projection);
  if (projection.status !== 'draft_non_runtime_projection') flags.push('projection_status_not_draft_non_runtime');
  if (projection.mechanics !== null) flags.push('mechanics_not_null');
  if (projection.promotion?.shared_map_path !== 'none') flags.push('promotion_shared_map_path_not_none');
  if (projection.promotion?.server_movement_verified !== false) flags.push('server_movement_verified_not_false');
  if (projection.promotion?.runtime_schema_promotion !== false) flags.push('runtime_schema_promotion_not_false');
  for (const [layerName, layer] of Object.entries(projection.layers ?? {}) as [string, Json][]) {
    if (layer.runtime_authority !== false) flags.push(`layer_runtime_authority_not_false:${layerName}`);
    if (layer.server_authoritative !== false) flags.push(`layer_server_authoritative_not_false:${layerName}`);
    if (layer.production_map_promoted !== false) flags.push(`layer_production_map_promoted_not_false:${layerName}`);
    if (layer.shared_map_path !== 'none') flags.push(`layer_shared_map_path_not_none:${layerName}`);
    if (layer.mechanics !== null) flags.push(`layer_mechanics_not_null:${layerName}`);
  }
  return [...new Set(flags)];
}

function run() {
  const projectionPath = path.join(GATE_ROOT, 'projection/high_city_runtime_map_projection.v1.draft.json');
  const summaryPath = path.join(GATE_ROOT, 'projection/high_city_runtime_map_layers_summary.v1.json');
  const manifestPath = path.join(GATE_ROOT, 'projection/high_city_runtime_map_projection_manifest.v1.json');
  const shaPath = path.join(GATE_ROOT, 'projection/high_city_runtime_map_projection.sha256');
  const negativePath = path.join(GATE_ROOT, 'validation/negative_runtime_projection_cases.json');
  const projection = readJson(projectionPath);
  const summary = readJson(summaryPath);
  const manifest = readJson(manifestPath);
  readFileSync(shaPath, 'utf8');
  const negatives = readJson(negativePath).cases as Json[];

  const sourceReceiptResults = Object.values(projection.source_receipts ?? {}).map((receipt: any) => {
    if (!receipt || typeof receipt.path !== 'string') {
      return { id: receipt?.id ?? null, file: null, status: null, accepted: false, hash_matches: false };
    }
    const abs = path.join(REPO_ROOT, receipt.path);
    const exists = existsSync(abs);
    const parsed = exists ? readJson(abs) : {};
    const hashMatches = exists ? sha256(abs) === receipt.sha256 : false;
    return { id: receipt.id, file: receipt.path, status: parsed.status ?? null, accepted: String(parsed.status ?? '').startsWith('accepted_'), hash_matches: hashMatches };
  });

  const manifestHashResults = Object.entries(manifest.artifact_hashes ?? {}).map(([artifactPath, expected]) => {
    const abs = path.join(GATE_ROOT, artifactPath);
    const exists = existsSync(abs);
    const actual = exists ? sha256(abs) : null;
    return { file: artifactPath, exists, expected, actual, result: exists && actual === expected ? 'pass' : 'fail' };
  });

  const projectionFlags = assertProjectionBoundary(projection);
  const summaryFlags = flagsForPayload(summary);
  const manifestFlags = flagsForPayload(manifest);
  const negativeResults: CaseResult[] = negatives.map((test) => {
    const observed = flagsForPayload(test.payload);
    const expected = test.expected_flags as string[];
    const ok = expected.every((flag) => observed.includes(flag));
    return { id: test.id, expected_flags: expected, observed_flags: observed, result: ok ? 'flagged' : 'missed' };
  });

  const report = {
    id: 'AKALYNTH_HIGH_CITY_RUNTIME_MAP_PROJECTION_CANDIDATE_V1_REPORT',
    status: projectionFlags.length === 0 && summaryFlags.length === 0 && manifestFlags.length === 0 && sourceReceiptResults.every((r) => r.accepted && r.hash_matches) && manifestHashResults.every((r) => r.result === 'pass') && negativeResults.every((r) => r.result === 'flagged') ? 'pass' : 'fail',
    generated_by: rel(fileURLToPath(import.meta.url)),
    checks: {
      projection_json_valid: 'pass',
      projection_conforms_to_draft_runtime_boundary: projectionFlags.length === 0 ? 'pass' : 'fail',
      layers_summary_json_valid: summaryFlags.length === 0 ? 'pass' : 'fail',
      projection_manifest_json_valid: manifestFlags.length === 0 ? 'pass' : 'fail',
      source_receipts_accepted: sourceReceiptResults.every((r) => r.accepted) ? 'pass' : 'fail',
      source_artifact_hashes_match: sourceReceiptResults.every((r) => r.hash_matches) && manifestHashResults.every((r) => r.result === 'pass') ? 'pass' : 'fail',
      candidate_planes_remain_non_runtime: projectionFlags.filter((f) => f.includes('runtime_authority') || f.includes('server_authoritative') || f.includes('production_map')).length === 0 ? 'pass' : 'fail',
      authority_fields_remain_none_false_unpromoted: projectionFlags.length === 0 ? 'pass' : 'fail',
      negative_projection_cases_flagged: negativeResults.every((r) => r.result === 'flagged') ? 'pass' : 'fail',
      no_shared_map_path_used_as_production_target: [...projectionFlags, ...summaryFlags, ...manifestFlags].every((f) => !f.includes('shared_map_path')) ? 'pass' : 'fail'
    },
    projection_flags: projectionFlags,
    summary_flags: summaryFlags,
    manifest_flags: manifestFlags,
    source_receipt_results: sourceReceiptResults,
    manifest_hash_results: manifestHashResults,
    negative_results: negativeResults,
    notes: [
      'Projection candidate validates docs artifacts only.',
      'No runtime map is loaded and no shared production map is promoted.',
      'No server movement, collision, walkability, door, house, transition, or gameplay authority is created.'
    ]
  };

  if (WRITE_REPORT) {
    const out = path.join(GATE_ROOT, 'validation/runtime_projection_validation_report.json');
    mkdirSync(path.dirname(out), { recursive: true });
    writeFileSync(out, JSON.stringify(report, null, 2) + '\n');
  }
  console.log(JSON.stringify({ status: report.status, source_receipts: sourceReceiptResults.length, manifest_hashes: manifestHashResults.length, negatives: negativeResults.length }, null, 2));
  if (report.status !== 'pass') process.exit(1);
}

run();
