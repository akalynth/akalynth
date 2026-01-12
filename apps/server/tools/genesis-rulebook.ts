// apps/server/tools/genesis-rulebook.ts
//
// Seal 1 PR A — Rulebook Scaffold + Genesis Generator
//
// Deterministically computes:
// - RULEBOOK.manifest.json
// - RULEBOOK_ROOT.txt
// - GENESIS.json
// - GENESIS.sig
//
// Inputs (hashed as raw bytes, sorted by path):
//   rulebook/dsl/**
//   rulebook/params/**
//   rulebook/invariants/**
//
// Merkle spec:
//   leaf = BLAKE3("leaf\0" + path_utf8 + "\0" + file_hash_bytes)
//   node = BLAKE3("node\0" + left + right)
//   odd leaf count => duplicate last
//
// Notes on determinism:
// - RULEBOOK_ROOT is deterministic for same inputs.
// - GENESIS.json can be made deterministic by setting GENESIS_TIME_UTC or SOURCE_DATE_EPOCH.
//   If neither is set, created_at defaults to now (non-deterministic but signed).
//
// Key handling (dev-only):
// - operator.key is created if missing under rulebook/compiled/operator.key (hex, 32 bytes).
// - This file MUST be gitignored.

import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import stringify from "fast-json-stable-stringify";
import * as ed from "@noble/ed25519";
import { sha512 } from "@noble/hashes/sha2";
import { blake3 } from "@noble/hashes/blake3";

// Configure @noble/ed25519 to use SHA-512 from @noble/hashes
// This is required before calling getPublicKey/sign
ed.hashes.sha512 = (m: Uint8Array) => sha512(m);

type ManifestEntry = { path: string; hash: string };

type RulebookManifest = {
  version: 1;
  hash_alg: "blake3";
  entries: ManifestEntry[];
};

type Genesis = {
  version: 1;
  world_id: string;
  rulebook_root: string; // blake3:<hex>
  created_at: string; // ISO-8601 UTC
  operator: string; // ed25519 pubkey hex
  params: {
    tick_ms: number;
    max_move_speed: number;
    max_chat_rate: number;
  };
};

const WORLD_ID = "akalynth-mainnet";

// Repo root from apps/server/tools
const repoRoot = path.resolve(import.meta.dirname, "../../..");
const rulebookDir = path.resolve(repoRoot, "rulebook");
const compiledDir = path.resolve(rulebookDir, "compiled");

const operatorKeyPath = path.resolve(compiledDir, "operator.key");
const manifestPath = path.resolve(compiledDir, "RULEBOOK.manifest.json");
const rootPath = path.resolve(compiledDir, "RULEBOOK_ROOT.txt");
const genesisPath = path.resolve(compiledDir, "GENESIS.json");
const genesisSigPath = path.resolve(compiledDir, "GENESIS.sig");

const INPUT_DIRS = ["dsl", "params", "invariants"] as const;

function ensureDir(p: string) {
  fs.mkdirSync(p, { recursive: true });
}

function isFile(p: string): boolean {
  try {
    return fs.statSync(p).isFile();
  } catch {
    return false;
  }
}

function listFilesRecursively(baseDir: string): string[] {
  if (!fs.existsSync(baseDir)) return [];
  const out: string[] = [];
  const stack: string[] = [baseDir];

  while (stack.length) {
    const cur = stack.pop()!;
    const entries = fs.readdirSync(cur, { withFileTypes: true });
    for (const ent of entries) {
      const full = path.join(cur, ent.name);
      if (ent.isDirectory()) stack.push(full);
      else if (ent.isFile()) out.push(full);
    }
  }
  return out;
}

// Hash raw bytes of file with BLAKE3, return hex string (no prefix).
function blake3FileHex(absPath: string): string {
  const bytes = fs.readFileSync(absPath);
  const digest = blake3(bytes);
  return Buffer.from(digest).toString("hex");
}

// Merkle leaf: BLAKE3("leaf\0" + path + "\0" + file_hash_bytes)
function merkleLeaf(pathUtf8: string, fileHashHex: string): Uint8Array {
  const fileHashBytes = Buffer.from(fileHashHex, "hex");
  const prefix = Buffer.from("leaf\0", "utf8");
  const mid = Buffer.from(pathUtf8, "utf8");
  const sep = Buffer.from("\0", "utf8");
  const msg = Buffer.concat([prefix, mid, sep, fileHashBytes]);
  return blake3(msg);
}

// Merkle node: BLAKE3("node\0" + left + right)
function merkleNode(left: Uint8Array, right: Uint8Array): Uint8Array {
  const prefix = Buffer.from("node\0", "utf8");
  const msg = Buffer.concat([prefix, Buffer.from(left), Buffer.from(right)]);
  return blake3(msg);
}

function merkleRootFromEntries(entries: ManifestEntry[]): string {
  if (entries.length === 0) {
    // Define empty root deterministically
    const empty = blake3(Buffer.from("node\0", "utf8"));
    return Buffer.from(empty).toString("hex");
  }

  // Build initial leaves
  let level: Uint8Array[] = entries.map((e) => merkleLeaf(e.path, e.hash.replace(/^blake3:/, "")));

  // Reduce
  while (level.length > 1) {
    if (level.length % 2 === 1) {
      level.push(level[level.length - 1]); // duplicate last
    }
    const next: Uint8Array[] = [];
    for (let i = 0; i < level.length; i += 2) {
      next.push(merkleNode(level[i], level[i + 1]));
    }
    level = next;
  }

  return Buffer.from(level[0]).toString("hex");
}

function canonicalJsonBytes(obj: unknown): Buffer {
  // fast-json-stable-stringify => sorted keys, no whitespace
  return Buffer.from(stringify(obj), "utf8");
}

function manifestHashHex(manifest: RulebookManifest): string {
  const bytes = canonicalJsonBytes(manifest);
  const digest = blake3(bytes);
  return Buffer.from(digest).toString("hex");
}

function getDeterministicGenesisTime(): string {
  const explicit = process.env.GENESIS_TIME_UTC;
  if (explicit && explicit.trim()) return explicit.trim();

  const sde = process.env.SOURCE_DATE_EPOCH;
  if (sde && sde.trim()) {
    const n = Number(sde);
    if (Number.isFinite(n) && n > 0) {
      return new Date(n * 1000).toISOString();
    }
  }

  // fallback: non-deterministic
  return new Date().toISOString();
}

function parseIntEnv(name: string, fallback: number, min: number): number {
  const v = process.env[name];
  if (!v) return fallback;
  const n = parseInt(v, 10);
  if (Number.isFinite(n) && n >= min) return n;
  return fallback;
}

function loadOrCreateOperatorKey(): Uint8Array {
  ensureDir(compiledDir);

  if (isFile(operatorKeyPath)) {
    const hex = fs.readFileSync(operatorKeyPath, "utf8").trim();
    const buf = Buffer.from(hex, "hex");
    if (buf.length !== 32) {
      throw new Error(`operator.key must be 32 bytes (64 hex chars). Got ${buf.length} bytes`);
    }
    return new Uint8Array(buf);
  }

  const priv = crypto.randomBytes(32);
  fs.writeFileSync(operatorKeyPath, priv.toString("hex") + "\n", { mode: 0o600 });
  return new Uint8Array(priv);
}

async function main() {
  // Ensure compiled dir exists
  ensureDir(compiledDir);

  // 1) Collect input files
  const files: { rel: string; abs: string }[] = [];

  for (const d of INPUT_DIRS) {
    const absBase = path.resolve(rulebookDir, d);
    const all = listFilesRecursively(absBase);

    for (const abs of all) {
      const relFromRulebook = path.relative(rulebookDir, abs).replaceAll(path.sep, "/");
      // Skip compiled outputs if someone accidentally places them in scope
      if (relFromRulebook.startsWith("compiled/")) continue;
      files.push({ rel: relFromRulebook, abs });
    }
  }

  // 2) Sort deterministically
  files.sort((a, b) => a.rel.localeCompare(b.rel));

  // 3) Hash each file (raw bytes)
  const entries: ManifestEntry[] = files.map((f) => ({
    path: f.rel,
    hash: `blake3:${blake3FileHex(f.abs)}`,
  }));

  const manifest: RulebookManifest = {
    version: 1,
    hash_alg: "blake3",
    entries,
  };

  // 4) Compute Merkle root
  const rootHex = merkleRootFromEntries(entries);
  const root = `blake3:${rootHex}`;

  // 5) Write manifest + root
  fs.writeFileSync(manifestPath, stringify(manifest) + "\n", "utf8");
  fs.writeFileSync(rootPath, root + "\n", "utf8");

  // 6) Create GENESIS.json
  const operatorPriv = loadOrCreateOperatorKey();
  const operatorPub = await ed.getPublicKey(operatorPriv);
  const operatorPubHex = Buffer.from(operatorPub).toString("hex");

  const tick_ms = parseIntEnv("AKALYNTH_TICK_MS", 100, 1);
  const max_move_speed = parseIntEnv("AKALYNTH_MAX_MOVE_SPEED", 6, 1);
  const max_chat_rate = parseIntEnv("AKALYNTH_MAX_CHAT_RATE", 4, 1);

  const genesis: Genesis = {
    version: 1,
    world_id: WORLD_ID,
    rulebook_root: root,
    created_at: getDeterministicGenesisTime(),
    operator: operatorPubHex,
    params: {
      tick_ms,
      max_move_speed,
      max_chat_rate,
    },
  };

  const genesisBytes = canonicalJsonBytes(genesis);

  // 7) Sign GENESIS.json bytes (canonical)
  const sig = await ed.sign(genesisBytes, operatorPriv);
  const sigHex = Buffer.from(sig).toString("hex");

  // Write GENESIS.json + GENESIS.sig
  fs.writeFileSync(genesisPath, genesisBytes.toString("utf8") + "\n", "utf8");
  fs.writeFileSync(genesisSigPath, sigHex + "\n", "utf8");

  // 8) Print summary for operator
  const mhash = `blake3:${manifestHashHex(manifest)}`;

  console.log("=== Seal 1: Rulebook Genesis Generated ===");
  console.log(`Rulebook dir: ${rulebookDir}`);
  console.log(`Compiled dir: ${compiledDir}`);
  console.log(`Manifest: ${manifestPath}`);
  console.log(`Manifest hash: ${mhash}`);
  console.log(`Rulebook root: ${root}`);
  console.log(`Genesis: ${genesisPath}`);
  console.log(`Genesis sig: ${genesisSigPath}`);
  console.log(`Operator pubkey (hex): ${operatorPubHex}`);
  console.log("");
  console.log("Determinism notes:");
  console.log("- RULEBOOK_ROOT is deterministic for same inputs.");
  console.log("- GENESIS.json is deterministic if GENESIS_TIME_UTC or SOURCE_DATE_EPOCH is set.");
}

main().catch((e) => {
  console.error("genesis-rulebook failed:", e?.stack || String(e));
  process.exit(1);
});
