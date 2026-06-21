import { useEffect, useRef, useState } from 'react';

interface TemChallengeModalProps {
  challenge: { challenge_id: string; message: string; timeoutSeconds: number; receivedAt: number };
  onRespond: (challengeId: string, response: string) => void;
  onDismiss: () => void;
}

export function TemChallengeModal({ challenge, onRespond, onDismiss }: TemChallengeModalProps) {
  const [response, setResponse] = useState('');
  const [secondsLeft, setSecondsLeft] = useState(challenge.timeoutSeconds);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  useEffect(() => {
    const elapsed = Math.floor((Date.now() - challenge.receivedAt) / 1000);
    const remaining = Math.max(0, challenge.timeoutSeconds - elapsed);
    setSecondsLeft(remaining);
    if (remaining === 0) {
      onDismiss();
      return;
    }
    const t = window.setInterval(() => {
      const el = Math.floor((Date.now() - challenge.receivedAt) / 1000);
      const rem = Math.max(0, challenge.timeoutSeconds - el);
      setSecondsLeft(rem);
      if (rem === 0) {
        window.clearInterval(t);
        onDismiss();
      }
    }, 500);
    return () => window.clearInterval(t);
  }, [challenge.receivedAt, challenge.timeoutSeconds, onDismiss]);

  function submit() {
    if (!response.trim()) return;
    onRespond(challenge.challenge_id, response.trim());
  }

  function handleKey(e: React.KeyboardEvent) {
    if (e.key === 'Enter') submit();
    if (e.key === 'Escape') onDismiss();
  }

  const urgent = secondsLeft <= 4;

  return (
    <div className="tem-challenge-overlay" role="dialog" aria-modal="true" aria-label="Tem challenge">
      <div className={`tem-challenge-modal${urgent ? ' tem-challenge-modal--urgent' : ''}`}>
        <div className="tem-challenge-header">
          <span className="tem-challenge-title">Tem Challenge</span>
          <span className={`tem-challenge-timer${urgent ? ' tem-challenge-timer--urgent' : ''}`}>
            {secondsLeft}s
          </span>
        </div>
        <p className="tem-challenge-message">{challenge.message}</p>
        <input
          ref={inputRef}
          type="text"
          className="tem-challenge-input"
          value={response}
          onChange={(e) => setResponse(e.target.value)}
          onKeyDown={handleKey}
          placeholder="Your response…"
          maxLength={64}
          autoComplete="off"
          aria-label="Challenge response"
        />
        <div className="tem-challenge-actions">
          <button
            type="button"
            className="action-btn tem-challenge-submit"
            onClick={submit}
            disabled={!response.trim()}
          >
            Respond
          </button>
          <button
            type="button"
            className="action-btn tem-challenge-dismiss"
            onClick={onDismiss}
          >
            Skip
          </button>
        </div>
      </div>
    </div>
  );
}
