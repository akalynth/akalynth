import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const PACKET = 'AKALYNTH_COUNCIL_PUBLISH_PLAY_PERMIT_V1';
const PROOF = 'council_lane_publish_play_permit_v1';
const TOOL_DIR = path.dirname(fileURLToPath(import.meta.url));
const SAMPLE = path.join(path.resolve(TOOL_DIR, '../../..'), '../akalynth-codex/samples/council-proposal-publish-staging-play.sample.json');

const p = JSON.parse(readFileSync(SAMPLE, 'utf8'));
if (p.packet_authority.object_id !== PACKET) throw new Error('packet authority');
if (p.action_class !== 'lane:staging:publish-account-play') throw new Error('action class');
if (!p.action_params.execution_ack_required) throw new Error('ack required');
console.log(`${PACKET} contract OK (${PROOF})`);