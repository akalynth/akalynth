import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, '..');
const clientSource = readFileSync(resolve(root, 'src/hooks/useGameClient.ts'), 'utf8');
const panelSource = readFileSync(resolve(root, 'src/components/GatherPanel.tsx'), 'utf8');
const labelsSource = readFileSync(resolve(root, 'src/data/gatherLabels.ts'), 'utf8');
const stepsSource = readFileSync(resolve(root, 'src/components/GatherLoopSteps.tsx'), 'utf8');

function fail(message) {
  console.error(`debug-client gather wire authority verifier failed: ${message}`);
  process.exit(1);
}

function requireLiteral(label, literal, source = clientSource) {
  if (!source.includes(literal)) fail(`missing ${label}: ${literal}`);
}

function functionBody(name) {
  const marker = `const ${name} = useCallback(`;
  const start = clientSource.indexOf(marker);
  if (start === -1) fail(`missing useCallback action ${name}`);
  const next = clientSource.indexOf('\n  const ', start + marker.length);
  if (next === -1) return clientSource.slice(start);
  return clientSource.slice(start, next);
}

function assertNoClientAuthorityFields(label, body) {
  for (const field of ['player_id', 'account_id', 'csrf', 'held:', 'item_type:', 'progress_pct:']) {
    if (body.includes(field)) fail(`${label} must not carry client authority field ${field}`);
  }
}

function assertIntentOnlyAction(name, expected) {
  const body = functionBody(name);
  for (const literal of expected) requireLiteral(`${name} payload literal`, literal);
  assertNoClientAuthorityFields(name, body);
}

assertIntentOnlyAction('sendGather', [
  "const payload: GatherIntentMessage = { type: 'gather_intent', node_id: nodeId };",
  'send(payload);',
]);
assertIntentOnlyAction('sendDeliver', [
  "const payload: DeliverIntentMessage = { type: 'deliver_intent', station_id: stationId };",
  'send(payload);',
]);
assertIntentOnlyAction('sendRefine', [
  "const payload: RefineIntentMessage = { type: 'refine_intent', station_id: stationId };",
  'send(payload);',
]);

requireLiteral('gather snapshot replaces server registry', "case 'gather_snapshot':");
requireLiteral('gather progress uses server pct', 'typeof data.progress_pct === \'number\' ? data.progress_pct');
requireLiteral('gather completed uses server item_type', "typeof data.item_type === 'string' ? data.item_type");
requireLiteral('deliver result clears held from server ack', 'held: null');
// Refine is server-authoritative too: the client only tracks the server's refine acks.
requireLiteral('refine result handler present', "case 'refine_result':");
requireLiteral('refine completed clears active refine + takes server item_type', 'activeRefineStationId: null');

if (
  panelSource.includes('WebSocket') ||
  panelSource.includes('gather_intent') ||
  panelSource.includes('deliver_intent') ||
  panelSource.includes('refine_intent')
) {
  fail('GatherPanel must not send wire messages directly');
}
requireLiteral('GatherPanel uses intent callbacks only', 'onGather(n.node_id)', panelSource);
requireLiteral('GatherPanel uses deliver callbacks only', 'onDeliver(st.station_id)', panelSource);
requireLiteral('GatherPanel uses refine callbacks only', 'onRefine(st.station_id)', panelSource);
requireLiteral('GatherPanel player-facing title', 'GATHER_PANEL_TITLE', panelSource);
requireLiteral('GatherPanel onboarding hint', 'GATHER_PANEL_HINT', panelSource);
requireLiteral('GatherPanel ritual steps', 'GatherLoopSteps', panelSource);
requireLiteral('GatherPanel held chip labels', 'heldItemLabel', panelSource);

// Pure presentation helpers must not invent protocol authority.
requireLiteral('gatherLoopStep pure helper', 'export function gatherLoopStep', labelsSource);
requireLiteral('deliverStatusLine pure helper', 'export function deliverStatusLine', labelsSource);
if (labelsSource.includes('WebSocket') || labelsSource.includes('gather_intent')) {
  fail('gatherLabels must not send wire messages');
}
if (
  stepsSource.includes('WebSocket') ||
  stepsSource.includes('gather_intent') ||
  stepsSource.includes('onGather')
) {
  fail('GatherLoopSteps must be display-only');
}
requireLiteral('deliver_result uses deliverStatusLine', 'deliverStatusLine({', clientSource);
requireLiteral('first-keystone uses prior count', 'priorKeystoneTokens', clientSource);
requireLiteral('first-keystone copy from server reward only', 'keystone_token', labelsSource);
requireLiteral('isKeystoneDeliverStatus helper', 'export function isKeystoneDeliverStatus', labelsSource);

console.log('debug-client gather wire authority verifier passed');