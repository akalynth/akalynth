import { isSimulatedReceiptLane, previewApiBase, SIM_DASHBOARD_URL, type StudioPreviewEnv } from '../config/studioLanes';
import type { PreviewStartResponse } from '../services/builderPreview';

interface ReviewViewProps {
  lastPreview: PreviewStartResponse | null;
  lastError: string | null;
  busy: boolean;
  env: StudioPreviewEnv;
}

export function ReviewView({ lastPreview, lastError, busy, env }: ReviewViewProps) {
  const fork = lastPreview?.builder_preview;
  const receipts = lastPreview?.receipts ?? [];

  return (
    <div className="studio-review">
      <h1>Review</h1>
      <p className="studio-lead">
        preview_only on <code>{env}</code> ({previewApiBase(env)}) — session receipts only, no chronicle authority.
        {isSimulatedReceiptLane(env) && (
          <>
            {' '}
            Sim lane boundary: <code>simulated_receipts_only</code>.{' '}
            <a href={SIM_DASHBOARD_URL} target="_blank" rel="noreferrer">
              Open sim dashboard
            </a>
          </>
        )}
      </p>

      {busy && <p className="studio-muted">Signing preview session…</p>}
      {lastError && <p className="studio-error">{lastError}</p>}

      {lastPreview?.ok && (
        <div className="studio-card">
          <h2>Last preview session</h2>
          <dl className="studio-dl">
            <div>
              <dt>Namespace</dt>
              <dd>{fork?.namespace ?? '—'}</dd>
            </div>
            <div>
              <dt>Map</dt>
              <dd>{fork?.map_name ?? '—'}</dd>
            </div>
            <div>
              <dt>Objects</dt>
              <dd>{fork?.objects.length ?? 0}</dd>
            </div>
            <div>
              <dt>Placement validation</dt>
              <dd className={fork?.placement_validation.ok ? 'ok' : 'bad'}>
                {fork?.placement_validation.ok ? 'ok' : 'failed'}
              </dd>
            </div>
          </dl>
          <h3>Receipts</h3>
          <ul>
            {receipts.map((r) => (
              <li key={r.receipt_type}>
                <code>{r.receipt_type}</code> · {r.lane}
              </li>
            ))}
          </ul>
        </div>
      )}

      {!lastPreview && !busy && !lastError && (
        <p className="studio-muted">Use Build → Save &amp; sign to start a preview_only session on the game server.</p>
      )}
    </div>
  );
}