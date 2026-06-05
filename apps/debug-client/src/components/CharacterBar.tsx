import { useState, type FormEvent } from 'react';
import type { SessionInfo } from '../types';

// Scoped styles injected once (kept out of the shared index.css).
const STYLE_ID = 'character-bar-styles';
if (typeof document !== 'undefined' && !document.getElementById(STYLE_ID)) {
  const el = document.createElement('style');
  el.id = STYLE_ID;
  el.textContent = `
    .character-bar { display: flex; flex-wrap: wrap; align-items: center; gap: 6px; margin-top: 8px; }
    .character-bar-kicker { width: 100%; font-size: 10px; letter-spacing: 0.06em; text-transform: uppercase; color: #9aa6bd; }
    .character-bar-name { color: #f7e9a7; font-weight: 700; }
    .character-bar-input { flex: 1 1 110px; min-width: 0; padding: 4px 8px; border-radius: 8px; border: 1px solid rgba(226,183,20,0.28); background: rgba(8,12,18,0.7); color: #e7ecf5; font: inherit; font-size: 12px; }
    .character-bar-input:focus { outline: none; border-color: rgba(240,200,60,0.6); }
    .character-bar-btn { padding: 4px 10px; border-radius: 8px; border: 1px solid rgba(240,200,60,0.45); background: linear-gradient(180deg,#f7e9a7,#f0c83c); color: #0b0c10; font: inherit; font-size: 12px; font-weight: 700; cursor: pointer; }
    .character-bar-btn:disabled { opacity: 0.5; cursor: not-allowed; }
    .character-bar--signed .character-bar-btn { background: transparent; color: #f7e9a7; }
    .character-bar-error { width: 100%; font-size: 11px; color: #ff9a9a; }
  `;
  document.head.appendChild(el);
}

interface CharacterBarProps {
  session: SessionInfo;
  onCreate: (name: string) => Promise<{ ok: boolean; error?: string }>;
  onSignOut: () => void;
}

/**
 * Identity v0.1 (#148). When signed in as a created character, shows the name +
 * a sign-out (back to guest). Otherwise shows a "create a character" form that
 * mints a signed token and reconnects as that character. Guest play remains the
 * default — this bar is purely additive.
 */
export function CharacterBar({ session, onCreate, onSignOut }: CharacterBarProps) {
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (session.authenticated) {
    return (
      <div className="character-bar character-bar--signed" aria-label="character identity">
        <span className="character-bar-kicker">Character</span>
        <strong className="character-bar-name">{session.name ?? '—'}</strong>
        <button type="button" className="character-bar-btn" onClick={onSignOut}>
          Sign out
        </button>
      </div>
    );
  }

  const submit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    setError(null);
    const result = await onCreate(name);
    setBusy(false);
    if (result.ok) {
      setName('');
    } else {
      setError(result.error ?? 'Could not create character');
    }
  };

  return (
    <form className="character-bar" aria-label="create character" onSubmit={submit}>
      <span className="character-bar-kicker">Guest · create a character</span>
      <input
        className="character-bar-input"
        type="text"
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="Character name"
        maxLength={24}
        disabled={busy}
        aria-label="character name"
      />
      <button type="submit" className="character-bar-btn" disabled={busy || name.trim().length === 0}>
        {busy ? 'Creating…' : 'Create & play'}
      </button>
      {error && (
        <span className="character-bar-error" role="alert">
          {error}
        </span>
      )}
    </form>
  );
}
