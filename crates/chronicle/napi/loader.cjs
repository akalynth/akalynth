'use strict';
/**
 * Uniform witness API backed by the in-process napi addon, with an explicit CLI fallback.
 *
 * `openChronicle()` is the native migration seam: open once, then `.append()` per event. Prefer the
 * native addon by default; set `preferNative: false` and `allowCliFallback: true` only for offline
 * auditor/demo tooling that deliberately needs the CLI fallback.
 *
 *   const { openChronicle } = require('.../crates/chronicle/napi/loader.cjs');
 *   const chron = openChronicle({ logPath, keyPath, binPath });
 *   const receipt = chron.append({ tick, event_type, actor, ... });   // native: in-process, O(1)
 *   const result  = chron.verify();
 *
 * Resolves the prebuilt addon (CHRONICLE_NATIVE_PATH or ./chronicle-native.node). If absent, fails
 * closed unless CLI fallback was explicitly allowed.
 */
const path = require('node:path');
const fs = require('node:fs');
const { spawnSync } = require('node:child_process');

function loadNative() {
  const candidates = [process.env.CHRONICLE_NATIVE_PATH, path.join(__dirname, 'chronicle-native.node')].filter(Boolean);
  for (const p of candidates) {
    try {
      if (fs.existsSync(p)) return require(p);
    } catch {
      /* try next */
    }
  }
  return null;
}

function normalizeReceipt(receipt) {
  if (!receipt || typeof receipt !== 'object') return receipt;
  return {
    prev_hash: receipt.prev_hash ?? receipt.prevHash,
    event_hash: receipt.event_hash ?? receipt.eventHash,
    signature: receipt.signature,
    root: receipt.root,
    sequence: receipt.sequence,
  };
}

function normalizeVerify(result) {
  if (!result || typeof result !== 'object') return result;
  return {
    valid: result.valid,
    entries: result.entries,
    root: result.root,
    pubkey: result.pubkey ?? result.public_key_hex ?? result.publicKeyHex,
  };
}

function toBuffer(value) {
  if (Buffer.isBuffer(value)) return value;
  if (value instanceof Uint8Array) return Buffer.from(value.buffer, value.byteOffset, value.byteLength);
  if (Array.isArray(value)) return Buffer.from(value);
  throw new TypeError('blake3HexBytes expects Buffer, Uint8Array, or byte array');
}

function openChronicle({ logPath, keyPath, binPath, preferNative = true, allowCliFallback = false } = {}) {
  if (!logPath || !keyPath) throw new Error('openChronicle: logPath and keyPath are required');

  const native = preferNative ? loadNative() : null;
  if (native?.ChronicleHandle) {
    const handle = native.ChronicleHandle.open(logPath, keyPath);
    return {
      mode: 'native',
      append: (event) => normalizeReceipt(handle.append(typeof event === 'string' ? event : JSON.stringify(event))),
      verify: () => normalizeVerify(handle.verify()),
      get sequence() {
        return handle.sequence;
      },
    };
  }

  if (!allowCliFallback) {
    throw new Error('chronicle: native addon unavailable and CLI fallback is not enabled');
  }

  const bin = binPath || process.env.CHRONICLE_BIN;
  if (!bin) throw new Error('chronicle: CLI fallback enabled but no CHRONICLE_BIN was provided');
  return {
    mode: 'cli-fallback',
    append: (event) => {
      const input = typeof event === 'string' ? event : JSON.stringify(event);
      const proc = spawnSync(bin, ['--log', logPath, '--key', keyPath], { input, encoding: 'utf8' });
      if (proc.status !== 0) throw new Error(`chronicle_append failed: ${proc.stderr?.trim() || '(no stderr)'}`);
      return normalizeReceipt(JSON.parse(proc.stdout.trim()));
    },
    verify: () => {
      const proc = spawnSync(bin, ['--verify', '--log', logPath, '--key', keyPath], { encoding: 'utf8' });
      if (proc.status !== 0) throw new Error(`chronicle verify failed: ${proc.stderr?.trim() || '(no stderr)'}`);
      return normalizeVerify(JSON.parse(proc.stdout.trim()));
    },
  };
}

function openHashPrimitive({ preferNative = true } = {}) {
  const native = preferNative ? loadNative() : null;
  const canonicalJsonString = native?.canonicalJsonString ?? native?.canonical_json_string;
  const blake3HexUtf8 = native?.blake3HexUtf8 ?? native?.blake3_hex_utf8;
  const blake3HexBytes = native?.blake3HexBytes ?? native?.blake3_hex_bytes;
  if (
    typeof canonicalJsonString !== 'function' ||
    typeof blake3HexUtf8 !== 'function' ||
    typeof blake3HexBytes !== 'function'
  ) return null;

  return {
    mode: 'native',
    canonicalJson: (value) => canonicalJsonString(typeof value === 'string' ? value : JSON.stringify(value)),
    blake3HexUtf8: (value) => blake3HexUtf8(String(value)),
    blake3HexBytes: (value) => blake3HexBytes(toBuffer(value)),
  };
}

module.exports = { openChronicle, openHashPrimitive, loadNative };
