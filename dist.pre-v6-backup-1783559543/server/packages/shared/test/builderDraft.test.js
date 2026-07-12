#!/usr/bin/env tsx
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { computeManifestChecksum, validateDraftManifest } from '../builderDraft.js';
const here = path.dirname(fileURLToPath(import.meta.url));
const sample = path.resolve(here, '../../../../akalynth-codex/samples/rookguard-builder-draft-manifest.sample.json');
const preview = path.resolve(here, '../../../../akalynth-codex/samples/rookguard-local-preview-session.sample.json');
let failed = 0;
function check(name, cond) {
    console.log(`${cond ? 'PASS' : 'FAIL'}  ${name}`);
    if (!cond)
        failed++;
}
const manifest = JSON.parse(readFileSync(sample, 'utf8'));
const previewSession = JSON.parse(readFileSync(preview, 'utf8'));
try {
    validateDraftManifest(manifest);
    check('validateDraftManifest accepts rookguard sample', true);
}
catch {
    check('validateDraftManifest accepts rookguard sample', false);
}
check('computeManifestChecksum matches preview fixture', computeManifestChecksum(manifest) === previewSession.artifacts.manifest_checksum);
if (failed > 0) {
    console.error(`\n${failed} test(s) failed`);
    process.exit(1);
}
console.log('\nbuilderDraft shared tests passed');
