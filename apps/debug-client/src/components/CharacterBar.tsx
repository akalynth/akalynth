import { useEffect, useMemo, useState, type FormEvent } from 'react';
import type {
  AccountSessionStatus,
  AccountCharacter,
  CharacterCatalog,
  CharacterCreateInput,
  CharacterSex,
  SessionInfo,
} from '../types';

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
    .character-bar-helper { width: 100%; font-size: 11px; color: #d7cab0; text-shadow: 0 1px #050505; }
    .character-bar-session-guard { width: 100%; font-size: 11px; color: #f0c83c; text-shadow: 0 1px #050505; }
  `;
  document.head.appendChild(el);
}

interface CharacterBarProps {
  session: SessionInfo;
  onCreate: (input: CharacterCreateInput) => Promise<{ ok: boolean; error?: string }>;
  onSelect: (characterId: string) => Promise<{ ok: boolean; error?: string }>;
  onSignOut: () => void;
  catalog: CharacterCatalog;
  accountCharacters: AccountCharacter[];
  accountSession: AccountSessionStatus;
  onRefreshAccountSession: () => Promise<AccountSessionStatus>;
  onLoadAccountCharacters: () => Promise<AccountCharacter[]>;
}

/**
 * Account-character entry. When signed in as a selected character, shows the
 * name + sign-out. Otherwise this form requires an account session before it
 * can select or create a server-backed character through /v1/characters.
 */
export function CharacterBar({
  session,
  onCreate,
  onSelect,
  onSignOut,
  catalog,
  accountCharacters,
  accountSession,
  onRefreshAccountSession,
  onLoadAccountCharacters,
}: CharacterBarProps) {
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [worldId, setWorldId] = useState<CharacterCreateInput['world_id'] | ''>('');
  const [sex, setSex] = useState<CharacterSex>('male');
  const [outfitId, setOutfitId] = useState<CharacterCreateInput['outfit_id'] | ''>('');
  const [selectedCharacterId, setSelectedCharacterId] = useState('');
  const outfitOptions = useMemo(
    () => catalog.outfits.filter((entry) => entry.sex === sex),
    [catalog.outfits, sex]
  );

  useEffect(() => {
    if (!catalog.worlds.length) return;
    if (catalog.worlds.some((world) => world.world_id === worldId)) return;
    setWorldId(catalog.worlds[0].world_id);
  }, [catalog.worlds, worldId]);

  useEffect(() => {
    if (!outfitOptions.length) {
      setOutfitId('');
      return;
    }
    if (outfitOptions.some((outfit) => outfit.outfit_id === outfitId)) return;
    setOutfitId(outfitOptions[0].outfit_id);
  }, [outfitOptions, outfitId]);

  useEffect(() => {
    if (!accountCharacters.length) {
      setSelectedCharacterId('');
      return;
    }
    if (accountCharacters.some((character) => character.character_id === selectedCharacterId)) return;
    setSelectedCharacterId(accountCharacters[0].character_id);
  }, [accountCharacters, selectedCharacterId]);

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
    const trimmed = name.trim();
    let emailVerified = accountSession.emailVerified;
    if (!accountSession.authenticated) {
      const next = await onRefreshAccountSession();
      if (!next.authenticated) {
        setError(next.message ?? 'Sign in to an account before creating a character');
        setBusy(false);
        return;
      }
      void onLoadAccountCharacters();
      emailVerified = next.emailVerified;
      if (!next.emailVerified) {
        setError('Verify email before creating; existing characters can still be selected.');
        setBusy(false);
        return;
      }
    }
    if (!emailVerified) {
      setError('Verify email before creating; existing characters can still be selected.');
      setBusy(false);
      return;
    }
    if (!trimmed) {
      setError('Name is required');
      setBusy(false);
      return;
    }
    if (!worldId || !outfitId) {
      setError('World and outfit are required');
      setBusy(false);
      return;
    }
    const result = await onCreate({
      name: trimmed,
      world_id: worldId,
      sex,
      outfit_id: outfitId,
    });
    setBusy(false);
    if (result.ok) {
      setName('');
      if (outfitOptions[0]?.outfit_id) {
        setOutfitId(outfitOptions[0].outfit_id);
      }
    } else {
      setError(result.error ?? 'Could not create character');
    }
  };

  const selectExisting = async () => {
    if (busy) return;
    setBusy(true);
    setError(null);
    if (!accountSession.authenticated) {
      const next = await onRefreshAccountSession();
      if (!next.authenticated) {
        setError(next.message ?? 'Sign in to an account before selecting a character');
        setBusy(false);
        return;
      }
    }
    const characterId = selectedCharacterId || accountCharacters[0]?.character_id || '';
    if (!characterId) {
      setError('No existing characters to select');
      setBusy(false);
      return;
    }
    const result = await onSelect(characterId);
    setBusy(false);
    if (!result.ok) {
      setError(result.error ?? 'Could not select character');
    }
  };

  const canCreate =
    !busy &&
    !!catalog.loaded &&
    !catalog.loading &&
    accountSession.authenticated &&
    accountSession.csrfReady &&
    accountSession.emailVerified &&
    name.trim().length > 0 &&
    !!worldId &&
    !!outfitId;
  const canSelect = !busy && accountSession.authenticated && accountSession.csrfReady && !!selectedCharacterId;
  const sessionRequired = !accountSession.authenticated;
  const createFieldsDisabled = busy || sessionRequired || !accountSession.csrfReady;

  const accountHelper = accountSession.authenticated
    ? accountSession.emailVerified
      ? accountSession.csrfReady
        ? 'Account session ready'
        : 'Sign in again before creating or selecting; the CSRF token is missing.'
      : 'Verify email before creating; existing characters can still be selected.'
    : accountSession.checking
      ? 'Checking account session'
      : accountSession.message ?? 'Sign in to an account before creating a character';

  return (
    <form className="character-bar" aria-label="create character" onSubmit={submit}>
      <span className="character-bar-kicker">Account session required · select or create a character</span>
      <span className="character-bar-helper">{accountHelper}</span>
      {(sessionRequired || !accountSession.csrfReady) && (
        <span className="character-bar-session-guard" role="status">
          Sign in with an account session and CSRF token first; character creation and selection are disabled until the session check succeeds.
        </span>
      )}
      {accountSession.authenticated && accountCharacters.length > 0 && (
        <>
          <select
            className="character-bar-input"
            value={selectedCharacterId}
            onChange={(e) => setSelectedCharacterId(e.target.value)}
            disabled={busy}
            aria-label="existing account character"
          >
            {accountCharacters.map((character) => (
              <option key={character.character_id} value={character.character_id}>
                {character.name} · {character.world_id} · {character.outfit_id}
              </option>
            ))}
          </select>
          <button
            type="button"
            className="character-bar-btn"
            onClick={() => void selectExisting()}
            disabled={!canSelect}
          >
            {busy ? 'Selecting...' : 'Play selected'}
          </button>
        </>
      )}
      <input
        className="character-bar-input"
        type="text"
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="Character name"
        maxLength={24}
        disabled={createFieldsDisabled}
        aria-label="character name"
      />
      <select
        className="character-bar-input"
        value={worldId}
        onChange={(e) => setWorldId(e.target.value as CharacterCreateInput['world_id'])}
        disabled={createFieldsDisabled || !catalog.loaded || catalog.loading}
        aria-label="character world"
      >
        {catalog.worlds.map((world) => (
          <option key={world.world_id} value={world.world_id}>
            {world.name}
          </option>
        ))}
      </select>
      <select
        className="character-bar-input"
        value={sex}
        onChange={(e) => setSex(e.target.value as CharacterSex)}
        disabled={createFieldsDisabled || !catalog.loaded || catalog.loading}
        aria-label="character sex"
      >
        <option value="male">Male</option>
        <option value="female">Female</option>
      </select>
      <select
        className="character-bar-input"
        value={outfitId}
        onChange={(e) => setOutfitId(e.target.value as CharacterCreateInput['outfit_id'])}
        disabled={createFieldsDisabled || !catalog.loaded || catalog.loading || !outfitOptions.length}
        aria-label="character outfit"
      >
        {outfitOptions.map((outfit) => (
          <option key={outfit.outfit_id} value={outfit.outfit_id}>
            {outfit.name}
          </option>
        ))}
      </select>
      <button
        type="submit"
        className="character-bar-btn"
        disabled={!canCreate}
      >
        {busy ? 'Creating...' : accountSession.authenticated ? 'Create & play' : 'Sign in first'}
      </button>
      {!accountSession.authenticated && (
        <button
          type="button"
          className="character-bar-btn"
          onClick={() => void onRefreshAccountSession()}
          disabled={busy || accountSession.checking}
        >
          Check session
        </button>
      )}
      {error && (
        <span className="character-bar-error" role="alert">
          {error}
        </span>
      )}
      {catalog.error && !error && <span className="character-bar-error" role="alert">{catalog.error}</span>}
    </form>
  );
}
