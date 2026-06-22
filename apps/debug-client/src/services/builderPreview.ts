import type { BuilderDraftManifest } from '@shared/builderDraft';
import { computeManifestChecksum } from '@shared/builderDraft';
import rookguardManifest from '../fixtures/rookguardBuilderDraftManifest.json';

export interface PreviewStartResponse {
  ok: boolean;
  preview_only?: boolean;
  session?: { session_id: string; artifacts: { manifest_checksum: string } };
  receipts?: Array<{ receipt_type: string; lane: string }>;
  error?: string;
}

export interface PreviewNamespaceResponse {
  ok: boolean;
  preview_only?: boolean;
  namespace?: string;
  object_id?: string;
  source_object?: string;
  overlay?: {
    rooms: number;
    objects: number;
    npc_lines: number;
  };
  error?: string;
}

export interface PreviewEndResponse {
  ok: boolean;
  preview_only?: boolean;
  receipts?: Array<{ receipt_type: string; lane: string }>;
  error?: string;
}

export const ROOKGUARD_BUILDER_DRAFT = rookguardManifest as BuilderDraftManifest;

export function rookguardManifestChecksum(): string {
  return computeManifestChecksum(ROOKGUARD_BUILDER_DRAFT);
}

async function postJson<T>(httpBase: string, path: string, body: unknown): Promise<T> {
  const resp = await fetch(`${httpBase.replace(/\/$/, '')}${path}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
  return (await resp.json()) as T;
}

async function getJson<T>(httpBase: string, path: string): Promise<T> {
  const resp = await fetch(`${httpBase.replace(/\/$/, '')}${path}`);
  return (await resp.json()) as T;
}

export async function startBuilderPreview(
  httpBase: string,
  sessionId: string,
): Promise<PreviewStartResponse> {
  return postJson(httpBase, '/v1/builder/preview/start', {
    manifest: ROOKGUARD_BUILDER_DRAFT,
    session_id: sessionId,
    draft_manifest_ref: 'codex/samples/rookguard-builder-draft-manifest.sample.json',
  });
}

export async function endBuilderPreview(httpBase: string, sessionId: string): Promise<PreviewEndResponse> {
  return postJson(httpBase, '/v1/builder/preview/end', { session_id: sessionId });
}

export async function queryPreviewNamespace(
  httpBase: string,
  namespace: string,
): Promise<PreviewNamespaceResponse> {
  return getJson(httpBase, `/v1/builder/preview/namespace?ns=${encodeURIComponent(namespace)}`);
}