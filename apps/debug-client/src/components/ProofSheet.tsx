interface ProofSmokeSummary {
  ok: boolean;
  ranAt: string;
  draftId: string;
  worldSpawn?: { x: number; y: number };
  canonicalUnchanged: boolean;
  details: string[];
  error?: string;
}

interface ProofSheetProps {
  open: boolean;
  objectiveLabel: string;
  playtestLabel: string;
  smokeLabel: string;
  smokeState: 'pass' | 'fail' | 'offline' | 'idle';
  lastSmoke: ProofSmokeSummary | null;
  proofError: string | null;
  proofRunning: boolean;
  studioProofEnabled: boolean;
  onClose: () => void;
  onRunProof: () => void;
}

export function ProofSheet({
  open,
  objectiveLabel,
  playtestLabel,
  smokeLabel,
  smokeState,
  lastSmoke,
  proofError,
  proofRunning,
  studioProofEnabled,
  onClose,
  onRunProof,
}: ProofSheetProps) {
  if (!open) return null;

  return (
    <div className="mobile-sheet-layer mobile-sheet-layer--proof">
      <button
        type="button"
        className="mobile-sheet-backdrop"
        onClick={onClose}
        aria-label="Close proof"
      />
      <div className="proof-sheet" role="dialog" aria-modal="true" aria-label="Proof status">
        <div className="proof-sheet__header">
          <div>
            <span>Proof</span>
            <strong>{smokeLabel}</strong>
          </div>
          <button type="button" onClick={onClose} aria-label="Close proof">x</button>
        </div>
        <div className="proof-sheet__body">
          <div className="proof-sheet__grid">
            <div>
              <span>Objective</span>
              <strong>{objectiveLabel}</strong>
            </div>
            <div>
              <span>Playtest</span>
              <strong>{playtestLabel}</strong>
            </div>
            <div>
              <span>Smoke</span>
              <strong className={`proof-sheet__state proof-sheet__state--${smokeState}`}>{smokeLabel}</strong>
            </div>
          </div>
          {lastSmoke && (
            <div className="proof-sheet__section">
              <span>Last run</span>
              <div className="proof-sheet__line">Draft: {lastSmoke.draftId}</div>
              <div className="proof-sheet__line">Ran: {lastSmoke.ranAt}</div>
              {lastSmoke.worldSpawn && (
                <div className="proof-sheet__line">
                  Spawn: {lastSmoke.worldSpawn.x},{lastSmoke.worldSpawn.y}
                </div>
              )}
              <div className="proof-sheet__line">
                Canonical unchanged: {lastSmoke.canonicalUnchanged ? 'yes' : 'no'}
              </div>
              {lastSmoke.details.length > 0 && (
                <ul className="proof-sheet__details">
                  {lastSmoke.details.slice(0, 4).map((detail) => (
                    <li key={detail}>{detail}</li>
                  ))}
                </ul>
              )}
            </div>
          )}
          {proofError && (
            <div className="proof-sheet__error" role="status">
              {proofError}
            </div>
          )}
          {!studioProofEnabled && (
            <div className="proof-sheet__line">
              Studio proof is disabled for this build.
            </div>
          )}
        </div>
        <div className="proof-sheet__actions">
          <button
            type="button"
            onClick={onRunProof}
            disabled={proofRunning || !studioProofEnabled}
            aria-label={proofRunning ? 'Running proof' : 'Run proof smoke'}
          >
            {proofRunning ? 'Running' : 'Run proof'}
          </button>
        </div>
        <div className="proof-sheet__note">
          Display only. Uses existing proof/debug data.
        </div>
      </div>
    </div>
  );
}
