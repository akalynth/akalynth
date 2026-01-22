/**
 * Bundle Integrity Verification
 *
 * Verifies that bundle contents match manifest.json (presence + hashes).
 * Implements fail-closed semantics for audit bundles.
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import { VerifyContext, VerifyResult, VerifyFinding, SpineOptions } from '../types.js';
import { loadBundleManifest, type BundleManifest } from './manifest.js';
import { parseHashString, verifyFileHash, type HashAlgorithm } from './hash.js';

/**
 * Verify bundle integrity (manifest + file hashes)
 *
 * This runs as a synthetic verifier ("bundle-integrity") before all other verifiers.
 * If verification fails, the spine should stop (fail-fast).
 */
export async function verifyBundleIntegrity(
  ctx: VerifyContext,
  opts: SpineOptions
): Promise<VerifyResult> {
  const startedAt = new Date().toISOString();
  const findings: VerifyFinding[] = [];

  // Determine manifest path
  const manifestPath = opts.bundleManifest || 'manifest.json';

  // Load and validate manifest
  const { manifest, finding } = loadBundleManifest(ctx.fs);

  if (finding) {
    if (finding.severity === 'error' || finding.code === 'BUNDLE_MANIFEST_MISSING') {
      // Manifest missing or invalid - fail immediately
      return {
        ok: false,
        verifierId: 'bundle-integrity',
        startedAt,
        finishedAt: new Date().toISOString(),
        findings: [
          {
            code: 'BUNDLE_VERIFY_MANIFEST_MISSING',
            severity: 'error',
            message: 'Bundle verification requested but no manifest.json was found.',
            hint: 'Add a manifest.json or remove --bundle-verify.',
          },
        ],
      };
    } else {
      findings.push(finding);
    }
  }

  if (!manifest) {
    return {
      ok: false,
      verifierId: 'bundle-integrity',
      startedAt,
      finishedAt: new Date().toISOString(),
      findings: [
        {
          code: 'BUNDLE_VERIFY_MANIFEST_INVALID',
          severity: 'error',
          message: 'Bundle manifest is invalid or could not be loaded.',
        },
      ],
    };
  }

  // Validate manifest schema
  const schemaErrors = validateManifestSchema(manifest);
  if (schemaErrors.length > 0) {
    return {
      ok: false,
      verifierId: 'bundle-integrity',
      startedAt,
      finishedAt: new Date().toISOString(),
      findings: schemaErrors,
    };
  }

  // Track hash algorithms used
  const algorithms = new Set<HashAlgorithm>();

  // Verify each file in manifest
  for (const entry of manifest.files) {
    // Validate path (no absolute paths, no traversal)
    if (!isValidBundlePath(entry.path)) {
      findings.push({
        code: 'BUNDLE_VERIFY_PATH_INVALID',
        severity: 'error',
        message: `Invalid bundle path: ${entry.path}`,
        hint: 'Paths must be relative and not traverse outside bundle root.',
        data: { path: entry.path },
      });
      continue;
    }

    // Check if file exists
    if (!ctx.fs.exists(entry.path)) {
      findings.push({
        code: 'BUNDLE_VERIFY_FILE_MISSING',
        severity: 'error',
        message: `File declared in manifest but not found: ${entry.path}`,
        hint: 'Bundle is incomplete or manifest is incorrect.',
        data: { path: entry.path },
      });
      continue;
    }

    // Parse and validate hash
    const parsedHash = parseHashString(entry.hash);
    if (!parsedHash) {
      findings.push({
        code: 'BUNDLE_HASH_UNSUPPORTED',
        severity: 'error',
        message: `Unsupported or invalid hash format for ${entry.path}: ${entry.hash}`,
        hint: 'Expected format: "sha256:<64 hex chars>" or "blake3:<64 hex chars>"',
        data: { path: entry.path, hash: entry.hash },
      });
      continue;
    }

    algorithms.add(parsedHash.algorithm);

    // Verify hash
    const absPath = ctx.fs.resolve(entry.path);
    const result = verifyFileHash(entry.hash, absPath);

    if (!result.ok) {
      findings.push({
        code: 'BUNDLE_HASH_MISMATCH',
        severity: 'error',
        message: `Hash mismatch for bundle file ${entry.path}.`,
        hint: 'Regenerate the bundle manifest or fix the bundle contents.',
        data: {
          expected: entry.hash,
          actual: result.actual,
        },
      });
    }
  }

  // Strict mode: check for undeclared files
  if (opts.bundleStrict) {
    const declaredPaths = new Set(manifest.files.map((f) => f.path));
    const extraFiles = findUndeclaredFiles(ctx.repoRoot, declaredPaths);

    if (extraFiles.length > 0) {
      findings.push({
        code: 'BUNDLE_STRICT_EXTRA_FILES',
        severity: 'error',
        message: 'Bundle contains files not declared in manifest.json.',
        hint: 'Remove undeclared files or add them to the manifest.',
        data: { extraFiles },
      });
    }
  }

  // Check if verification passed
  const errors = findings.filter((f) => f.severity === 'error');
  const ok = errors.length === 0;

  if (ok) {
    findings.push({
      code: 'BUNDLE_VERIFY_OK',
      severity: 'info',
      message: 'Bundle manifest validated and all file hashes verified.',
      data: {
        manifest: manifestPath,
        filesVerified: manifest.files.length,
        hashAlgorithms: Array.from(algorithms),
        strict: opts.bundleStrict ?? false,
      },
    });
  }

  return {
    ok,
    verifierId: 'bundle-integrity',
    startedAt,
    finishedAt: new Date().toISOString(),
    findings,
  };
}

/**
 * Validate manifest schema
 */
function validateManifestSchema(manifest: BundleManifest): VerifyFinding[] {
  const findings: VerifyFinding[] = [];

  if (manifest.bundleVersion !== '1') {
    findings.push({
      code: 'BUNDLE_VERIFY_MANIFEST_INVALID',
      severity: 'error',
      message: `Unsupported bundle version: ${manifest.bundleVersion}`,
      hint: 'Only bundleVersion "1" is supported.',
    });
  }

  if (!manifest.files || manifest.files.length === 0) {
    findings.push({
      code: 'BUNDLE_VERIFY_MANIFEST_INVALID',
      severity: 'error',
      message: 'Manifest has no files declared.',
    });
  }

  // Check for duplicate paths
  const paths = manifest.files.map((f) => f.path);
  const uniquePaths = new Set(paths);
  if (paths.length !== uniquePaths.size) {
    findings.push({
      code: 'BUNDLE_VERIFY_MANIFEST_INVALID',
      severity: 'error',
      message: 'Manifest contains duplicate file paths.',
    });
  }

  return findings;
}

/**
 * Validate bundle path (no absolute paths, no traversal)
 */
function isValidBundlePath(relPath: string): boolean {
  // No absolute paths
  if (path.isAbsolute(relPath)) return false;

  // No ".." segments (traversal)
  const normalized = path.normalize(relPath);
  if (normalized.includes('..')) return false;

  return true;
}

/**
 * Find undeclared files in bundle (for strict mode)
 *
 * Ignores:
 * - manifest.json
 * - verify-out/**
 * - .DS_Store
 * - Thumbs.db
 */
function findUndeclaredFiles(bundleRoot: string, declaredPaths: Set<string>): string[] {
  const extraFiles: string[] = [];
  const ignorePatterns = ['manifest.json', 'verify-out', '.DS_Store', 'Thumbs.db'];

  function walkDir(dir: string, relativePath: string = '') {
    const entries = fs.readdirSync(dir, { withFileTypes: true });

    for (const entry of entries) {
      const entryRelPath = relativePath ? `${relativePath}/${entry.name}` : entry.name;

      // Check ignore patterns
      if (ignorePatterns.includes(entry.name)) continue;
      if (entryRelPath.startsWith('verify-out/')) continue;

      if (entry.isDirectory()) {
        walkDir(path.join(dir, entry.name), entryRelPath);
      } else {
        // File not in declared set
        if (!declaredPaths.has(entryRelPath)) {
          extraFiles.push(entryRelPath);
        }
      }
    }
  }

  walkDir(bundleRoot);
  return extraFiles;
}
