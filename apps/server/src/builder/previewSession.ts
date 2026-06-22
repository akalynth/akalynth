// Local preview session scaffold — preview_only receipts, no chronicle authority.

import type {
  BuilderDraftManifest,
  LocalPreviewSession,
  PreviewReceiptRecord,
} from '../../../../packages/shared/builderDraft.js';
import {
  LOCAL_PREVIEW_SESSION_SCHEMA_VERSION,
  computeManifestChecksum,
  validatePreviewSession,
} from '../../../../packages/shared/builderDraft.js';
import type { BuilderDraftNamespaceStore } from './draftNamespace.js';
import { appendPreviewReplayEvent, previewReplayRelPath, rookguardPreviewScreenshotRefs } from './previewReplay.js';
import { assertDraftPlacementsValid } from './validateDraftPlacements.js';

export interface ActivePreviewSession {
  session: LocalPreviewSession;
  receipts: PreviewReceiptRecord[];
}

export function startPreviewSession(
  store: BuilderDraftNamespaceStore,
  manifest: BuilderDraftManifest,
  sessionId: string,
  draftManifestRef: string,
): ActivePreviewSession {
  assertDraftPlacementsValid(manifest);
  store.load(manifest);
  const startedUtc = new Date().toISOString();
  const replayRef = previewReplayRelPath(manifest.preview_namespace);
  appendPreviewReplayEvent(manifest.preview_namespace, {
    event: 'preview_session_start',
    session_id: sessionId,
    namespace: manifest.preview_namespace,
    draft_manifest_ref: draftManifestRef,
  });
  const screenshots =
    manifest.preview_namespace === 'preview:rookguard:kit-v1'
      ? rookguardPreviewScreenshotRefs()
      : [];
  const session: LocalPreviewSession = {
    schema_version: LOCAL_PREVIEW_SESSION_SCHEMA_VERSION,
    session_id: sessionId,
    draft_manifest_ref: draftManifestRef,
    started_utc: startedUtc,
    ended_utc: startedUtc,
    preview_only: true,
    artifacts: {
      manifest_checksum: computeManifestChecksum(manifest),
      replay_log_ref: replayRef,
      screenshots,
      abuse_review_note: 'preview session scaffold — no chronicle writes',
    },
    receipt_expectations: [
      { receipt_type: 'preview_session_start', lane: 'preview_only' },
      { receipt_type: 'preview_manifest_checksum', lane: 'preview_only' },
      { receipt_type: 'preview_session_end', lane: 'preview_only' },
    ],
    non_claims: ['Preview session is not an authority source.'],
  };
  validatePreviewSession(session, manifest);
  const receipts: PreviewReceiptRecord[] = [
    {
      receipt_type: 'preview_session_start',
      lane: 'preview_only',
      emitted_utc: startedUtc,
      namespace: manifest.preview_namespace,
      session_id: sessionId,
    },
  ];
  return { session, receipts };
}

export function endPreviewSession(active: ActivePreviewSession): PreviewReceiptRecord[] {
  const endedUtc = new Date().toISOString();
  const namespace = active.receipts[0]?.namespace ?? 'preview:unknown';
  appendPreviewReplayEvent(namespace, {
    event: 'preview_session_end',
    session_id: active.session.session_id,
    namespace,
  });
  active.session.ended_utc = endedUtc;
  const endReceipt: PreviewReceiptRecord = {
    receipt_type: 'preview_session_end',
    lane: 'preview_only',
    emitted_utc: endedUtc,
    namespace: active.receipts[0]?.namespace ?? 'preview:unknown',
    session_id: active.session.session_id,
  };
  active.receipts.push(endReceipt);
  return active.receipts;
}

export function assertPreviewReceiptsNonAuthoritative(receipts: PreviewReceiptRecord[]): void {
  for (const receipt of receipts) {
    if (receipt.lane !== 'preview_only') {
      throw new Error(`preview receipt must be preview_only: ${receipt.receipt_type}`);
    }
  }
}