import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import * as path from 'node:path';
export const UNKNOWN_BUILD_INFO = {
    commit: 'unknown',
    commit_short: 'unknown',
    built_at: 'unknown',
    ref: 'unknown',
};
/**
 * Resolve BUILD_INFO.json. Honors AKALYNTH_BUILD_INFO_PATH; otherwise looks at
 * the build-output root (dist/server/BUILD_INFO.json) relative to this compiled
 * module (dist/server/apps/server/src/build-info.js).
 */
function buildInfoPath() {
    const override = process.env.AKALYNTH_BUILD_INFO_PATH;
    if (override)
        return override;
    const here = path.dirname(fileURLToPath(import.meta.url));
    return path.resolve(here, '../../../BUILD_INFO.json');
}
/**
 * Load build provenance. Never throws: a missing or malformed file degrades to
 * UNKNOWN_BUILD_INFO so a dev/non-git build still serves a valid response.
 */
export function loadBuildInfo() {
    try {
        const raw = JSON.parse(readFileSync(buildInfoPath(), 'utf8'));
        return {
            commit: typeof raw.commit === 'string' ? raw.commit : 'unknown',
            commit_short: typeof raw.commit_short === 'string' ? raw.commit_short : 'unknown',
            built_at: typeof raw.built_at === 'string' ? raw.built_at : 'unknown',
            ref: typeof raw.ref === 'string' ? raw.ref : 'unknown',
        };
    }
    catch {
        return UNKNOWN_BUILD_INFO;
    }
}
