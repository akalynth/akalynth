import { useEffect, useState } from 'react';
import type { BetaFeedbackCategory, BetaSeverity, MapName } from '@shared/http';
import type { AccountSessionStatus } from '../types';
import { readBetaClientSessionId, submitBetaFeedback } from '../services/betaTelemetry';

interface BetaFeedbackSheetProps {
  open: boolean;
  httpBase: string;
  accountSession: AccountSessionStatus;
  map: MapName;
  tutorialStep?: string;
  onClose: () => void;
}

const severityHelp: Record<BetaSeverity, string> = {
  P0: 'Cannot play or the beta is unavailable',
  P1: 'A core action is blocked',
  P2: 'Playable, but meaningfully degraded',
  P3: 'Suggestion or polish',
};

export function BetaFeedbackSheet({ open, httpBase, accountSession, map, tutorialStep, onClose }: BetaFeedbackSheetProps) {
  const [severity, setSeverity] = useState<BetaSeverity>('P2');
  const [category, setCategory] = useState<BetaFeedbackCategory>('gameplay');
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [reproduction, setReproduction] = useState('');
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setNotice(null);
  }, [open]);

  if (!open) return null;
  const canSubmit = accountSession.authenticated && accountSession.csrfReady && !busy && title.trim().length > 0 && body.trim().length > 0;

  async function submit() {
    if (!canSubmit) return;
    setBusy(true);
    setNotice(null);
    const result = await submitBetaFeedback(httpBase, {
      severity,
      category,
      title: title.trim(),
      body: body.trim(),
      reproduction_steps: reproduction.trim() || undefined,
      client_session_id: readBetaClientSessionId(),
      map,
      tutorial_step: tutorialStep,
    });
    setBusy(false);
    if (!result.ok) {
      setNotice(result.error);
      return;
    }
    setNotice(`Report ${result.data.feedback_id} received. Thank you.`);
    setTitle('');
    setBody('');
    setReproduction('');
  }

  return (
    <div className="beta-feedback-overlay" role="presentation">
      <section className="beta-feedback-sheet" role="dialog" aria-modal="true" aria-labelledby="beta-feedback-title">
        <header className="beta-feedback-header">
          <div>
            <span className="beta-feedback-kicker">Controlled beta</span>
            <h2 id="beta-feedback-title">Send feedback</h2>
          </div>
          <button type="button" className="beta-feedback-close" onClick={onClose} aria-label="Close feedback">×</button>
        </header>
        {!accountSession.authenticated && <p className="beta-feedback-note">Sign in before sending feedback so the team can reproduce your report.</p>}
        {accountSession.authenticated && !accountSession.csrfReady && <p className="beta-feedback-note">Your account session needs to be refreshed before sending feedback.</p>}
        <div className="beta-feedback-grid">
          <label>
            Severity
            <select value={severity} onChange={(event) => setSeverity(event.target.value as BetaSeverity)}>
              {(Object.keys(severityHelp) as BetaSeverity[]).map((value) => <option key={value} value={value}>{value} — {severityHelp[value]}</option>)}
            </select>
          </label>
          <label>
            Area
            <select value={category} onChange={(event) => setCategory(event.target.value as BetaFeedbackCategory)}>
              <option value="onboarding">Onboarding</option>
              <option value="stability">Stability</option>
              <option value="gameplay">Gameplay</option>
              <option value="accessibility">Accessibility</option>
              <option value="other">Other</option>
            </select>
          </label>
        </div>
        <label>Short title<input value={title} maxLength={120} onChange={(event) => setTitle(event.target.value)} placeholder="What happened?" /></label>
        <label>What did you observe?<textarea value={body} maxLength={4000} onChange={(event) => setBody(event.target.value)} placeholder="Describe the player-facing result." rows={4} /></label>
        <label>How can we reproduce it?<textarea value={reproduction} maxLength={4000} onChange={(event) => setReproduction(event.target.value)} placeholder="Steps, map, and what you expected." rows={3} /></label>
        <p className="beta-feedback-privacy">We attach the release, map, tutorial step, and a private client session id. Do not include passwords, email addresses, or tokens.</p>
        {notice && <p className="beta-feedback-notice" role="status">{notice}</p>}
        <div className="beta-feedback-actions">
          <button type="button" className="beta-feedback-secondary" onClick={onClose}>Close</button>
          <button type="button" className="beta-feedback-primary" onClick={() => void submit()} disabled={!canSubmit}>{busy ? 'Sending…' : 'Send report'}</button>
        </div>
      </section>
    </div>
  );
}
