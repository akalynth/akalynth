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
const DESIGN_ROOT = path.join(REPO_ROOT, 'docs/asset-decisions/AKALYNTH_RUNTIME_MAP_AUTHORITY_SCHEMA_DESIGN_V1');
const HARNESS_ROOT = path.join(REPO_ROOT, 'docs/asset-decisions/AKALYNTH_RUNTIME_MAP_SCHEMA_VALIDATION_HARNESS_V1');
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
  if (payload.layer === 'runtime_visual_object_layer') {
    for (const key of ['collision', 'walkability']) {
      if (hasOwn(payload.object, key)) flags.push(`runtime_visual_layer_forbidden_field:${key}`);
    }
  }
  if (payload.layer === 'runtime_collision_layer') {
    for (const key of ['sprite', 'render', 'asset_id', 'transition_to', 'door_state', 'shop', 'dialogue']) {
      if (hasOwn(payload.cell, key)) flags.push(`runtime_collision_layer_forbidden_field:${key}`);
    }
  }
  if (payload.layer === 'runtime_walkability_layer') {
    for (const key of ['transition_to', 'door_permissions', 'ownership', 'destination_map']) {
      if (hasOwn(payload.cell, key)) flags.push(`runtime_walkability_layer_forbidden_field:${key}`);
    }
  }
  if (payload.layer === 'runtime_overlay_presentation_layer') {
    for (const key of ['house_entry', 'ownership', 'server_floor_truth', 'player_inside_outside_authority']) {
      if (hasOwn(payload.overlay, key)) flags.push(`runtime_overlay_layer_forbidden_field:${key}`);
    }
  }
  if (payload.layer === 'runtime_door_house_layer') {
    if (payload.source === 'visual_asset') flags.push('runtime_door_house_layer_forbidden_source:visual_asset');
    for (const key of ['access_list_enforced', 'owner_account_id', 'lock_state_runtime', 'collision_resolution', 'walkability_resolution']) {
      if (hasOwn(payload.door_record, key) || hasOwn(payload.house_record, key)) flags.push(`runtime_door_house_layer_forbidden_field:${key}`);
    }
  }
  if (payload.layer === 'runtime_transition_layer') {
    if (payload.runtime_enabled === true && payload.destination_validated === false) flags.push('runtime_transition_enabled_without_destination_validation');
    if (payload.endpoint?.destination_exists === true && !payload.endpoint?.promotion_receipt) flags.push('runtime_destination_existence_forbidden');
    for (const key of ['spawn', 'ai', 'combat', 'mob_behavior']) {
      if (hasOwn(payload, key)) flags.push(`runtime_transition_layer_forbidden_field:${key}`);
    }
  }
  if (payload.production_map_promoted === true) flags.push('production_map_promoted_forbidden');
  if (payload.server_authoritative === true) flags.push('server_authoritative_forbidden');
  if (hasOwn(payload, 'shared_map_path') && payload.shared_map_path !== 'none') flags.push('shared_map_path_forbidden');
  for (const key of ['npc_behavior', 'mob_behavior', 'shop', 'dialogue', 'spawn', 'ai', 'combat']) {
    if (hasOwn(payload, key)) flags.push(`runtime_schema_forbidden_field:${key}`);
  }
  if (payload.layers) {
    for (const [layerName, layerPayload] of Object.entries(payload.layers)) {
      const layer = layerName === 'visual_object_layer' ? 'runtime_visual_object_layer'
        : layerName === 'walkability_layer' ? 'runtime_walkability_layer'
        : layerName === 'transition_layer' ? 'runtime_transition_layer'
        : layerName;
      flags.push(...flagsForPayload({ layer, ...(layerPayload as Json) }));
    }
  }
  return [...new Set(flags)];
}

function positiveFlags(payload: Json): string[] {
  const flags = flagsForPayload(payload);
  if (payload.runtime_authority !== false) flags.push('runtime_authority_not_false');
  if (payload.server_authoritative !== false) flags.push('server_authoritative_not_false');
  if (payload.production_map_promoted !== false) flags.push('production_map_promoted_not_false');
  if (payload.mechanics !== null) flags.push('mechanics_not_null');
  if (payload.promotion) {
    if (payload.promotion.shared_map_path !== 'none') flags.push('shared_map_path_not_none');
    if (payload.promotion.server_movement_verified !== false) flags.push('server_movement_verified_not_false');
  }
  return [...new Set(flags)];
}

function run() {
  const schemaFiles = [
    'runtime_visual_object_layer.schema.draft.json',
    'runtime_collision_layer.schema.draft.json',
    'runtime_walkability_layer.schema.draft.json',
    'runtime_overlay_presentation_layer.schema.draft.json',
    'runtime_door_house_layer.schema.draft.json',
    'runtime_transition_layer.schema.draft.json',
    'runtime_map_bundle_manifest.schema.draft.json'
  ].map((file) => path.join(DESIGN_ROOT, 'draft_schemas', file));
  const schemaResults = schemaFiles.map((file) => {
    readJson(file);
    return { file: rel(file), result: 'pass' as const, sha256: sha256(file) };
  });

  const positivePath = path.join(HARNESS_ROOT, 'validation/positive_runtime_schema_examples.json');
  const negativePath = path.join(HARNESS_ROOT, 'validation/negative_runtime_schema_cases.json');
  const positives = readJson(positivePath).cases as Json[];
  const negatives = readJson(negativePath).cases as Json[];

  const positiveResults: CaseResult[] = positives.map((test) => {
    const payload = test.path ? readJson(path.join(HARNESS_ROOT, test.path)) : test.payload;
    const observed = positiveFlags(payload);
    return { id: test.id, observed_flags: observed, result: observed.length === 0 ? 'pass' : 'failed' };
  });

  const negativeResults: CaseResult[] = negatives.map((test) => {
    const observed = flagsForPayload(test.payload);
    const expected = test.expected_flags as string[];
    const ok = expected.every((flag) => observed.includes(flag));
    return { id: test.id, expected_flags: expected, observed_flags: observed, result: ok ? 'flagged' : 'missed' };
  });

  const report = {
    id: 'AKALYNTH_RUNTIME_MAP_SCHEMA_VALIDATION_HARNESS_V1_REPORT',
    status: schemaResults.every((r) => r.result === 'pass') && positiveResults.every((r) => r.result === 'pass') && negativeResults.every((r) => r.result === 'flagged') ? 'pass' : 'fail',
    generated_by: rel(fileURLToPath(import.meta.url)),
    checks: {
      draft_runtime_schemas_parse: schemaResults.every((r) => r.result === 'pass') ? 'pass' : 'fail',
      positive_projection_examples_pass: positiveResults.every((r) => r.result === 'pass') ? 'pass' : 'fail',
      negative_leakage_cases_flagged: negativeResults.every((r) => r.result === 'flagged') ? 'pass' : 'fail',
      visual_layer_cannot_declare_collision_or_walkability: negativeResults.find((r) => r.id === 'negative_visual_runtime_layer_declares_blocked_walkable')?.result === 'flagged' ? 'pass' : 'fail',
      collision_layer_cannot_embed_render_fields: negativeResults.find((r) => r.id === 'negative_collision_layer_embeds_sprite_render_fields')?.result === 'flagged' ? 'pass' : 'fail',
      walkability_layer_cannot_embed_transition_targets: negativeResults.find((r) => r.id === 'negative_walkability_layer_embeds_transition_to')?.result === 'flagged' ? 'pass' : 'fail',
      door_house_layers_cannot_enforce_authority_yet: ['negative_door_layer_enforces_access_list', 'negative_house_layer_declares_owner_account'].every((id) => negativeResults.find((r) => r.id === id)?.result === 'flagged') ? 'pass' : 'fail',
      transition_layer_cannot_claim_destination_exists_without_promotion: negativeResults.find((r) => r.id === 'negative_transition_endpoint_destination_exists_without_promotion')?.result === 'flagged' ? 'pass' : 'fail',
      bundle_manifest_cannot_promote_production_map: negativeResults.find((r) => r.id === 'negative_bundle_manifest_sets_production_promoted_true')?.result === 'flagged' ? 'pass' : 'fail',
      promoted_shared_map_paths_forbidden_in_draft_harness: negativeResults.find((r) => r.id === 'negative_schema_artifact_references_shared_map_promoted_target')?.result === 'flagged' ? 'pass' : 'fail',
      content_behavior_fields_forbidden: negativeResults.find((r) => r.id === 'negative_runtime_map_schema_contains_content_behavior')?.result === 'flagged' ? 'pass' : 'fail'
    },
    schema_results: schemaResults,
    positive_results: positiveResults,
    negative_results: negativeResults,
    notes: [
      'Harness validates draft docs artifacts only.',
      'No schemas are promoted into shared runtime packages.',
      'No runtime map, movement, collision, walkability, door, house, transition, or production-map authority is created.'
    ]
  };

  if (WRITE_REPORT) {
    const out = path.join(HARNESS_ROOT, 'validation/runtime_schema_validation_report.json');
    mkdirSync(path.dirname(out), { recursive: true });
    writeFileSync(out, JSON.stringify(report, null, 2) + '\n');
  }
  console.log(JSON.stringify({ status: report.status, schemas: schemaResults.length, positives: positiveResults.length, negatives: negativeResults.length }, null, 2));
  if (report.status !== 'pass') process.exit(1);
}

run();
