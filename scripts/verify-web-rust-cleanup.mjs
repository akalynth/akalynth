#!/usr/bin/env node
import { createHash } from 'node:crypto';
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(fileURLToPath(new URL('..', import.meta.url)));
const ROOKGUARD_TUTORIAL_TILEMAP_TEST = 'data/assets-src/test-maps/rookguard-tutorial-assets-v1.json';
const errors = [];

function fail(message) {
  errors.push(message);
}

function abs(rel) {
  return resolve(root, rel);
}

function read(rel) {
  const p = abs(rel);
  if (!existsSync(p)) {
    fail(`${rel}: missing`);
    return '';
  }
  return readFileSync(p, 'utf8');
}

function readJson(rel) {
  const raw = read(rel);
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch (err) {
    fail(`${rel}: invalid JSON (${err.message})`);
    return null;
  }
}

function assertContains(rel, text, needle, reason) {
  if (!text.includes(needle)) fail(`${rel}: expected ${reason}`);
}

function assertNotContains(rel, text, needle, reason) {
  if (text.includes(needle)) fail(`${rel}: forbidden ${reason}`);
}

function assertArrayEq(label, actual, expected) {
  const ok = Array.isArray(actual) && actual.length === expected.length && actual.every((value, i) => value === expected[i]);
  if (!ok) fail(`${label}: expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
}

function walkSourceFiles(relDir) {
  const dir = abs(relDir);
  if (!existsSync(dir)) {
    fail(`${relDir}: missing`);
    return [];
  }
  const out = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const rel = `${relDir}/${entry.name}`;
    const full = abs(rel);
    let stat;
    try {
      stat = statSync(full);
    } catch {
      continue;
    }
    if (stat.isDirectory()) out.push(...walkSourceFiles(rel));
    else if (stat.isFile() && /\.(?:ts|tsx|js|mjs|cjs)$/.test(entry.name)) out.push(rel);
  }
  return out;
}

function assertServerRuntimeHasNoOldHashOrSpawnBridge() {
  const files = walkSourceFiles('apps/server/src');
  for (const rel of files) {
    const source = read(rel);
    assertNotContains(rel, source, "@noble/hashes/blake3", 'direct JS BLAKE3 import in server runtime');
    assertNotContains(rel, source, 'fast-json-stable-stringify', 'direct stable stringify import in server runtime');
    assertNotContains(rel, source, 'node:child_process', 'direct child_process import in server runtime');
    assertNotContains(rel, source, 'spawnSync', 'spawn-per-event bridge in server runtime');
  }
}

function assertTilemapTested(owner, manifest, assetId) {
  if (manifest.status !== 'tilemap_tested') fail(`${owner}: ${assetId} status must be tilemap_tested`);
  if (manifest.tilemap_test !== ROOKGUARD_TUTORIAL_TILEMAP_TEST) {
    fail(`${owner}: ${assetId} tilemap_test must be ${ROOKGUARD_TUTORIAL_TILEMAP_TEST}`);
    return;
  }
  const test = readJson(ROOKGUARD_TUTORIAL_TILEMAP_TEST);
  if (!test) return;
  const placements = Array.isArray(test.placements) ? test.placements : [];
  const placement = placements.find((entry) => entry?.asset_id === assetId);
  if (!placement) fail(`${ROOKGUARD_TUTORIAL_TILEMAP_TEST}: missing placement for ${assetId}`);
  else if (placement.mechanics !== null) fail(`${ROOKGUARD_TUTORIAL_TILEMAP_TEST}: ${assetId} placement mechanics must be null`);
}

assertServerRuntimeHasNoOldHashOrSpawnBridge();

const adapterRel = 'apps/server/src/witness/chronicleAdapter.ts';
const adapter = read(adapterRel);
assertNotContains(adapterRel, adapter, 'spawnSync', 'direct server-side spawn-per-event bridge');
assertNotContains(adapterRel, adapter, 'node:child_process', 'direct child_process dependency in server adapter');
assertNotContains(adapterRel, adapter, 'CHRONICLE_ALLOW_CLI_FALLBACK', 'server runtime CLI fallback opt-in');
assertNotContains(adapterRel, adapter, 'process.env.CHRONICLE_BIN', 'server runtime CLI fallback binary env');
assertNotContains(adapterRel, adapter, 'function defaultBinPath()', 'server runtime chronicle_append default path');
assertNotContains(adapterRel, adapter, 'function shouldAllowCliFallback()', 'server runtime CLI fallback gate');
assertNotContains(adapterRel, adapter, "mode: 'native' | 'cli-fallback'", 'server runtime CLI fallback backend mode');
assertNotContains(adapterRel, adapter, 'chronicle_append not found', 'server runtime chronicle_append fallback error');
assertContains(adapterRel, adapter, 'openChronicle', 'Rust loader-backed chronicle open path');
assertContains(adapterRel, adapter, 'initChronicleBackend', 'boot-time backend initialization path');
assertContains(adapterRel, adapter, 'CHRONICLE_NATIVE=0', 'documented native-disable fail-closed flag');
assertContains(adapterRel, adapter, 'allowCliFallback: false', 'server runtime disables loader CLI fallback');
assertContains(adapterRel, adapter, 'fails closed when it is unavailable', 'native-unavailable fail-closed runtime comment');
assertContains(adapterRel, adapter, 'not reachable from server runtime', 'server runtime excludes old CLI auditor path');
assertContains(adapterRel, adapter, 'chronicle native backend unavailable', 'native-only failure message');

const loaderRel = 'crates/chronicle/napi/loader.cjs';
const loader = read(loaderRel);
assertContains(loaderRel, loader, 'openChronicle', 'loader-managed chronicle backend');
assertContains(loaderRel, loader, 'openHashPrimitive', 'Rust hash primitive exposure');
assertContains(loaderRel, loader, 'blake3HexBytes', 'Rust byte hash primitive exposure');
assertContains(loaderRel, loader, 'toBuffer(value)', 'Rust byte hash primitive byte normalization');
assertContains(loaderRel, loader, 'allowCliFallback = false', 'CLI fallback defaults off');
assertContains(loaderRel, loader, 'native addon unavailable and CLI fallback is not enabled', 'loader fail-closed without explicit fallback');
assertContains(loaderRel, loader, 'spawnSync', 'explicit loader-managed CLI fallback retained');

const serverPackageRel = 'apps/server/package.json';
const serverPackage = readJson(serverPackageRel);
if (serverPackage?.dependencies?.['fast-json-stable-stringify']) {
  fail(`${serverPackageRel}: server package must not declare fast-json-stable-stringify directly; use packages/shared/hashPrimitive.ts`);
}
if (serverPackage?.dependencies?.['@noble/hashes']) {
  fail(`${serverPackageRel}: server package must not declare @noble/hashes directly; use shared/Rust primitives or Node built-ins at the package boundary`);
}
const rootLockRel = 'package-lock.json';
const rootLock = readJson(rootLockRel);
const rootServerLockDeps = rootLock?.packages?.['apps/server']?.dependencies ?? {};
if (rootServerLockDeps['fast-json-stable-stringify']) {
  fail(`${rootLockRel}: apps/server lock entry must not declare fast-json-stable-stringify directly`);
}
if (rootServerLockDeps['@noble/hashes']) {
  fail(`${rootLockRel}: apps/server lock entry must not declare @noble/hashes directly`);
}
const serverLockRel = 'apps/server/package-lock.json';
const serverLock = readJson(serverLockRel);
const standaloneServerLockDeps = serverLock?.packages?.['']?.dependencies ?? {};
if (standaloneServerLockDeps['fast-json-stable-stringify']) {
  fail(`${serverLockRel}: root lock entry must not declare fast-json-stable-stringify directly`);
}
if (standaloneServerLockDeps['@noble/hashes']) {
  fail(`${serverLockRel}: root lock entry must not declare @noble/hashes directly`);
}

const indexRel = 'apps/server/src/index.ts';
const serverIndex = read(indexRel);
assertNotContains(indexRel, serverIndex, "@noble/hashes/blake3", 'local BLAKE3 import in server index');
assertNotContains(indexRel, serverIndex, 'fast-json-stable-stringify', 'local stable stringify import in server index');
assertNotContains(indexRel, serverIndex, 'function blake3HexUtf8', 'inline BLAKE3 helper in server index');
assertNotContains(indexRel, serverIndex, 'function stableJson', 'inline canonical JSON helper in server index');
assertContains(indexRel, serverIndex, 'computePayloadHash', 'shared chronicle hash wrapper use');
assertContains(indexRel, serverIndex, 'computeEventHash', 'shared chronicle event hash wrapper use');

const sharedPrimitiveRel = 'packages/shared/hashPrimitive.ts';
const sharedPrimitive = read(sharedPrimitiveRel);
assertContains(sharedPrimitiveRel, sharedPrimitive, 'canonicalJson', 'shared canonical JSON primitive');
assertContains(sharedPrimitiveRel, sharedPrimitive, 'blake3Bytes', 'shared raw BLAKE3 byte primitive');
assertContains(sharedPrimitiveRel, sharedPrimitive, 'blake3HexBytes', 'shared raw BLAKE3 byte-hex primitive');
assertContains(sharedPrimitiveRel, sharedPrimitive, 'blake3HexUtf8', 'shared raw BLAKE3 primitive');
assertContains(sharedPrimitiveRel, sharedPrimitive, 'blake3Prefixed', 'shared prefixed BLAKE3 primitive');

function assertUsesSharedHashPrimitive(rel, expectedImport, requiredSymbols) {
  const source = read(rel);
  assertNotContains(rel, source, "@noble/hashes/blake3", 'direct BLAKE3 import outside shared hash primitive');
  assertNotContains(rel, source, 'fast-json-stable-stringify', 'direct stable stringify import outside shared hash primitive');
  assertContains(rel, source, expectedImport, 'shared hash primitive import');
  for (const symbol of requiredSymbols) assertContains(rel, source, symbol, `shared hash primitive symbol ${symbol}`);
}

assertUsesSharedHashPrimitive('packages/shared/rng.ts', './hashPrimitive.js', [
  'blake3Bytes',
  'blake3Prefixed',
  'canonicalJson',
]);
const sharedRngRel = 'packages/shared/rng.ts';
const sharedRng = read(sharedRngRel);
assertNotContains(sharedRngRel, sharedRng, 'Inline stable stringify', 'stale inline stable stringify comment in shared RNG');
assertNotContains(sharedRngRel, sharedRng, 'Object.keys(value as object).sort()', 'inline shallow key-sort canonicalization in shared RNG');
assertContains(sharedRngRel, sharedRng, 'return canonicalJson(value)', 'shared RNG stableJson delegates to canonicalJson');
assertUsesSharedHashPrimitive('packages/shared/verifyOutcome.ts', './hashPrimitive.js', [
  'blake3Prefixed',
  'canonicalJson',
]);
assertUsesSharedHashPrimitive('tools/verify-outcome/test.ts', '../../packages/shared/hashPrimitive.js', [
  'blake3Prefixed',
  'canonicalJson',
]);
assertUsesSharedHashPrimitive('tools/verify-outcome/gen-fixtures.ts', '../../packages/shared/hashPrimitive.js', [
  'blake3Prefixed',
  'canonicalJson',
]);
assertUsesSharedHashPrimitive('tools/verify-outcome/gen-fixtures-v2.ts', '../../packages/shared/hashPrimitive.js', [
  'blake3Bytes',
  'blake3HexUtf8',
  'blake3Prefixed',
  'canonicalJson',
]);

const fixtureGeneratorRel = 'apps/server/tools/generate-chronicle-log.js';
const fixtureGenerator = read(fixtureGeneratorRel);
assertNotContains(fixtureGeneratorRel, fixtureGenerator, "@noble/hashes/blake3", 'local BLAKE3 import in chronicle fixture generator');
assertNotContains(fixtureGeneratorRel, fixtureGenerator, 'fast-json-stable-stringify', 'local stable stringify import in chronicle fixture generator');
assertNotContains(fixtureGeneratorRel, fixtureGenerator, 'function blake3HexUtf8', 'inline BLAKE3 helper in chronicle fixture generator');
assertNotContains(fixtureGeneratorRel, fixtureGenerator, 'function stableJson', 'inline canonical JSON helper in chronicle fixture generator');
assertContains(fixtureGeneratorRel, fixtureGenerator, "from '../../../packages/shared/chronicleChain.js'", 'shared chronicle-chain hashing import');
assertContains(fixtureGeneratorRel, fixtureGenerator, 'computeGlobalEventHash', 'shared global chain hash use');

const chronicleDemoRel = 'apps/server/tools/chronicle-demo.ts';
const chronicleDemo = read(chronicleDemoRel);
assertNotContains(chronicleDemoRel, chronicleDemo, 'node:child_process', 'direct child_process dependency in chronicle demo');
assertNotContains(chronicleDemoRel, chronicleDemo, 'spawnSync', 'direct spawn-per-event bridge in chronicle demo');
assertNotContains(chronicleDemoRel, chronicleDemo, 'fast-json-stable-stringify', 'local stable stringify import in chronicle demo');
assertNotContains(chronicleDemoRel, chronicleDemo, 'Pipe to chronicle_append via stdin', 'obsolete direct CLI demo description');
assertContains(chronicleDemoRel, chronicleDemo, 'crates/chronicle/napi/loader.cjs', 'Rust loader-backed chronicle demo open path');
assertContains(chronicleDemoRel, chronicleDemo, 'openChronicle', 'chronicle demo uses loader openChronicle');
assertContains(chronicleDemoRel, chronicleDemo, 'CHRONICLE_ALLOW_CLI_FALLBACK=1', 'chronicle demo documents explicit CLI fallback');
assertContains(chronicleDemoRel, chronicleDemo, "../../../packages/shared/hashPrimitive.js", 'shared canonical JSON primitive import in chronicle demo');
assertContains(chronicleDemoRel, chronicleDemo, 'canonicalJson', 'chronicle demo shared canonical JSON display');
assertContains(chronicleDemoRel, chronicleDemo, 'AKALYNTH_CHRONICLE_DEMO_DIR', 'temp-or-configured demo output directory');

const monetizationExportRel = 'apps/server/tools/export-monetization-redacted.ts';
const monetizationExport = read(monetizationExportRel);
assertNotContains(monetizationExportRel, monetizationExport, 'fast-json-stable-stringify', 'local stable stringify import in monetization redacted export');
assertContains(monetizationExportRel, monetizationExport, "../../../packages/shared/hashPrimitive.js", 'shared canonical JSON primitive import in monetization redacted export');
assertContains(monetizationExportRel, monetizationExport, 'canonicalPrettyJson', 'canonical pretty JSON export helper');
assertContains(monetizationExportRel, monetizationExport, 'canonicalJson(value)', 'monetization export canonical JSON delegation');

const principalCanonicalRel = 'apps/server/src/principal/canonical.ts';
const principalCanonical = read(principalCanonicalRel);
assertNotContains(principalCanonicalRel, principalCanonical, 'fast-json-stable-stringify', 'local stable stringify import in principal canonical helper');
assertContains(principalCanonicalRel, principalCanonical, '../../../../packages/shared/hashPrimitive.js', 'shared canonical JSON primitive import');
assertContains(principalCanonicalRel, principalCanonical, 'sharedCanonicalJson', 'shared canonical JSON delegation');

const kernelReceiptHasherRel = 'packages/coordination-kernel/src/receipt/hasher.ts';
const kernelReceiptHasher = read(kernelReceiptHasherRel);
assertContains(kernelReceiptHasherRel, kernelReceiptHasher, 'export function blake3Bytes(data: Uint8Array): Uint8Array', 'coordination-kernel raw byte hash primitive export');
assertContains(kernelReceiptHasherRel, kernelReceiptHasher, 'export function blake3HexBytes(data: Uint8Array): string', 'coordination-kernel raw byte hash hex primitive export');
assertContains(kernelReceiptHasherRel, kernelReceiptHasher, 'return blake3HexBytes(new TextEncoder().encode(data));', 'coordination-kernel UTF-8 hash delegates to raw byte primitive');
assertContains(kernelReceiptHasherRel, kernelReceiptHasher, 'export function hashCanonicalJson(value: unknown): string', 'coordination-kernel receipt hash primitive export');
assertContains(kernelReceiptHasherRel, kernelReceiptHasher, 'return blake3Hex(canonicalize(value));', 'coordination-kernel canonical hash primitive body');
assertContains(kernelReceiptHasherRel, kernelReceiptHasher, 'return hashCanonicalJson(inputs);', 'coordination-kernel inputs hash delegates to canonical hash primitive');
assertContains(kernelReceiptHasherRel, kernelReceiptHasher, 'return hashCanonicalJson(result);', 'coordination-kernel outputs hash delegates to canonical hash primitive');
assertContains(kernelReceiptHasherRel, kernelReceiptHasher, 'return hashCanonicalJson(body);', 'coordination-kernel event hash delegates to canonical hash primitive');

const kernelIdentityKeyRel = 'packages/coordination-kernel/src/identity/key.ts';
const kernelIdentityKey = read(kernelIdentityKeyRel);
assertNotContains(kernelIdentityKeyRel, kernelIdentityKey, "@noble/hashes/blake3", 'duplicate direct BLAKE3 import in identity key derivation');
assertContains(kernelIdentityKeyRel, kernelIdentityKey, "../receipt/hasher.js", 'identity key derivation imports receipt hash primitive');
assertContains(kernelIdentityKeyRel, kernelIdentityKey, 'return blake3Bytes(input);', 'identity key derivation delegates to raw byte primitive');

const kernelIdentityTokenRel = 'packages/coordination-kernel/src/identity/token.ts';
const kernelIdentityToken = read(kernelIdentityTokenRel);
assertNotContains(kernelIdentityTokenRel, kernelIdentityToken, "@noble/hashes/blake3", 'duplicate direct BLAKE3 import in token id hashing');
assertContains(kernelIdentityTokenRel, kernelIdentityToken, "../receipt/hasher.js", 'token id hashing imports receipt hash primitive');
assertContains(kernelIdentityTokenRel, kernelIdentityToken, 'return blake3HexBytes(combined);', 'token id hashing delegates to raw byte primitive');

const kernelAbsenceHashRel = 'packages/coordination-kernel/src/absence/hash.ts';
const kernelAbsenceHash = read(kernelAbsenceHashRel);
assertNotContains(kernelAbsenceHashRel, kernelAbsenceHash, "@noble/hashes/blake3", 'duplicate direct BLAKE3 import in absence hashing');
assertNotContains(kernelAbsenceHashRel, kernelAbsenceHash, 'new TextEncoder()', 'duplicate local BLAKE3 encoding in absence hashing');
assertContains(kernelAbsenceHashRel, kernelAbsenceHash, "../receipt/hasher.js", 'absence hashing imports receipt hash primitive');
assertContains(kernelAbsenceHashRel, kernelAbsenceHash, 'return hashCanonicalJson(value);', 'absence hashing delegates to receipt hash primitive');

const kernelPackageRel = 'packages/coordination-kernel/package.json';
const kernelPackage = readJson(kernelPackageRel);
if (kernelPackage?.scripts?.test !== 'npm run build && NODE_OPTIONS=--experimental-vm-modules jest') {
  fail(`${kernelPackageRel}: test script must build before running Jest with ESM support`);
}
const kernelHashTestRel = 'packages/coordination-kernel/tests/hash-primitives.test.cjs';
const kernelHashTest = read(kernelHashTestRel);
assertContains(kernelHashTestRel, kernelHashTest, 'hashCanonicalJson', 'receipt hash primitive regression test');
assertContains(kernelHashTestRel, kernelHashTest, 'hashCanonical(inputs)', 'absence hash parity regression test');
assertContains(kernelHashTestRel, kernelHashTest, 'computeEventHash(body)', 'event hash regression test');
assertContains(kernelHashTestRel, kernelHashTest, 'deriveAuthSeed(seed)', 'auth seed regression test');
assertContains(kernelHashTestRel, kernelHashTest, 'computeTokenId', 'token id regression test');
assertContains(
  kernelHashTestRel,
  kernelHashTest,
  'blake3:04f18b9f653e5ed4214b908c5826e5e614ecff73facc55ec2a5b68acc3affaf8',
  'exact canonical input hash fixture'
);
assertContains(
  kernelHashTestRel,
  kernelHashTest,
  'blake3:cf135a9cc8a47c5894b352a5f608719d37d32f0dbcb46cf630d60b205b6c79bc',
  'exact event hash fixture'
);
assertContains(
  kernelHashTestRel,
  kernelHashTest,
  '9073b1b5d4ad286466e853811c8adf481c708c898a5ab25876a0e1f5d3338343',
  'exact auth seed fixture'
);
assertContains(
  kernelHashTestRel,
  kernelHashTest,
  'blake3:0900af1d473ff5e33605a1b878a9378a4a7a5fa736a551bc24b0fc4a79bf22c4',
  'exact token id fixture'
);

const rulebookVerifierRel = 'apps/server/src/rulebook/verifyRulebook.ts';
const rulebookVerifier = read(rulebookVerifierRel);
assertNotContains(rulebookVerifierRel, rulebookVerifier, "@noble/hashes/blake3", 'local BLAKE3 import in rulebook verifier');
assertContains(rulebookVerifierRel, rulebookVerifier, '../../../../packages/shared/hashPrimitive.js', 'shared BLAKE3 primitive import in rulebook verifier');
assertContains(rulebookVerifierRel, rulebookVerifier, 'blake3HexBytes', 'shared byte-hex hash use in rulebook verifier');

const rulebookGenesisRel = 'apps/server/tools/genesis-rulebook.ts';
const rulebookGenesis = read(rulebookGenesisRel);
assertNotContains(rulebookGenesisRel, rulebookGenesis, '@noble/hashes/blake3', 'local BLAKE3 import in rulebook genesis generator');
assertNotContains(rulebookGenesisRel, rulebookGenesis, '@noble/hashes/sha2', 'local SHA-512 import in rulebook genesis generator');
assertNotContains(rulebookGenesisRel, rulebookGenesis, 'fast-json-stable-stringify', 'local stable stringify import in rulebook genesis generator');
assertNotContains(rulebookGenesisRel, rulebookGenesis, 'stringify(manifest)', 'stale direct stable stringify manifest write in rulebook genesis generator');
assertContains(rulebookGenesisRel, rulebookGenesis, '../../../packages/shared/hashPrimitive.js', 'shared BLAKE3 primitive import in rulebook genesis generator');
assertContains(rulebookGenesisRel, rulebookGenesis, 'blake3Bytes', 'shared byte hash use in rulebook genesis generator');
assertContains(rulebookGenesisRel, rulebookGenesis, 'canonicalJson', 'shared canonical JSON use in rulebook genesis generator');
assertContains(rulebookGenesisRel, rulebookGenesis, 'canonicalJson(manifest)', 'shared canonical JSON manifest write');
assertContains(rulebookGenesisRel, rulebookGenesis, 'crypto.createHash("sha512")', 'Node built-in SHA-512 ed25519 configuration');

const persistHashRel = 'apps/server/src/persist/hash.ts';
const persistHash = read(persistHashRel);
assertContains(persistHashRel, persistHash, 'openHashPrimitive', 'server receipt hashing can open Rust hash primitive');
assertContains(persistHashRel, persistHash, "process.env.CHRONICLE_NATIVE !== '0'", 'receipt hash native rollback flag');
assertContains(persistHashRel, persistHash, 'receiptHashBackendMode', 'receipt hash backend observability');
assertContains(persistHashRel, persistHash, 'native?.blake3HexUtf8(canonical)', 'receipt hash prefers native Rust hash primitive');
assertContains(persistHashRel, persistHash, 'blake3HexUtf8(canonical)', 'receipt hash TS fallback remains available');
assertContains(persistHashRel, persistHash, 'export function hashUtf8Hex(value: string): string', 'server derived-ID hash helper export');
assertContains(persistHashRel, persistHash, 'getNativeHashPrimitive()?.blake3HexUtf8(value) ?? blake3HexUtf8(value)', 'server derived-ID hash prefers native Rust primitive');

const materializersRel = 'apps/server/src/persist/materializers.ts';
const materializers = read(materializersRel);
assertNotContains(materializersRel, materializers, "../../../../packages/shared/hashPrimitive.js", 'direct shared TS BLAKE3 import in receipt materializers');
assertContains(materializersRel, materializers, 'computeReceiptHash, hashUtf8Hex', 'receipt materializer uses server hash helper import');
assertContains(materializersRel, materializers, 'return hashUtf8Hex(input).slice(0, 32)', 'item IDs use native-preferred server hash helper');

const napiRel = 'crates/chronicle/src/napi_binding.rs';
const napiBinding = read(napiRel);
assertContains(napiRel, napiBinding, 'canonical_json_string', 'Rust N-API canonical JSON export');
assertContains(napiRel, napiBinding, 'blake3_hex_utf8', 'Rust N-API BLAKE3 export');
assertContains(napiRel, napiBinding, 'blake3_hex_bytes', 'Rust N-API byte BLAKE3 export');

const chronicleAdapterSmokeRel = 'apps/server/tools/chronicle-adapter-smoke.ts';
const chronicleAdapterSmoke = read(chronicleAdapterSmokeRel);
assertContains(chronicleAdapterSmokeRel, chronicleAdapterSmoke, 'CHRONICLE_NATIVE=0 fails closed with no server CLI fallback', 'adapter smoke native-disabled fail-closed test');
assertContains(chronicleAdapterSmokeRel, chronicleAdapterSmoke, 'CHRONICLE_ALLOW_CLI_FALLBACK=1 is ignored by server runtime', 'adapter smoke rejects server fallback opt-in');
assertContains(chronicleAdapterSmokeRel, chronicleAdapterSmoke, 'server runtime has no CLI fallback', 'adapter smoke no server fallback error');
assertContains(chronicleAdapterSmokeRel, chronicleAdapterSmoke, "process.env.CHRONICLE_ALLOW_CLI_FALLBACK = '1'", 'adapter smoke sets explicit CLI fallback flag');
assertNotContains(chronicleAdapterSmokeRel, chronicleAdapterSmoke, 'explicitly enables CLI fallback mode', 'obsolete adapter smoke fallback enablement test');
assertNotContains(chronicleAdapterSmokeRel, chronicleAdapterSmoke, 'forced CLI fallback appends and verifies a chain', 'obsolete server runtime fallback append test');
assertContains(chronicleAdapterSmokeRel, chronicleAdapterSmoke, 'blake3HexBytes', 'native byte BLAKE3 smoke parity');
assertContains(chronicleAdapterSmokeRel, chronicleAdapterSmoke, 'BLAKE3 byte mismatch', 'native byte BLAKE3 mismatch guard');
assertContains(chronicleAdapterSmokeRel, chronicleAdapterSmoke, 'receiptHashBackendMode', 'receipt hash native/fallback smoke mode proof');
assertContains(chronicleAdapterSmokeRel, chronicleAdapterSmoke, 'Receipt hash mismatch across native/fallback', 'receipt hash fallback parity guard');
assertContains(chronicleAdapterSmokeRel, chronicleAdapterSmoke, 'materialized item IDs prefer native Rust', 'item ID native/fallback smoke test');
assertContains(chronicleAdapterSmokeRel, chronicleAdapterSmoke, 'Item ID mismatch across native/fallback', 'item ID fallback parity guard');

const mapCanvasRel = 'apps/debug-client/src/components/MapCanvas.tsx';
const mapCanvas = read(mapCanvasRel);
assertContains(mapCanvasRel, mapCanvas, 'creature__rookguard_training_slime.png?url', 'source sprite import for training slime');
assertContains(mapCanvasRel, mapCanvas, 'ROOKGUARD_TRAINING_SLIME_SPRITE_ID', 'server sprite id bridge');
assertNotContains(mapCanvasRel, mapCanvas, 'drawRookguardTrainingSlime', 'obsolete inline slime renderer');
assertNotContains(mapCanvasRel, mapCanvas, 'ctx.ellipse(cx, cy, 12, 9', 'obsolete inline slime body drawing');

const slimeManifestRel = 'data/assets-src/sprites/creature__rookguard_training_slime.json';
const slimeManifest = readJson(slimeManifestRel);
if (slimeManifest) {
  if (slimeManifest.asset_id !== 'akalynth_creature_rookguard_training_slime_001') {
    fail(`${slimeManifestRel}: unexpected asset_id ${slimeManifest.asset_id}`);
  }
  if (slimeManifest.asset_type !== 'creature') fail(`${slimeManifestRel}: asset_type must be creature`);
  assertTilemapTested(slimeManifestRel, slimeManifest, 'akalynth_creature_rookguard_training_slime_001');
  if (slimeManifest.background !== 'transparent') fail(`${slimeManifestRel}: background must be transparent`);
  if (slimeManifest.mechanics !== null) fail(`${slimeManifestRel}: mechanics must be null`);
  assertArrayEq(`${slimeManifestRel}: dimensions_px`, slimeManifest.dimensions_px, [32, 32]);
  assertArrayEq(`${slimeManifestRel}: dimensions_target_px`, slimeManifest.dimensions_target_px, [32, 32]);

  const pngRel = slimeManifest.cleaned_file;
  if (typeof pngRel !== 'string' || !existsSync(abs(pngRel))) {
    fail(`${slimeManifestRel}: cleaned_file missing ${pngRel}`);
  } else {
    const sha = createHash('sha256').update(readFileSync(abs(pngRel))).digest('hex');
    if (slimeManifest.sha256 !== sha) {
      fail(`${slimeManifestRel}: sha256 mismatch (manifest ${slimeManifest.sha256}, actual ${sha})`);
    }
  }

  if (typeof slimeManifest.prompt_file !== 'string' || !existsSync(abs(slimeManifest.prompt_file))) {
    fail(`${slimeManifestRel}: prompt_file missing ${slimeManifest.prompt_file}`);
  }
}

const packRel = 'data/assets-src/packs/rookguard-starter-v1.json';
const pack = readJson(packRel);
if (pack) {
  const slime = Array.isArray(pack.assets)
    ? pack.assets.find((asset) => asset.id === 'akalynth_creature_rookguard_training_slime_001')
    : null;
  if (!slime) fail(`${packRel}: missing training slime pack entry`);
  else assertTilemapTested(packRel, slime, 'akalynth_creature_rookguard_training_slime_001');
}

if (errors.length > 0) {
  console.error(`\nX verify:web-rust-cleanup - ${errors.length} problem(s):`);
  for (const error of errors) console.error(`  - ${error}`);
  process.exit(1);
}

console.log('✓ verify:web-rust-cleanup - old web/Rust paths removed and guarded');
