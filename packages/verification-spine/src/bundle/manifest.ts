/**
 * Bundle Manifest Parser
 *
 * Handles optional manifest.json validation for audit bundles.
 */

import type { BundleFS } from '../types.js';
import type { VerifyFinding } from '../types.js';

export interface BundleManifest {
  bundleVersion: string;
  generatedAt: string;
  files: Array<{
    path: string;
    hash: string;
  }>;
  meta?: {
    protocolVersion?: string;
    commit?: string;
    repoUrl?: string;
    [key: string]: unknown;
  };
}

/**
 * Load and validate bundle manifest (optional presence)
 *
 * Returns:
 * - manifest + null finding if valid
 * - null + info finding if missing (allowed in MVP)
 * - null + error finding if invalid
 */
export function loadBundleManifest(
  fs: BundleFS
): { manifest: BundleManifest | null; finding: VerifyFinding | null } {
  // Check if manifest exists
  if (!fs.exists('manifest.json')) {
    return {
      manifest: null,
      finding: {
        code: 'BUNDLE_MANIFEST_MISSING',
        severity: 'info',
        message: 'Bundle manifest.json not found (optional in MVP)',
        hint: 'Consider adding manifest.json with bundleVersion, generatedAt, and files list',
      },
    };
  }

  // Load and validate manifest
  let manifest: unknown;
  try {
    manifest = fs.readJson('manifest.json');
  } catch (err: any) {
    return {
      manifest: null,
      finding: {
        code: 'BUNDLE_MANIFEST_INVALID',
        severity: 'error',
        message: `Failed to parse manifest.json: ${err.message}`,
      },
    };
  }

  // Validate schema
  if (typeof manifest !== 'object' || manifest === null) {
    return {
      manifest: null,
      finding: {
        code: 'BUNDLE_MANIFEST_INVALID',
        severity: 'error',
        message: 'manifest.json must be a JSON object',
      },
    };
  }

  const m = manifest as Record<string, unknown>;

  if (m.bundleVersion !== '1') {
    return {
      manifest: null,
      finding: {
        code: 'BUNDLE_MANIFEST_INVALID',
        severity: 'error',
        message: `Unsupported bundleVersion: ${m.bundleVersion} (expected "1")`,
      },
    };
  }

  if (typeof m.generatedAt !== 'string') {
    return {
      manifest: null,
      finding: {
        code: 'BUNDLE_MANIFEST_INVALID',
        severity: 'error',
        message: 'manifest.json missing or invalid generatedAt field',
      },
    };
  }

  if (!Array.isArray(m.files)) {
    return {
      manifest: null,
      finding: {
        code: 'BUNDLE_MANIFEST_INVALID',
        severity: 'error',
        message: 'manifest.json missing or invalid files array',
      },
    };
  }

  // Validate files array structure (basic check)
  for (const file of m.files) {
    if (typeof file !== 'object' || file === null) {
      return {
        manifest: null,
        finding: {
          code: 'BUNDLE_MANIFEST_INVALID',
          severity: 'error',
          message: 'manifest.json files array contains invalid entry',
        },
      };
    }

    const f = file as Record<string, unknown>;
    if (typeof f.path !== 'string' || typeof f.hash !== 'string') {
      return {
        manifest: null,
        finding: {
          code: 'BUNDLE_MANIFEST_INVALID',
          severity: 'error',
          message: 'manifest.json file entry missing path or hash',
        },
      };
    }
  }

  // Valid manifest
  return {
    manifest: m as unknown as BundleManifest,
    finding: null,
  };
}
