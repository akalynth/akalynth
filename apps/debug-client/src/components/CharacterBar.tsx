import { useState, type FormEvent } from 'react';
import type { SessionInfo } from '../types';

// Scoped styles injected once (kept out of the shared index.css).
const STYLE_ID = 'character-bar-styles';
if (typeof document !== 'undefined' && !document.getElementById(STYLE_ID)) {
  const el = document.createElement('style');
  el.id = STYLE_ID;
  el.textContent = `
    .character-bar { display: flex; flex-wrap: wrap; align-items: center; gap: 5px; margin-top: 7px; }
    .character-bar-kicker { width: 100%; font-size: 10px; letter-spacing: 0; text-transform: uppercase; color: #b9b4aa; text-shadow: 0 1px #050505; }
    .character-bar-name { color: #f0c83c; font-weight: 700; text-shadow: 0 1px #050505; }
    .character-bar-input { flex: 1 1 110px; min-width: 0; padding: 4px 7px; border-radius: 3px; border: 1px solid #55534d; background: #1b1b1a; color: #e7e0d1; font: inherit; font-size: 12px; box-shadow: inset 0 1px 2px #050505; }
    .character-bar-input:focus { outline: none; border-color: #b6922a; }
    .character-bar-btn { padding: 4px 9px; border-radius: 3px; border: 1px solid #6b5a2a; background: linear-gradient(180deg,#5b533f,#262522); color: #f0c83c; font: inherit; font-size: 12px; font-weight: 700; cursor: pointer; text-shadow: 0 1px #050505; box-shadow: inset 0 1px #78746a, 0 1px 0 #050505; }
    .character-bar-btn:disabled { opacity: 0.5; cursor: not-allowed; }
    .character-bar--signed .character-bar-btn { background: linear-gradient(180deg,#423f39,#1f1f1d); color: #f0c83c; }
    .character-bar-error { width: 100%; font-size: 11px; color: #ff6b62; text-shadow: 0 1px #050505; }
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
