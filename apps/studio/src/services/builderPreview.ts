import type { BuilderDraftManifest, BuilderPreviewWorldFork } from '@shared/builderDraft';
import manifestFixture from '../fixtures/rookguardBuilderDraftManifest.json';

export const ROOKGUARD_BUILDER_DRAFT = manifestFixture as BuilderDraftManifest;

export interface PreviewStartResponse {
  ok: boolean;
  preview_only?: boolean;
  session?: { session_id: string; artifacts: { manifest_checksum: string } };
  receipts?: Array<{ receipt_type: string; lane: string }>;
  builder_preview?: BuilderPreviewWorldFork;
  guest_bound?: boolean;
  error?: string;
}

export interface PreviewWorldStateResponse {
  ok: boolean;
  preview_only?: boolean;
  builder_preview?: BuilderPreviewWorldFork;
  error?: string;
}

function apiBase(): string {
  const configured = import.meta.env.VITE_STUDIO_API_BASE;
  if (configured) return configured.replace(/\/$/, '');
  return `${window.location.protocol}//${window.location.hostname}:3010`;
}

export async function startBuilderPreview(
  manifest: BuilderDraftManifest,
  sessionId: string,
  guestToken?: string | null,
): Promise<PreviewStartResponse> {
  const resp = await fetch(`${apiBase()}/v1/builder/preview/start`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      manifest,
      session_id: sessionId,
      draft_manifest_ref: 'codex/samples/rookguard-builder-draft-manifest.sample.json',
      ...(guestToken ? { guest_token: guestToken } : {}),
    }),
  });
  return (await resp.json()) as PreviewStartResponse;
}

export async function queryPreviewWorldState(
  namespace: string,
  guestToken?: string | null,
): Promise<PreviewWorldStateResponse> {
  const params = new URLSearchParams({ ns: namespace });
  if (guestToken) params.set('guest_token', guestToken);
  const resp = await fetch(`${apiBase()}/v1/builder/preview/world-state?${params}`);
  return (await resp.json()) as PreviewWorldStateResponse;
}