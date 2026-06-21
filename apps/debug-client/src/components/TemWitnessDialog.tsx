interface TemWitnessDialogProps {
  request: { request_id: string; prompt: string; target_actor: string; kind: string };
  onRespond: (requestId: string, response: 'confirm' | 'deny' | 'uncertain') => void;
  onDismiss: () => void;
}

export function TemWitnessDialog({ request, onRespond, onDismiss }: TemWitnessDialogProps) {
  function respond(r: 'confirm' | 'deny' | 'uncertain') {
    onRespond(request.request_id, r);
  }

  return (
    <div className="tem-witness-overlay" role="dialog" aria-modal="true" aria-label="Tem witness request">
      <div className="tem-witness-dialog">
        <div className="tem-witness-header">
          <span className="tem-witness-title">Witness Request</span>
          <span className="tem-witness-target">{request.target_actor}</span>
        </div>
        <p className="tem-witness-prompt">{request.prompt}</p>
        <div className="tem-witness-actions">
          <button
            type="button"
            className="action-btn tem-witness-confirm"
            onClick={() => respond('confirm')}
          >
            Confirm
          </button>
          <button
            type="button"
            className="action-btn tem-witness-uncertain"
            onClick={() => respond('uncertain')}
          >
            Uncertain
          </button>
          <button
            type="button"
            className="action-btn tem-witness-deny"
            onClick={() => respond('deny')}
          >
            Deny
          </button>
        </div>
        <button type="button" className="tem-witness-skip" onClick={onDismiss}>
          Skip
        </button>
      </div>
    </div>
  );
}
