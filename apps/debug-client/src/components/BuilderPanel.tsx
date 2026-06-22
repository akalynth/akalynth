import { useCallback, useEffect, useState } from 'react';
import palette from '../data/builderPaletteManifest.json';
import { resolvePaletteIcon } from '../data/builderPaletteAssets';
import {
  ROOKGUARD_BUILDER_DRAFT,
  endBuilderPreview,
  queryPreviewNamespace,
  rookguardManifestChecksum,
  startBuilderPreview,
  type PreviewRegistryOverlay,
} from '../services/builderPreview';

export type MapPreviewView = 'before' | 'after';

export interface BuilderPreviewDisplay {
  sessionActive: boolean;
  mapView: MapPreviewView;
  showOnMap: boolean;
}

interface BuilderPanelProps {
  open: boolean;
  httpBase: string;
  guestToken: string | null;
  onClose: () => void;
  onDisplayChange?: (display: BuilderPreviewDisplay | null) => void;
}

type PanelPhase = 'idle' | 'active' | 'ended' | 'error';

export function BuilderPanel({ open, httpBase, guestToken, onClose, onDisplayChange }: BuilderPanelProps) {
  const [phase, setPhase] = useState<PanelPhase>('idle');
  const [sessionId, setSessionId] = useState('');
  const [checksum, setChecksum] = useState(() => rookguardManifestChecksum());
  const [namespaceMeta, setNamespaceMeta] = useState<string>('—');
  const [receiptCount, setReceiptCount] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [registry, setRegistry] = useState<PreviewRegistryOverlay | null>(null);
  const [mapView, setMapView] = useState<MapPreviewView>('after');
  const [showOnMap, setShowOnMap] = useState(true);

  const pushDisplay = useCallback(
    (nextPhase: PanelPhase, view: MapPreviewView, visible: boolean) => {
      if (!onDisplayChange) return;
      const previewing = nextPhase === 'active' || nextPhase === 'ended';
      if (!previewing) {
        onDisplayChange(null);
        return;
      }
      onDisplayChange({ sessionActive: true, mapView: view, showOnMap: visible });
    },
    [onDisplayChange],
  );

  const reset = useCallback(() => {
    setPhase('idle');
    setSessionId('');
    setNamespaceMeta('—');
    setReceiptCount(0);
    setError(null);
    setRegistry(null);
    setChecksum(rookguardManifestChecksum());
    pushDisplay('idle', mapView, showOnMap);
  }, [mapView, pushDisplay, showOnMap]);

  const runStart = useCallback(async () => {
    setBusy(true);
    setError(null);
    const sid = `AKALYNTH_PREVIEW_CLIENT_${Date.now()}`;
    try {
      const start = await startBuilderPreview(httpBase, sid, guestToken);
      if (!start.ok || !start.preview_only) {
        throw new Error(start.error ?? 'preview start failed');
      }
      const ns = await queryPreviewNamespace(httpBase, ROOKGUARD_BUILDER_DRAFT.preview_namespace);
      if (!ns.ok) throw new Error(ns.error ?? 'namespace query failed');
      const loadedRegistry = ns.registry ?? null;
      setSessionId(sid);
      setChecksum(start.session?.artifacts.manifest_checksum ?? checksum);
      setNamespaceMeta(
        ns.object_id
          ? `${ns.object_id} · rooms ${ns.overlay?.rooms ?? 0} · objects ${ns.overlay?.objects ?? 0}`
          : ROOKGUARD_BUILDER_DRAFT.preview_namespace,
      );
      setReceiptCount(start.receipts?.length ?? 0);
      setRegistry(loadedRegistry);
      setPhase('active');
      pushDisplay('active', mapView, showOnMap);
    } catch (err) {
      setPhase('error');
      setError(String(err));
      pushDisplay('error', mapView, showOnMap);
    } finally {
      setBusy(false);
    }
  }, [httpBase, checksum, guestToken, mapView, pushDisplay, showOnMap]);

  const runEnd = useCallback(async () => {
    if (!sessionId) return;
    setBusy(true);
    setError(null);
    try {
      const end = await endBuilderPreview(httpBase, sessionId);
      if (!end.ok || !end.preview_only) throw new Error(end.error ?? 'preview end failed');
      setReceiptCount(end.receipts?.length ?? 0);
      setPhase('ended');
      pushDisplay('ended', mapView, showOnMap);
    } catch (err) {
      setPhase('error');
      setError(String(err));
    } finally {
      setBusy(false);
    }
  }, [httpBase, sessionId, mapView, pushDisplay, showOnMap]);

  useEffect(() => {
    if (!open) {
      onDisplayChange?.(null);
      return;
    }
    pushDisplay(phase, mapView, showOnMap);
  }, [open, phase, mapView, showOnMap, pushDisplay, onDisplayChange]);

  if (!open) return null;

  const heroPlate = palette.plates[0];

  return (
    <div className="mobile-sheet-layer mobile-sheet-layer--builder">
      <button type="button" className="mobile-sheet-backdrop" onClick={onClose} aria-label="Close builder" />
      <div className="builder-sheet" role="dialog" aria-modal="true" aria-label="Builder preview">
        <div className="builder-sheet__header">
          <div>
            <div className="builder-sheet__title">Builder Preview</div>
            <div className="builder-sheet__subtitle">preview_only · world_state G2</div>
          </div>
          <button type="button" className="builder-sheet__close" onClick={onClose} aria-label="Close">
            ×
          </button>
        </div>

        {heroPlate && resolvePaletteIcon(heroPlate.icon_asset) && (
          <div className="builder-hero-plate">
            <img src={resolvePaletteIcon(heroPlate.icon_asset)} alt={heroPlate.label} />
          </div>
        )}

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
            <span>Guest bind</span>
            <strong>{guestToken ? 'bound' : 'login first'}</strong>
          </div>
          <div className="builder-row">
            <span>Receipts</span>
            <strong>{receiptCount}</strong>
          </div>
          <div className="builder-row">
            <span>Phase</span>
            <strong>{phase}</strong>
          </div>
          <div className="builder-row">
            <span>Map view</span>
            <div className="builder-map-toggle">
              <button
                type="button"
                className={`builder-map-toggle__btn${mapView === 'before' ? ' is-active' : ''}`}
                disabled={phase === 'idle'}
                onClick={() => setMapView('before')}
              >
                Base
              </button>
              <button
                type="button"
                className={`builder-map-toggle__btn${mapView === 'after' ? ' is-active' : ''}`}
                disabled={phase === 'idle'}
                onClick={() => setMapView('after')}
              >
                Preview
              </button>
            </div>
          </div>
          <label className="builder-row builder-row--check">
            <span>Show on map</span>
            <input
              type="checkbox"
              checked={showOnMap}
              onChange={(e) => setShowOnMap(e.target.checked)}
              disabled={phase === 'idle'}
            />
          </label>
        </div>

        <div className="builder-card">
          <div className="builder-card__title">Object palette</div>
          <ul className="builder-palette">
            {palette.icons.map((icon) => {
              const src = icon.icon_asset ? resolvePaletteIcon(icon.icon_asset) : undefined;
              return (
                <li key={icon.id}>
                  {src ? (
                    <img className="builder-palette__icon" src={src} alt="" aria-hidden="true" />
                  ) : (
                    <span className="builder-palette__kind">{icon.kind}</span>
                  )}
                  <span>{icon.label}</span>
                </li>
              );
            })}
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