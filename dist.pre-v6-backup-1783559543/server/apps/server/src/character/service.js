import { WORLDS, OUTFITS, worldById, outfitById, outfitsForSex, isSex } from './catalog.js';
import { RECEIPT_ACTIONS } from '../persist/types.js';
import { buildLibraryDiscovery } from '../library-discovery.js';
const bad = (message) => ({ status: 400, body: { ok: false, error: 'invalid_input', message } });
export class CharacterService {
    d;
    constructor(d) {
        this.d = d;
    }
    worlds() {
        return { status: 200, body: { worlds: WORLDS } };
    }
    outfits(sex) {
        const list = isSex(sex) ? outfitsForSex(sex) : OUTFITS;
        return { status: 200, body: { outfits: list } };
    }
    list(accountId) {
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
    create(accountId, input) {
        const { name, world_id, sex, outfit_id } = input;
        if (typeof name !== 'string')
            return bad('name is required');
        if (typeof world_id !== 'string')
            return bad('unknown world');
        if (!worldById(world_id))
            return bad('unknown world');
        if (!isSex(sex))
            return bad('sex must be "male" or "female"');
        if (typeof outfit_id !== 'string')
            return bad('outfit_id is required');
        const outfit = outfitById(outfit_id);
        if (!outfit || outfit.sex !== sex)
            return bad('unknown outfit for the chosen sex');
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
    select(accountId, input) {
        const cid = input.character_id;
        if (typeof cid !== 'string')
            return bad('character_id is required');
        const row = this.d.store.findById(cid);
        if (!row || row.account_id !== accountId)
            return { status: 404, body: { ok: false, error: 'not_found' } };
        const tok = this.d.issuePlayToken(cid);
        if (!tok)
            return { status: 503, body: { ok: false, error: 'token_unavailable' } };
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
    updateOutfit(accountId, input) {
        const cid = input.character_id;
        const outfitId = input.outfit_id;
        if (typeof cid !== 'string')
            return bad('character_id is required');
        if (typeof outfitId !== 'string')
            return bad('outfit_id is required');
        const row = this.d.store.findById(cid);
        if (!row || row.account_id !== accountId)
            return { status: 404, body: { ok: false, error: 'not_found' } };
        const outfit = outfitById(outfitId);
        if (!outfit || outfit.sex !== row.sex)
            return bad('unknown outfit for the character sex');
        this.d.store.updateOutfit(cid, outfitId);
        this.d.emitReceipt({
            action: RECEIPT_ACTIONS.CHARACTER_OUTFIT_SELECTED,
            accountId,
            characterId: cid,
            inputs: { sex: row.sex, previous_outfit_id: row.outfit_id, outfit_id: outfitId },
            result: 'ok',
        });
        return {
            status: 200,
            body: {
                ok: true,
                character: {
                    character_id: row.character_id,
                    name: row.name,
                    world_id: row.world_id,
                    sex: row.sex,
                    outfit_id: outfitId,
                    created_at: row.created_at,
                },
            },
        };
    }
    libraryDiscovery(accountId, characterId) {
        if (!characterId)
            return bad('character_id is required');
        const row = this.d.store.findById(characterId);
        if (!row || row.account_id !== accountId) {
            return { status: 404, body: { ok: false, error: 'character_not_found' } };
        }
        return { status: 200, body: buildLibraryDiscovery(characterId) };
    }
}
