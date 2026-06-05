// Account-gated character service (E4 / AKALYNTH_ACCOUNT_CHARACTER_V2_V1).
//
// Reuses the existing player+token primitives via injection (mintCharacter =
// the server's createCharacterHandler; issuePlayToken wraps signToken) so it
// does not rewrite the core identity path. Records the account linkage + chosen
// world/sex/outfit and emits privacy-bounded character lifecycle receipts.
import { CharacterStore } from './store.js';
import { WORLDS, OUTFITS, worldById, outfitById, outfitsForSex, isSex } from './catalog.js';
import { RECEIPT_ACTIONS } from '../persist/types.js';
import type { CharacterCreateResult } from '../api/http.js';

export interface PlayToken {
  token: string;
  expires_at: number;
}

export interface CharacterServiceDeps {
  store: CharacterStore;
  /** Create a player + initial play token (the server's createCharacterHandler). */
  mintCharacter: (name: string) => CharacterCreateResult;
  /** Issue a fresh play token for an EXISTING character (select). */
  issuePlayToken: (characterId: string) => PlayToken | null;
  /** Privacy-bounded receipt emit; inputs carry ids/world/outfit/sex only. */
  emitReceipt: (e: { action: string; accountId: string; characterId?: string; inputs?: Record<string, unknown>; result: string }) => void;
  now: () => number;
  maxCharactersPerAccount: number;
}

export interface CharacterResult {
  status: number;
  body: unknown;
}

const bad = (message: string): CharacterResult => ({ status: 400, body: { ok: false, error: 'invalid_input', message } });

export class CharacterService {
  constructor(private readonly d: CharacterServiceDeps) {}

  worlds(): CharacterResult {
    return { status: 200, body: { worlds: WORLDS } };
  }

  outfits(sex: string | null): CharacterResult {
    const list = isSex(sex) ? outfitsForSex(sex) : OUTFITS;
    return { status: 200, body: { outfits: list } };
  }

  list(accountId: string): CharacterResult {
    const characters = this.d.store.listByAccount(accountId).map((c) => ({
      character_id: c.character_id,
      name: c.name,
      world_id: c.world_id,
      sex: c.sex,
      outfit_id: c.outfit_id,
      created_at: c.created_at,
    }));
    return { status: 200, body: { characters } };
  }

  create(accountId: string, input: { name?: unknown; world_id?: unknown; sex?: unknown; outfit_id?: unknown }): CharacterResult {
    const { name, world_id, sex, outfit_id } = input;
    if (typeof name !== 'string') return bad('name is required');
    if (typeof world_id !== 'string' || !worldById(world_id)) return bad('unknown world');
    if (!isSex(sex)) return bad('sex must be "male" or "female"');
    if (typeof outfit_id !== 'string') return bad('outfit_id is required');
    const outfit = outfitById(outfit_id);
    if (!outfit || outfit.sex !== sex) return bad('unknown outfit for the chosen sex');

    if (this.d.store.countForAccount(accountId) >= this.d.maxCharactersPerAccount) {
      return { status: 409, body: { ok: false, error: 'character_limit', message: 'Character limit reached for this account.' } };
    }

    // Reuse the core player+token creation (name validation/uniqueness lives there).
    const minted = this.d.mintCharacter(name);
    if (!minted.ok) {
      return { status: minted.status, body: { ok: false, error: minted.code, message: minted.message } };
    }

    this.d.store.insert({
      character_id: minted.player_id,
      account_id: accountId,
      name: minted.name,
      world_id,
      sex,
      outfit_id,
      created_at: new Date(this.d.now()).toISOString(),
      created_receipt: null,
    });

    this.d.emitReceipt({ action: RECEIPT_ACTIONS.CHARACTER_CREATED, accountId, characterId: minted.player_id, inputs: { world_id, sex, outfit_id }, result: 'ok' });
    this.d.emitReceipt({ action: RECEIPT_ACTIONS.CHARACTER_WORLD_ASSIGNED, accountId, characterId: minted.player_id, inputs: { world_id }, result: 'ok' });
    this.d.emitReceipt({ action: RECEIPT_ACTIONS.CHARACTER_OUTFIT_SELECTED, accountId, characterId: minted.player_id, inputs: { sex, outfit_id }, result: 'ok' });

    return {
      status: 201,
      body: {
        ok: true,
        character: { character_id: minted.player_id, name: minted.name, world_id, sex, outfit_id },
        token: minted.token,
        expires_at: minted.expires_at,
      },
    };
  }

  select(accountId: string, input: { character_id?: unknown }): CharacterResult {
    const cid = input.character_id;
    if (typeof cid !== 'string') return bad('character_id is required');
    const row = this.d.store.findById(cid);
    if (!row || row.account_id !== accountId) return { status: 404, body: { ok: false, error: 'not_found' } };

    const tok = this.d.issuePlayToken(cid);
    if (!tok) return { status: 503, body: { ok: false, error: 'token_unavailable' } };

    this.d.emitReceipt({ action: RECEIPT_ACTIONS.CHARACTER_SELECTED, accountId, characterId: cid, inputs: { world_id: row.world_id }, result: 'ok' });
    return {
      status: 200,
      body: {
        ok: true,
        character: { character_id: row.character_id, name: row.name, world_id: row.world_id, sex: row.sex, outfit_id: row.outfit_id },
        token: tok.token,
        expires_at: tok.expires_at,
      },
    };
  }
}
