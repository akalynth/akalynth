/**
 * Directory Bundle Filesystem Implementation
 *
 * Backs BundleFS interface with a directory containing audit bundle files.
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import type { BundleFS } from '../types.js';

/**
 * Directory-based bundle filesystem implementation
 */
export class DirBundleFS implements BundleFS {
  constructor(public readonly root: string) {
    // Verify bundle directory exists
    if (!fs.existsSync(root)) {
      throw new Error(`Bundle directory does not exist: ${root}`);
    }

    const stats = fs.statSync(root);
    if (!stats.isDirectory()) {
      throw new Error(`Bundle path is not a directory: ${root}`);
    }
  }

  readText(relPath: string): string {
    const absPath = this.resolve(relPath);
    try {
      return fs.readFileSync(absPath, 'utf-8');
    } catch (err: any) {
      throw new Error(`Failed to read ${relPath} from bundle: ${err.message}`);
    }
  }

  readJson<T = unknown>(relPath: string): T {
    const text = this.readText(relPath);
    try {
      return JSON.parse(text) as T;
    } catch (err: any) {
      throw new Error(`Failed to parse JSON from ${relPath} in bundle: ${err.message}`);
    }
  }

  exists(relPath: string): boolean {
    const absPath = this.resolve(relPath);
    try {
      const stats = fs.statSync(absPath);

      // If path ends with /, check it's a directory
      if (relPath.endsWith('/')) {
        return stats.isDirectory();
      }

      return true; // File or directory
    } catch {
      return false;
    }
  }

  resolve(...parts: string[]): string {
    // Prevent path traversal attacks
    const joined = path.join(...parts);
    if (joined.includes('..')) {
      throw new Error(`Path traversal not allowed in bundle: ${joined}`);
    }

    return path.join(this.root, joined);
  }
}
