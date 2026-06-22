import { useCallback, useState } from 'react';
import palette from '../data/builderPaletteManifest.json';
import {
  ROOKGUARD_BUILDER_DRAFT,
  endBuilderPreview,
  queryPreviewNamespace,
  rookguardManifestChecksum,
  startBuilderPreview,
} from '../services/builderPreview';

interface BuilderPanelProps {
  open: boolean;
  httpBase: string;
  onClose: () => void;
}

type PanelPhase = 'idle' | 'active' | 'ended' | 'error';

export function BuilderPanel({ open, httpBase, onClose }: BuilderPanelProps) {
  const [phase, setPhase] = useState<PanelPhase>('idle');
  const [sessionId, setSessionId] = useState('');
  const [checksum, setChecksum] = useState(() => rookguardManifestChecksum());
  const [namespaceMeta, setNamespaceMeta] = useState<string>('—');
  const [receiptCount, setReceiptCount] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const reset = useCallback(() => {
    setPhase('idle');
    setSessionId('');
    setNamespaceMeta('—');
    setReceiptCount(0);
    setError(null);
    setChecksum(rookguardManifestChecksum());
  }, []);

  const runStart = useCallback(async () => {
    setBusy(true);
    setError(null);
    const sid = `AKALYNTH_PREVIEW_CLIENT_${Date.now()}`;
    try {
      const start = await startBuilderPreview(httpBase, sid);
      if (!start.ok || !start.preview_only) {
        throw new Error(start.error ?? 'preview start failed');
      }
      const ns = await queryPreviewNamespace(httpBase, ROOKGUARD_BUILDER_DRAFT.preview_namespace);
      if (!ns.ok) throw new Error(ns.error ?? 'namespace query failed');
      setSessionId(sid);
      setChecksum(start.session?.artifacts.manifest_checksum ?? checksum);
      setNamespaceMeta(
        ns.object_id
          ? `${ns.object_id} · rooms ${ns.overlay?.rooms ?? 0} · objects ${ns.overlay?.objects ?? 0}`
          : ROOKGUARD_BUILDER_DRAFT.preview_namespace,
      );
      setReceiptCount(start.receipts?.length ?? 0);
      setPhase('active');
    } catch (err) {
      setPhase('error');
      setError(String(err));
    } finally {
      setBusy(false);
    }
  }, [httpBase, checksum]);

  const runEnd = useCallback(async () => {
    if (!sessionId) return;
    setBusy(true);
    setError(null);
    try {
      const end = await endBuilderPreview(httpBase, sessionId);
      if (!end.ok || !end.preview_only) throw new Error(end.error ?? 'preview end failed');
      setReceiptCount(end.receipts?.length ?? 0);
      setPhase('ended');
    } catch (err) {
      setPhase('error');
      setError(String(err));
    } finally {
      setBusy(false);
    }
  }, [httpBase, sessionId]);

  if (!open) return null;

  return (
    <div className="mobile-sheet-layer mobile-sheet-layer--builder">
      <button type="button" className="mobile-sheet-backdrop" onClick={onClose} aria-label="Close builder" />
      <div className="builder-sheet" role="dialog" aria-modal="true" aria-label="Builder preview">
        <div className="builder-sheet__header">
          <div>
            <div className="builder-sheet__title">Builder Preview</div>
            <div className="builder-sheet__subtitle">preview_only · PR-8 panel</div>
          </div>
          <button type="button" className="builder-sheet__close" onClick={onClose} aria-label="Close">
            ×
          </button>
        </div>

        <div className="builder-card">
          <div className="builder-row">
            <span>Draft</span>
            <strong>{ROOKGUARD_BUILDER_DRAFT.object_id}</strong>
          </div>
          <div className="builder-row">
            <span>Namespace</span>
            <strong>{ROOKGUARD_BUILDER_DRAFT.preview_namespace}</strong>
          </div>
          <div className="builder-row">
            <span>Checksum</span>
            <code className="builder-checksum">{checksum.slice(0, 16)}…</code>
          </div>
          <div className="builder-row">
            <span>Loaded</span>
            <strong>{namespaceMeta}</strong>
          </div>
          <div className="builder-row">
            <span>Receipts</span>
            <strong>{receiptCount}</strong>
          </div>
          <div className="builder-row">
            <span>Phase</span>
            <strong>{phase}</strong>
          </div>
        </div>

        <div className="builder-card">
          <div className="builder-card__title">Object palette</div>
          <ul className="builder-palette">
            {palette.icons.map((icon) => (
              <li key={icon.id}>
                <span className="builder-palette__kind">{icon.kind}</span>
                <span>{icon.label}</span>
              </li>
            ))}
          </ul>
        </div>

        {error && <p className="builder-error">{error}</p>}

        <div className="builder-actions">
          <button type="button" className="builder-btn" disabled={busy || phase === 'active'} onClick={() => void runStart()}>
            Start preview
          </button>
          <button type="button" className="builder-btn" disabled={busy || phase !== 'active'} onClick={() => void runEnd()}>
            End preview
          </button>
          <button type="button" className="builder-btn builder-btn--ghost" disabled={busy} onClick={reset}>
            Reset
          </button>
        </div>
      </div>
    </div>
  );
}