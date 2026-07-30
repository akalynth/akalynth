import { readFileSync } from 'node:fs';
import type { AndroidClientUpdateResponse } from '../../../packages/shared/http.js';

type Lane = AndroidClientUpdateResponse['lane'];

export type AndroidClientUpdateResult =
  | AndroidClientUpdateResponse
  | { error: string; status: number };

let cachedManifests: Partial<Record<Lane, AndroidClientUpdateResponse>> | null = null;

function parseManifest(raw: string, lane: Lane): AndroidClientUpdateResponse | null {
  try {
    const parsed = JSON.parse(raw) as Partial<AndroidClientUpdateResponse>;
    if (parsed.ok !== true) return null;
    if (parsed.lane !== lane) return null;
    if (
      typeof parsed.version_code !== 'number' ||
      !Number.isSafeInteger(parsed.version_code) ||
      parsed.version_code < 1
    ) {
      return null;
    }
    if (typeof parsed.version_name !== 'string' || parsed.version_name.length === 0) return null;
    if (typeof parsed.apk_url !== 'string') return null;
    const apkUrl = new URL(parsed.apk_url);
    if (
      apkUrl.protocol !== 'https:' ||
      apkUrl.username ||
      apkUrl.password ||
      apkUrl.port ||
      apkUrl.search ||
      apkUrl.hash
    ) {
      return null;
    }
    if (
      lane === 'beta' &&
      apkUrl.hostname !== 'beta.akalynth.com'
    ) {
      return null;
    }
    const betaApkMatch =
      lane === 'beta'
        ? /^\/download\/akalynth-beta-v([1-9][0-9]*)\.apk$/.exec(apkUrl.pathname)
        : null;
    if (
      lane === 'beta' &&
      (betaApkMatch === null || Number(betaApkMatch[1]) !== parsed.version_code)
    ) {
      return null;
    }
    if (typeof parsed.apk_sha256 !== 'string' || !/^[a-f0-9]{64}$/.test(parsed.apk_sha256)) return null;
    if (
      typeof parsed.size_bytes !== 'number' ||
      !Number.isSafeInteger(parsed.size_bytes) ||
      parsed.size_bytes < 1
    ) {
      return null;
    }
    if (
      typeof parsed.published_at !== 'string' ||
      !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?Z$/.test(parsed.published_at) ||
      Number.isNaN(Date.parse(parsed.published_at))
    ) {
      return null;
    }
    if (typeof parsed.required !== 'boolean') return null;
    return {
      ok: true,
      lane,
      version_code: parsed.version_code,
      version_name: parsed.version_name,
      apk_url: parsed.apk_url,
      apk_sha256: parsed.apk_sha256,
      size_bytes: parsed.size_bytes,
      required: parsed.required,
      published_at: parsed.published_at,
    };
  } catch {
    return null;
  }
}

function loadManifestFile(path: string, lane: Lane): AndroidClientUpdateResponse | null {
  try {
    return parseManifest(readFileSync(path, 'utf8'), lane);
  } catch {
    return null;
  }
}

function loadManifests(): Partial<Record<Lane, AndroidClientUpdateResponse>> {
  if (cachedManifests) return cachedManifests;

  const betaPath = process.env.AKALYNTH_ANDROID_BETA_UPDATE_JSON?.trim();
  const stagingPath = process.env.AKALYNTH_ANDROID_STAGING_UPDATE_JSON?.trim();

  cachedManifests = {
    beta: betaPath ? loadManifestFile(betaPath, 'beta') ?? undefined : undefined,
    staging: stagingPath
      ? loadManifestFile(stagingPath, 'staging') ?? undefined
      : undefined,
  };
  return cachedManifests;
}

export function getAndroidClientUpdate(lane: string): AndroidClientUpdateResult | null {
  if (lane !== 'beta' && lane !== 'staging') return null;
  const manifests = loadManifests();
  const manifest = manifests[lane];
  if (!manifest) {
    return { error: 'android_update_unavailable', status: 503 };
  }
  return manifest;
}

export function resetAndroidClientUpdateCacheForTests(): void {
  cachedManifests = null;
}
