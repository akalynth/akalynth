import { useCallback, useEffect, useState } from 'react';
import {
  generateKeyPair,
  getPublicKeyPem,
  hasKey,
  signCanonicalPayload,
  clearKeys,
  savePrincipal,
  getSavedPrincipal,
  clearPrincipal,
  registerPrincipal,
  requestChallenge,
  verifyChallenge,
  reportPrincipal,
  blockPrincipal,
  signedSelfAction,
  type SavedPrincipal,
} from '../services/adventurerSeal';

interface AdventurerSealSheetProps {
  open: boolean;
  httpBase: string;
  onClose: () => void;
}

type Phase = 'loading' | 'no_key' | 'has_key_no_session' | 'active' | 'busy';

export function AdventurerSealSheet({ open, httpBase, onClose }: AdventurerSealSheetProps) {
  const [phase, setPhase] = useState<Phase>('loading');
  const [principal, setPrincipal] = useState<SavedPrincipal | null>(null);
  const [status, setStatus] = useState('');
  const [handle, setHandle] = useState('');
  const [target, setTarget] = useState('');
  const [reason, setReason] = useState('');

  const refresh = useCallback(async () => {
    setPhase('loading');
    try {
      const saved = await getSavedPrincipal();
      if (saved) {
        setPrincipal(saved);
        setPhase('active');
        return;
      }
      const keyExists = await hasKey();
      setPhase(keyExists ? 'has_key_no_session' : 'no_key');
    } catch (e) {
      setStatus(`Load error: ${(e as Error).message}`);
      setPhase('no_key');
    }
  }, []);

  useEffect(() => {
    if (open) void refresh();
  }, [open, refresh]);

  async function run(label: string, fn: () => Promise<void>) {
    setPhase('busy');
    setStatus(label);
    try {
      await fn();
    } catch (e) {
      setStatus(`Error: ${(e as Error).message}`);
      await refresh();
    }
  }

  async function claimSeal() {
    if (!handle.trim()) { setStatus('Enter a handle.'); return; }
    await run('Generating key pair…', async () => {
      const pem = await generateKeyPair();
      setStatus('Registering with server…');
      const reg = await registerPrincipal(httpBase, handle.trim(), pem);
      setStatus(`${reg.loss_warning}\nRequesting login challenge…`);
      const ch = await requestChallenge(httpBase, reg.principal_id, 'principal_login');
      setStatus('Signing challenge…');
      const sig = await signCanonicalPayload(ch.canonical_payload);
      setStatus('Verifying…');
      const verified = await verifyChallenge(httpBase, reg.principal_id, ch.challenge_id, sig);
      const saved: SavedPrincipal = {
        principal_id: reg.principal_id,
        handle: verified.handle,
        session_token: verified.session_token,
        expires_at: verified.expires_at,
      };
      await savePrincipal(saved);
      setPrincipal(saved);
      setStatus(`Seal active — ${verified.handle}`);
      setPhase('active');
    });
  }

  async function loginWithStoredKey() {
    const pem = await getPublicKeyPem();
    if (!pem) { setStatus('No key found.'); await refresh(); return; }
    if (!handle.trim()) { setStatus('Enter your principal_id to log in.'); return; }
    await run('Requesting login challenge…', async () => {
      const ch = await requestChallenge(httpBase, handle.trim(), 'principal_login');
      setStatus('Signing…');
      const sig = await signCanonicalPayload(ch.canonical_payload);
      const verified = await verifyChallenge(httpBase, handle.trim(), ch.challenge_id, sig);
      const saved: SavedPrincipal = {
        principal_id: handle.trim(),
        handle: verified.handle,
        session_token: verified.session_token,
        expires_at: verified.expires_at,
      };
      await savePrincipal(saved);
      setPrincipal(saved);
      setStatus(`Seal active — ${verified.handle}`);
      setPhase('active');
    });
  }

  async function doReport() {
    if (!principal) return;
    if (!target.trim() || !reason.trim()) { setStatus('Enter target principal_id and reason.'); return; }
    await run('Reporting…', async () => {
      await reportPrincipal(httpBase, principal.session_token, target.trim(), reason.trim());
      setStatus('Report submitted.');
      setPhase('active');
    });
  }

  async function doBlock() {
    if (!principal) return;
    if (!target.trim()) { setStatus('Enter target principal_id.'); return; }
    await run('Blocking…', async () => {
      await blockPrincipal(httpBase, principal.session_token, target.trim(), reason.trim());
      setStatus('Principal blocked.');
      setPhase('active');
    });
  }

  async function doRetire() {
    if (!principal) return;
    if (!window.confirm('Retire your Seal? This cannot be undone.')) return;
    await run('Retiring Seal…', async () => {
      await signedSelfAction(httpBase, principal.principal_id, principal.session_token, 'principal_retire');
      await clearPrincipal();
      await clearKeys();
      setPrincipal(null);
      setStatus('Seal retired.');
      setPhase('no_key');
    });
  }

  async function doDelete() {
    if (!principal) return;
    if (!window.confirm('Request Seal deletion? This is permanent.')) return;
    await run('Requesting deletion…', async () => {
      await signedSelfAction(httpBase, principal.principal_id, principal.session_token, 'principal_delete');
      await clearPrincipal();
      await clearKeys();
      setPrincipal(null);
      setStatus('Deletion requested.');
      setPhase('no_key');
    });
  }

  async function signOut() {
    await clearPrincipal();
    setPrincipal(null);
    setStatus('Session cleared.');
    const keyExists = await hasKey();
    setPhase(keyExists ? 'has_key_no_session' : 'no_key');
  }

  if (!open) return null;

  const busy = phase === 'busy' || phase === 'loading';

  return (
    <div className="mobile-sheet-layer mobile-sheet-layer--seal">
      <button type="button" className="mobile-sheet-backdrop" onClick={onClose} aria-label="Close seal" />
      <div className="seal-sheet" role="dialog" aria-modal="true" aria-label="Adventurer Seal">
        <div className="seal-sheet__header">
          <span>Adventurer Seal</span>
          <button type="button" onClick={onClose} aria-label="Close">x</button>
        </div>

        <div className="seal-sheet__body">
          <p className="seal-warning">
            A Seal is a persistent key-bound identity. The private key stays in this browser's
            IndexedDB. V1 has no recovery: clearing site data loses the Seal permanently.
          </p>

          {/* Status / active session */}
          {phase === 'active' && principal && (
            <div className="seal-section">
              <div className="seal-active-header">
                <strong>{principal.handle}</strong>
                <span className="seal-id">{principal.principal_id.slice(0, 12)}…</span>
              </div>
              <button type="button" className="seal-btn seal-btn--secondary" onClick={signOut} disabled={busy}>
                Sign out
              </button>
            </div>
          )}

          {/* Claim — no key exists yet */}
          {(phase === 'no_key') && (
            <div className="seal-section">
              <div className="seal-section-title">Claim Adventurer Seal</div>
              <input
                type="text"
                className="seal-input"
                placeholder="Handle (3–32, A-Z 0-9 _ -)"
                value={handle}
                onChange={(e) => setHandle(e.target.value)}
                maxLength={32}
                disabled={busy}
              />
              <button type="button" className="seal-btn seal-btn--primary" onClick={claimSeal} disabled={busy || !handle.trim()}>
                Claim Seal
              </button>
            </div>
          )}

          {/* Login — key exists but no session */}
          {phase === 'has_key_no_session' && (
            <div className="seal-section">
              <div className="seal-section-title">Log In With Stored Key</div>
              <input
                type="text"
                className="seal-input"
                placeholder="Your principal_id"
                value={handle}
                onChange={(e) => setHandle(e.target.value)}
                maxLength={80}
                disabled={busy}
              />
              <button type="button" className="seal-btn seal-btn--primary" onClick={loginWithStoredKey} disabled={busy || !handle.trim()}>
                Sign Challenge
              </button>
            </div>
          )}

          {/* Trust & Safety — only when active */}
          {phase === 'active' && principal && (
            <div className="seal-section">
              <div className="seal-section-title">Trust &amp; Safety</div>
              <input
                type="text"
                className="seal-input"
                placeholder="Target principal_id"
                value={target}
                onChange={(e) => setTarget(e.target.value)}
                maxLength={80}
                disabled={busy}
              />
              <input
                type="text"
                className="seal-input"
                placeholder="Reason"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                maxLength={80}
                disabled={busy}
              />
              <div className="seal-row">
                <button type="button" className="seal-btn seal-btn--secondary" onClick={doReport} disabled={busy}>
                  Report
                </button>
                <button type="button" className="seal-btn seal-btn--secondary" onClick={doBlock} disabled={busy}>
                  Block
                </button>
              </div>
            </div>
          )}

          {/* Deletion & Retirement — only when active */}
          {phase === 'active' && principal && (
            <div className="seal-section seal-section--danger">
              <div className="seal-section-title">Seal Lifecycle</div>
              <div className="seal-row">
                <button type="button" className="seal-btn seal-btn--danger" onClick={doRetire} disabled={busy}>
                  Retire Seal
                </button>
                <button type="button" className="seal-btn seal-btn--danger" onClick={doDelete} disabled={busy}>
                  Delete Seal
                </button>
              </div>
            </div>
          )}

          {/* Status text */}
          {status && (
            <div className="seal-status" aria-live="polite">
              {status}
            </div>
          )}
          {busy && (
            <div className="seal-status seal-status--busy" aria-live="polite">
              Working…
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
