/**
 * Chronicle Adapter — Server-side witness integration
 *
 * Provides a feature-flagged interface to the Rust chronicle kernel.
 * When disabled (default), all calls are no-ops returning null.
 *
 * Environment variables:
 *   ENABLE_CHRONICLE=1      Enable witnessing (default: disabled)
 *   CHRONICLE_LOG_PATH      Path to chronicle log file (default: chronicle.log)
 *   CHRONICLE_KEY_PATH      Path to Ed25519 signing key (default: chronicle.key)
 *   CHRONICLE_NATIVE=0      Disable in-process N-API preference (default: prefer native)
 *   CHRONICLE_NATIVE_PATH   Optional explicit path to chronicle-native.node
 *
 * Usage:
 *   import { chronicleAppend, isChronicleEnabled } from './witness/chronicleAdapter.js';
 *
 *   if (isChronicleEnabled()) {
 *     const receipt = chronicleAppend({ tick, event_type: 'spawn', ... });
 *   }
 */
import { existsSync } from 'node:fs';
import { createRequire } from 'node:module';
import { resolve } from 'node:path';
const require = createRequire(import.meta.url);
let chronicleHandle = null;
const chronicleFailedKeys = new Set();
function uniquePaths(paths) {
    return [...new Set(paths.filter((p) => Boolean(p)))];
}
function repoRootCandidates() {
    return uniquePaths([
        process.env.AKALYNTH_SOURCE_REPO,
        resolve(process.cwd(), '../..'),
        process.cwd(),
        // apps/server/src/witness -> repo root in source; dist/server/apps/server/src/witness -> dist/server.
        resolve(import.meta.dirname, '../../../..'),
    ]);
}
function findRepoFile(relativePath) {
    const candidates = repoRootCandidates().map((root) => resolve(root, relativePath));
    for (const p of candidates) {
        if (existsSync(p))
            return p;
    }
    // Fall back to the first candidate so error messages and smoke tests stay deterministic.
    return candidates[0];
}
/**
 * Get the default path to chronicle log file
 */
function defaultLogPath() {
    return process.env.CHRONICLE_LOG_PATH ?? 'chronicle.log';
}
/**
 * Get the default path to signing key
 */
function defaultKeyPath() {
    return process.env.CHRONICLE_KEY_PATH ?? 'chronicle.key';
}
/**
 * Check if chronicle witnessing is enabled
 */
export function isChronicleEnabled() {
    return process.env.ENABLE_CHRONICLE === '1';
}
function shouldPreferNativeChronicle() {
    return process.env.CHRONICLE_NATIVE !== '0';
}
function getChronicleHandle(logPath, keyPath) {
    const preferNative = shouldPreferNativeChronicle();
    const cacheKey = `${logPath}\0${keyPath}\0${preferNative ? 'native' : 'disabled-native'}`;
    if (chronicleHandle?.key === cacheKey)
        return chronicleHandle.handle;
    if (chronicleFailedKeys.has(cacheKey))
        return null;
    try {
        const { openChronicle } = require(findRepoFile('crates/chronicle/napi/loader.cjs'));
        const handle = openChronicle({ logPath, keyPath, preferNative, allowCliFallback: false });
        chronicleHandle = { key: cacheKey, handle };
        return handle;
    }
    catch (err) {
        chronicleFailedKeys.add(cacheKey);
        console.warn(`chronicle: Rust loader unavailable (${err.message})`);
        return null;
    }
}
function resolvedOptions(opts) {
    return {
        logPath: opts.logPath ?? defaultLogPath(),
        keyPath: opts.keyPath ?? defaultKeyPath(),
    };
}
/**
 * Eagerly open the Chronicle backend once during server boot.
 *
 * This is intentionally mode-only: it proves which backend is active without
 * appending an event or mutating the log. Key creation follows the same behavior
 * as the first append, only earlier in process lifetime.
 */
export function initChronicleBackend(opts = {}) {
    if (!isChronicleEnabled())
        return 'disabled';
    const { logPath, keyPath } = resolvedOptions(opts);
    return getChronicleHandle(logPath, keyPath)?.mode ?? 'unavailable';
}
/**
 * Append an event to the chronicle log
 *
 * When ENABLE_CHRONICLE is not set to "1", returns null (no-op).
 * When enabled, appends through the long-lived Rust loader handle. The loader
 * prefers the in-process N-API addon and fails closed when it is unavailable.
 * The old CLI auditor path is intentionally not reachable from server runtime.
 *
 * @param event - Any JSON-serializable event object
 * @param opts - Optional configuration overrides
 * @returns Receipt on success, null if disabled, throws on error
 */
export function chronicleAppend(event, opts = {}) {
    const enabled = isChronicleEnabled();
    // If disabled and not strict, silently return null
    if (!enabled && !opts.strict) {
        return null;
    }
    const { logPath, keyPath } = resolvedOptions(opts);
    const handle = getChronicleHandle(logPath, keyPath);
    if (handle)
        return handle.append(event);
    throw new Error('chronicle native backend unavailable');
}
/**
 * Verify the integrity of a chronicle log
 *
 * @param opts - Optional configuration overrides
 * @returns Verification result JSON string, or null if disabled
 */
export function chronicleVerify(opts = {}) {
    if (!isChronicleEnabled()) {
        return null;
    }
    const { logPath, keyPath } = resolvedOptions(opts);
    const handle = getChronicleHandle(logPath, keyPath);
    if (handle)
        return JSON.stringify(handle.verify());
    throw new Error('chronicle native backend unavailable');
}
