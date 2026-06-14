// account_characters data access (E4). character_id == player_id.
import type Database from 'better-sqlite3';
import type { AccountCharacterRow } from '../persist/types.js';

export class CharacterStore {
  constructor(private readonly db: Database.Database) {}

  insert(row: AccountCharacterRow): void {
    this.db
      .prepare(
        `INSERT INTO account_characters (character_id, account_id, name, world_id, sex, outfit_id, created_at, created_receipt)
         VALUES (@character_id, @account_id, @name, @world_id, @sex, @outfit_id, @created_at, @created_receipt)`,
      )
      .run(row);
  }

  listByAccount(accountId: string): AccountCharacterRow[] {
    return this.db
      .prepare(`SELECT * FROM account_characters WHERE account_id = ? ORDER BY created_at`)
      .all(accountId) as AccountCharacterRow[];
  }

  findById(characterId: string): AccountCharacterRow | undefined {
    return this.db
      .prepare(`SELECT * FROM account_characters WHERE character_id = ?`)
      .get(characterId) as AccountCharacterRow | undefined;
  }

  updateOutfit(characterId: string, outfitId: string): void {
    this.db
      .prepare(`UPDATE account_characters SET outfit_id = ? WHERE character_id = ?`)
      .run(outfitId, characterId);
  }

  countForAccount(accountId: string): number {
    return (this.db.prepare(`SELECT count(*) c FROM account_characters WHERE account_id = ?`).get(accountId) as { c: number }).c;
  }
}
