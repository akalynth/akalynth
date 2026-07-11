import { useEffect, useMemo, useState, type FormEvent } from 'react';
import {
  bundledSpriteForPreview,
  resolveOutfitPreview,
} from '../data/characterCreatePreview';
import type {
  AccountSessionStatus,
  AccountCharacter,
  CharacterCatalog,
  CharacterCreateInput,
  CharacterSex,
  OutfitColorIndices,
  SessionInfo,
} from '../types';
import { supportsOutfitRecolorPreview } from '../data/outfitRecolorEngine';
import { CharacterSpritePreview } from './CharacterSpritePreview';
import { OutfitColorPicker } from './OutfitColorPicker';
import { OutfitRecolorPreview } from './OutfitRecolorPreview';

function accountSessionGuardMessage(accountSession: AccountSessionStatus): string | null {
  if (!accountSession.authenticated) {
    return accountSession.message ?? 'Sign in to an account before creating or selecting a character.';
  }
  if (!accountSession.csrfReady) {
    return 'Sign in again before creating or selecting; the CSRF token is missing.';
  }
  return null;
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
  const [outfitColors, setOutfitColors] = useState<OutfitColorIndices>({
    head: 5,
    body: 24,
    legs: 36,
    feet: 38,
  });
  const [selectedCharacterId, setSelectedCharacterId] = useState('');
  const outfitOptions = useMemo(
    () => catalog.outfits.filter((entry) => entry.sex === sex),
    [catalog.outfits, sex]
  );
  const outfitPreview = useMemo(
    () => resolveOutfitPreview(outfitId || outfitOptions[0]?.outfit_id || 'male_wanderer', sex),
    [outfitId, outfitOptions, sex]
  );

  useEffect(() => {
    if (!catalog.worlds.length) return;
    if (catalog.worlds.some((world) => world.world_id === worldId)) return;
    setWorldId(catalog.worlds[0].world_id);
  }, [catalog.worlds, worldId]);

  useEffect(() => {
    const defaults = catalog.outfitEngine?.default_colors;
    if (defaults) setOutfitColors(defaults);
  }, [catalog.outfitEngine]);

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
    let activeAccountSession = accountSession;
    if (!accountSession.authenticated) {
      const next = await onRefreshAccountSession();
      activeAccountSession = next;
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
    const guarded = accountSessionGuardMessage(activeAccountSession);
    if (guarded) {
      setError(guarded);
      setBusy(false);
      return;
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
      outfit_colors: outfitColors,
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
    let activeAccountSession = accountSession;
    if (!accountSession.authenticated) {
      const next = await onRefreshAccountSession();
      activeAccountSession = next;
      if (!next.authenticated) {
        setError(next.message ?? 'Sign in to an account before selecting a character');
        setBusy(false);
        return;
      }
    }
    const guarded = accountSessionGuardMessage(activeAccountSession);
    if (guarded) {
      setError(guarded);
      setBusy(false);
      return;
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
  const guardMessage = accountSessionGuardMessage(accountSession);

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
    <form
      className={`character-bar${sessionRequired ? ' character-bar--session-required' : ''}`}
      aria-label="create character"
      onSubmit={submit}
    >
      <span className="character-bar-kicker">Account session required · select or create a character</span>
      <span className="character-bar-helper">{accountHelper}</span>
      {guardMessage && (
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
      {supportsOutfitRecolorPreview(outfitId || outfitPreview.outfitId) ? (
        <OutfitRecolorPreview
          outfitId={outfitId || outfitPreview.outfitId}
          colors={outfitColors}
          spriteLabel={outfitPreview.spriteLabel}
        />
      ) : (
        <CharacterSpritePreview
          spriteId={bundledSpriteForPreview(outfitPreview.outfitId, sex)}
          spriteLabel={outfitPreview.spriteLabel}
        />
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
            {world.tagline ? `${world.name} - ${world.tagline}` : world.name}
          </option>
        ))}
      </select>
      {catalog.worlds.find((world) => world.world_id === worldId)?.districts?.length ? (
        <span className="character-bar-helper">
          Districts: {catalog.worlds.find((world) => world.world_id === worldId)?.districts?.join(', ')}
        </span>
      ) : null}
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
      {catalog.outfitEngine && (
        <OutfitColorPicker
          engine={catalog.outfitEngine}
          value={outfitColors}
          onChange={setOutfitColors}
          disabled={createFieldsDisabled || !catalog.loaded || catalog.loading}
        />
      )}
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
