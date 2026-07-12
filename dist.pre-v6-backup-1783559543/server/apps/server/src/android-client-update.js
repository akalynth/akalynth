import { readFileSync } from 'node:fs';
const DEFAULT_BETA = {
    ok: true,
    lane: 'beta',
    version_code: 2,
    version_name: '0.1.0-observe',
    apk_url: 'https://beta.akalynth.com/download/akalynth-beta.apk',
    apk_sha256: 'd9a9fc0fcfb2b5da51192d4eab933f345e92eb8b4b306c1c83168cb640ec9704',
    size_bytes: 12762978,
    required: false,
    published_at: '2026-06-06T09:31:45.000Z',
};
const DEFAULT_STAGING = {
    ok: true,
    lane: 'staging',
    version_code: 1,
    version_name: '0.1.0-staging',
    apk_url: 'https://staging.akalynth.com/download/akalynth-staging.apk',
    apk_sha256: '',
    size_bytes: 0,
    required: false,
    published_at: '2026-01-01T00:00:00.000Z',
};
let cachedManifests = null;
function laneDefault(lane) {
    return lane === 'beta' ? { ...DEFAULT_BETA } : { ...DEFAULT_STAGING };
}
function parseManifest(raw, lane) {
    try {
        const parsed = JSON.parse(raw);
        if (parsed.lane !== lane)
            return null;
        if (typeof parsed.version_code !== 'number' || parsed.version_code < 1)
            return null;
        if (typeof parsed.version_name !== 'string' || parsed.version_name.length === 0)
            return null;
        if (typeof parsed.apk_url !== 'string' || !parsed.apk_url.startsWith('https://'))
            return null;
        if (typeof parsed.apk_sha256 !== 'string' || !/^[a-f0-9]{64}$/.test(parsed.apk_sha256))
            return null;
        if (typeof parsed.size_bytes !== 'number' || parsed.size_bytes < 1)
            return null;
        return {
            ok: true,
            lane,
            version_code: parsed.version_code,
            version_name: parsed.version_name,
            apk_url: parsed.apk_url,
            apk_sha256: parsed.apk_sha256,
            size_bytes: parsed.size_bytes,
            required: parsed.required === true,
            published_at: typeof parsed.published_at === 'string' && parsed.published_at.length > 0
                ? parsed.published_at
                : new Date().toISOString(),
        };
    }
    catch {
        return null;
    }
}
function loadManifestFile(path, lane) {
    try {
        return parseManifest(readFileSync(path, 'utf8'), lane);
    }
    catch {
        return null;
    }
}
function loadManifests() {
    if (cachedManifests)
        return cachedManifests;
    const betaPath = process.env.AKALYNTH_ANDROID_BETA_UPDATE_JSON?.trim();
    const stagingPath = process.env.AKALYNTH_ANDROID_STAGING_UPDATE_JSON?.trim();
    cachedManifests = {
        beta: (betaPath && loadManifestFile(betaPath, 'beta')) || laneDefault('beta'),
        staging: (stagingPath && loadManifestFile(stagingPath, 'staging')) || laneDefault('staging'),
    };
    return cachedManifests;
}
export function getAndroidClientUpdate(lane) {
    if (lane !== 'beta' && lane !== 'staging')
        return null;
    const manifests = loadManifests();
    const manifest = manifests[lane];
    if (!manifest) {
        return { error: 'android_update_unavailable', status: 503 };
    }
    return manifest;
}
export function resetAndroidClientUpdateCacheForTests() {
    cachedManifests = null;
}
