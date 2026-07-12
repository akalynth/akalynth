// Builder draft + local preview contracts (Play, Build, Govern Surface v1).
// Codex authority: AKALYNTH_PLAY_BUILD_GOVERN_SURFACE_V1
// Preview namespaces are non-authoritative; live lanes must never read them as truth.
import { createHash } from 'node:crypto';
export const BUILDER_DRAFT_MANIFEST_SCHEMA_VERSION = 'builder-draft-manifest/v1';
export const LOCAL_PREVIEW_SESSION_SCHEMA_VERSION = 'local-preview-session/v1';
export const PROMOTION_REVIEW_PACKET_SCHEMA_VERSION = 'promotion-review-packet/v1';
export const BUILDER_PROMOTION_PERMIT_SCHEMA_VERSION = 'builder-promotion-permit/v1';
export const PREVIEW_NAMESPACE_PREFIX = 'preview:';
function stableStringify(value) {
    if (value === null)
        return 'null';
    const kind = typeof value;
    if (kind === 'boolean' || kind === 'number')
        return JSON.stringify(value);
    if (kind === 'string')
        return JSON.stringify(value);
    if (Array.isArray(value)) {
        return `[${value.map((entry) => stableStringify(entry)).join(', ')}]`;
    }
    const obj = value;
    const keys = Object.keys(obj).sort();
    return `{${keys.map((key) => `${JSON.stringify(key)}: ${stableStringify(obj[key])}`).join(', ')}}`;
}
/** Canonical checksum aligned with akalynth-ops builder-promotion-gate.sh */
export function computeManifestChecksum(manifest) {
    const clone = structuredClone(manifest);
    for (const item of clone.changed_files) {
        if (item.path.endsWith('rookguard-builder-draft-manifest.sample.json')) {
            item.sha256 = '0'.repeat(64);
        }
    }
    return createHash('sha256').update(stableStringify(clone)).digest('hex');
}
export function assertPreviewNamespace(namespace) {
    if (!namespace.startsWith(PREVIEW_NAMESPACE_PREFIX)) {
        throw new Error(`builder draft namespace must start with ${PREVIEW_NAMESPACE_PREFIX}`);
    }
}
export function validateDraftManifest(manifest) {
    if (manifest.schema_version !== BUILDER_DRAFT_MANIFEST_SCHEMA_VERSION) {
        throw new Error('invalid builder draft manifest schema');
    }
    assertPreviewNamespace(manifest.preview_namespace);
    if (manifest.abuse_review.grants_live_rewards !== false) {
        throw new Error('builder draft must not grant live rewards');
    }
    if (manifest.abuse_review.grants_live_access !== false) {
        throw new Error('builder draft must not grant live access');
    }
}
export function validatePreviewSession(session, manifest) {
    if (session.schema_version !== LOCAL_PREVIEW_SESSION_SCHEMA_VERSION) {
        throw new Error('invalid local preview session schema');
    }
    if (session.preview_only !== true) {
        throw new Error('preview session must be preview_only');
    }
    const checksum = computeManifestChecksum(manifest);
    if (session.artifacts.manifest_checksum !== checksum) {
        throw new Error('preview session manifest checksum mismatch');
    }
}
export function buildPreviewNamespace(sourceObject, draftSlug) {
    return `${PREVIEW_NAMESPACE_PREFIX}${sourceObject}:${draftSlug}`;
}
