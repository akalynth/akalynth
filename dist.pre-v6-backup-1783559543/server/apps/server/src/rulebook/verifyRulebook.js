// apps/server/src/rulebook/verifyRulebook.ts
//
// Seal 1 PR B — Rulebook Verification Gate
//
// Recomputes Merkle root from rulebook/{dsl,params,invariants} and compares
// to rulebook/compiled/RULEBOOK_ROOT.txt. Exits process on mismatch.
//
// This uses the EXACT same algorithm as genesis-rulebook.ts to ensure
// computed roots always match when inputs are identical.
import fs from 'node:fs';
import path from 'node:path';
import { blake3Bytes, blake3HexBytes } from '../../../../packages/shared/hashPrimitive.js';
function findRepoRoot(startDir) {
    let cur = path.resolve(startDir);
    while (true) {
        const rulebook = path.resolve(cur, 'rulebook');
        if (fs.existsSync(rulebook)) {
            const hasSources = fs.existsSync(path.resolve(rulebook, 'dsl')) &&
                fs.existsSync(path.resolve(rulebook, 'params')) &&
                fs.existsSync(path.resolve(rulebook, 'invariants'));
            if (hasSources)
                return cur;
        }
        const next = path.dirname(cur);
        if (next === cur)
            return null;
        cur = next;
    }
}
const repoRoot = findRepoRoot(process.cwd()) ??
    findRepoRoot(import.meta.dirname) ??
    path.resolve(import.meta.dirname, '../../../../');
const rulebookDir = path.resolve(repoRoot, 'rulebook');
const compiledDir = path.resolve(rulebookDir, 'compiled');
const compiledRootPath = path.resolve(compiledDir, 'RULEBOOK_ROOT.txt');
const INPUT_DIRS = ['dsl', 'params', 'invariants'];
function listFilesRecursively(baseDir) {
    if (!fs.existsSync(baseDir))
        return [];
    const out = [];
    const stack = [baseDir];
    while (stack.length) {
        const cur = stack.pop();
        const entries = fs.readdirSync(cur, { withFileTypes: true });
        for (const ent of entries) {
            const full = path.join(cur, ent.name);
            if (ent.isDirectory())
                stack.push(full);
            else if (ent.isFile())
                out.push(full);
        }
    }
    return out;
}
function blake3FileHex(absPath) {
    return blake3HexBytes(fs.readFileSync(absPath));
}
// Merkle leaf: BLAKE3("leaf\0" + path + "\0" + file_hash_bytes)
function merkleLeaf(pathUtf8, fileHashHex) {
    const fileHashBytes = Buffer.from(fileHashHex, 'hex');
    const prefix = Buffer.from('leaf\0', 'utf8');
    const mid = Buffer.from(pathUtf8, 'utf8');
    const sep = Buffer.from('\0', 'utf8');
    const msg = Buffer.concat([prefix, mid, sep, fileHashBytes]);
    return blake3Bytes(msg);
}
// Merkle node: BLAKE3("node\0" + left + right)
function merkleNode(left, right) {
    const prefix = Buffer.from('node\0', 'utf8');
    const msg = Buffer.concat([prefix, Buffer.from(left), Buffer.from(right)]);
    return blake3Bytes(msg);
}
function computeRulebookRoot() {
    const files = [];
    for (const d of INPUT_DIRS) {
        const absBase = path.resolve(rulebookDir, d);
        const all = listFilesRecursively(absBase);
        for (const abs of all) {
            const relFromRulebook = path.relative(rulebookDir, abs).replaceAll(path.sep, '/');
            if (relFromRulebook.startsWith('compiled/'))
                continue;
            files.push({ rel: relFromRulebook, abs });
        }
    }
    // Sort deterministically (same as genesis-rulebook.ts)
    files.sort((a, b) => a.rel.localeCompare(b.rel));
    const entries = files.map((f) => ({
        path: f.rel,
        hash: `blake3:${blake3FileHex(f.abs)}`,
    }));
    if (entries.length === 0) {
        // Empty rulebook: deterministic empty root
        return { root: `blake3:${blake3HexBytes(Buffer.from('node\0', 'utf8'))}`, fileCount: 0 };
    }
    // Build initial leaves
    let level = entries.map((e) => merkleLeaf(e.path, e.hash.replace(/^blake3:/, '')));
    // Reduce to root (duplicate last on odd count)
    while (level.length > 1) {
        if (level.length % 2 === 1) {
            level.push(level[level.length - 1]);
        }
        const next = [];
        for (let i = 0; i < level.length; i += 2) {
            next.push(merkleNode(level[i], level[i + 1]));
        }
        level = next;
    }
    return {
        root: `blake3:${Buffer.from(level[0]).toString('hex')}`,
        fileCount: entries.length,
    };
}
/**
 * Verifies the rulebook integrity at server startup.
 * If verification fails, prints an error and exits the process.
 *
 * @returns The verified rulebook root hash
 */
export function verifyRulebookOrExit() {
    // Check compiled root exists
    if (!fs.existsSync(compiledRootPath)) {
        console.error('');
        console.error('╔══════════════════════════════════════════════════════════════╗');
        console.error('║  FATAL: Rulebook not found                                   ║');
        console.error('╠══════════════════════════════════════════════════════════════╣');
        console.error('║  Missing: rulebook/compiled/RULEBOOK_ROOT.txt                ║');
        console.error('║                                                              ║');
        console.error('║  Run: npm run rulebook:genesis                               ║');
        console.error('╚══════════════════════════════════════════════════════════════╝');
        console.error('');
        process.exit(1);
    }
    const compiledRoot = fs.readFileSync(compiledRootPath, 'utf8').trim();
    const { root: computedRoot, fileCount } = computeRulebookRoot();
    if (compiledRoot !== computedRoot) {
        console.error('');
        console.error('╔══════════════════════════════════════════════════════════════╗');
        console.error('║  FATAL: Rulebook tampered or out of sync                     ║');
        console.error('╠══════════════════════════════════════════════════════════════╣');
        console.error(`║  Compiled: ${compiledRoot}`);
        console.error(`║  Computed: ${computedRoot}`);
        console.error(`║  Files scanned: ${fileCount}`);
        console.error('║                                                              ║');
        console.error('║  Run: npm run rulebook:genesis                               ║');
        console.error('╚══════════════════════════════════════════════════════════════╝');
        console.error('');
        process.exit(1);
    }
    console.log(`[rulebook] Verified: ${compiledRoot} (${fileCount} files)`);
    return { rulebookRoot: compiledRoot };
}
