import { useCallback, useState } from 'react';
import type { BuilderDraftManifest } from '@shared/builderDraft';
import { BuildView } from './views/BuildView';
import { AssetsView } from './views/AssetsView';
import { ReviewView } from './views/ReviewView';
import { startBuilderPreview, type PreviewStartResponse } from './services/builderPreview';

type StudioView = 'build' | 'assets' | 'review';
type StudioEnv = 'Local' | 'Staging' | 'Live';

const ENV_CYCLE: Record<StudioEnv, StudioEnv> = {
  Local: 'Staging',
  Staging: 'Live',
  Live: 'Local',
};

export function App() {
  const [view, setView] = useState<StudioView>('build');
  const [env, setEnv] = useState<StudioEnv>('Local');
  const [unsaved, setUnsaved] = useState(0);
  const [previewBusy, setPreviewBusy] = useState(false);
  const [lastPreview, setLastPreview] = useState<PreviewStartResponse | null>(null);
  const [previewError, setPreviewError] = useState<string | null>(null);

  const handleSign = useCallback(async (manifest: BuilderDraftManifest) => {
    setPreviewBusy(true);
    setPreviewError(null);
    const sessionId = `AKALYNTH_STUDIO_${Date.now()}`;
    const guestToken = localStorage.getItem('akalynth_guest_token');
    try {
      const result = await startBuilderPreview(manifest, sessionId, guestToken);
      if (!result.ok || !result.preview_only) {
        throw new Error(result.error ?? 'preview start failed');
      }
      setLastPreview(result);
      setView('review');
    } catch (err) {
      setPreviewError(String(err));
      setView('review');
    } finally {
      setPreviewBusy(false);
    }
  }, []);

  return (
    <div className="studio-app">
      <header className="studio-header">
        <div className="studio-brand">
          <span className="studio-mark" />
          <span className="studio-title">Akalynth</span>
          <span className="studio-tagline">Play · Shape · Prove</span>
        </div>
        <div className="studio-world">Rookguard</div>
        <div className="studio-header-actions">
          <button type="button" className={`studio-env studio-env--${env.toLowerCase()}`} onClick={() => setEnv(ENV_CYCLE[env])}>
            {env}
          </button>
          <span className="studio-pending">{unsaved > 0 ? `${unsaved} unsaved` : 'synced'}</span>
        </div>
      </header>

      <div className="studio-body">
        <nav className="studio-nav">
          <div className="studio-nav-group">Create</div>
          <button type="button" className={view === 'build' ? 'studio-nav-item active' : 'studio-nav-item'} onClick={() => setView('build')}>
            Build
          </button>
          <button type="button" className={view === 'assets' ? 'studio-nav-item active' : 'studio-nav-item'} onClick={() => setView('assets')}>
            Assets
          </button>
          <div className="studio-nav-group">Prove</div>
          <button type="button" className={view === 'review' ? 'studio-nav-item active' : 'studio-nav-item'} onClick={() => setView('review')}>
            Review
          </button>
          <p className="studio-nav-foot">Local-first. Nothing reaches Live without a signed receipt.</p>
        </nav>

        <main className="studio-main">
          {view === 'build' && <BuildView onUnsavedChange={setUnsaved} onSignReady={(m) => void handleSign(m)} />}
          {view === 'assets' && <AssetsView />}
          {view === 'review' && <ReviewView lastPreview={lastPreview} lastError={previewError} busy={previewBusy} />}
        </main>
      </div>
    </div>
  );
}