export class CharacterStore {
    db;
    constructor(db) {
        this.db = db;
    }
    insert(row) {
        this.db
            .prepare(`INSERT INTO account_characters (character_id, account_id, name, world_id, sex, outfit_id, created_at, created_receipt)
         VALUES (@character_id, @account_id, @name, @world_id, @sex, @outfit_id, @created_at, @created_receipt)`)
            .run(row);
    }
    listByAccount(accountId) {
        return this.db
            .prepare(`SELECT * FROM account_characters WHERE account_id = ? ORDER BY created_at`)
            .all(accountId);
    }
    findById(characterId) {
        return this.db
            .prepare(`SELECT * FROM account_characters WHERE character_id = ?`)
            .get(characterId);
    }
    updateOutfit(characterId, outfitId) {
        this.db
            .prepare(`UPDATE account_characters SET outfit_id = ? WHERE character_id = ?`)
            .run(outfitId, characterId);
    }
    countForAccount(accountId) {
        return this.db.prepare(`SELECT count(*) c FROM account_characters WHERE account_id = ?`).get(accountId).c;
    }
}
