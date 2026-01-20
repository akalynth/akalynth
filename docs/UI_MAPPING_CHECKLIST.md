# Akalynth Mobile UI v0 - Implementation Mapping Checklist

Source spec: docs/UI_PROPOSAL.md (v0.3 FINAL FREEZE)

| Spec Item | Server Message | Client Component | Status |
|-----------|----------------|------------------|--------|
| Layout: thumb-zone layout with dead zone | client-only | HudLayout.kt | [ ] |
| Layout: D-pad left, actions right, dead zone >=100px | client-only | HudLayout.kt | [ ] |
| Layout: D-pad is 8-direction | client-only | DPadView.kt | [ ] |
| Layout: top bar is status-only (HP/Rep/Gold/Menu/Why) | client-only | TopBar.kt | [ ] |
| Layout: left thumb zone contains movement only | client-only | DPadView.kt | [ ] |
| Layout: right thumb zone contains actions only | client-only | ActionBar.kt | [ ] |
| Layout: dead zone contains no buttons | client-only | HudLayout.kt | [ ] |
| Layout: hitbox minimums (D-pad/actions 44x44, hotbar 48x48) | client-only | HudLayout.kt | [ ] |
| Layout: hotbar slot spacing >=10px | client-only | HotbarView.kt | [ ] |
| Layout: top bar slots reserved, stage gating hides visibility only | client-only | TopBar.kt | [ ] |
| Layout: disconnect only via Menu -> Settings | client-only | SettingsScreen.kt | [ ] |
| Confirmations: Tier 0-3 enabled | client-only | ConfirmationsController.kt | [ ] |
| Tier 0 instant (move/chat/target) | client-only | InputController.kt | [ ] |
| Tier 1 tap (attack/use/cast) + cooldown + feedback | client-only | ActionButton.kt | [ ] |
| Tier 2 hold 1.5s + progress ring | client-only | HoldConfirmButton.kt | [ ] |
| Tier 3 slide confirm for legendary drop/destroy + decay timer | client-only | SlideConfirmView.kt | [ ] |
| Release cancels Tier 2/3 | client-only | ConfirmationsController.kt | [ ] |
| Tier 3 classification rule (legendary => Tier 3 else Tier 2) | inventory_snapshot | DropConfirmController.kt | [ ] |
| Progressive disclosure: local state; visibility gating, not position | client-only | UnlockController.kt | [ ] |
| Stage 0/1/2/3 triggers + unlocks + persistence (DataStore/SharedPrefs) | client-only | UnlockStore.kt | [ ] |
| Chat toggle opens bottom sheet (half height); swipe down closes | client-only | ChatSheet.kt | [ ] |
| Nearby players read-only (name + hostility dot only) | world_state | NearbyPlayersView.kt | [ ] |
| Why recap: Level 1-2 only | death_notice / chronicle_snapshot | DeathRecapController.kt | [ ] |
| Death notice includes lost_items summary (kind/qty/rarity) | death_notice | n/a | [ ] |
| Death notice includes chronicle_event_id (optional link) | death_notice | n/a | [ ] |
| Level 1 death toast within 500ms | death_notice | DeathToast.kt | [ ] |
| Level 1 toast auto-dismiss 5s; shows items lost; tap for details | death_notice (lost_items) | DeathToast.kt | [ ] |
| Level 2 recap sheet (half height) | chronicle_snapshot | DeathRecapSheet.kt | [ ] |
| Level 2 shows killer/location/time/items lost | chronicle_snapshot | DeathRecapSheet.kt | [ ] |
| Copy Event ID to clipboard (evidence_ref.chronicle_event_id) | chronicle_snapshot | DeathRecapSheet.kt | [ ] |
| No forensic math displayed (drop breakdown, RNG, weights) | evidence_snapshot (ignored in v0) | DeathRecapSheet.kt | [ ] |
| No receipt hashes displayed or copied in v0 | chronicle_snapshot | DeathRecapSheet.kt | [ ] |
| Chronicle feed (simple list) | get_chronicle / chronicle_snapshot | ChronicleSheet.kt | [ ] |
| Chronicle grouped by day | chronicle_snapshot | ChronicleSheet.kt | [ ] |
| Chronicle event icons per kind | chronicle_snapshot | ChronicleRow.kt | [ ] |
| Chronicle item_lost grouped under death | chronicle_snapshot | ChronicleSheet.kt | [ ] |
| Chronicle pagination (before/limit) + Load more | get_chronicle | ChronicleSheet.kt | [ ] |
| Chronicle death events tappable -> recap | chronicle_snapshot | ChronicleSheet.kt | [ ] |
| Identity: character creation v0 | TBD (server: world_state PlayerPublic) | CreateCharacterScreen.kt | [ ] |
| Sex selection UI (male/female) | TBD (server: world_state PlayerPublic) | CreateCharacterScreen.kt | [ ] |
| Male/female selection stored server-side | TBD (server: world_state PlayerPublic) | CreateCharacterScreen.kt | [ ] |
| Starter outfit assigned server-side | TBD (server: world_state PlayerPublic) | CreateCharacterScreen.kt | [ ] |
| Synced on login | TBD (server: world_state PlayerPublic) | CreateCharacterScreen.kt | [ ] |
| Starter outfit cosmetic only (no stats/bonuses) | client-only | CharacterProfile.kt | [ ] |
| No outfit picker in v0 | client-only | CreateCharacterScreen.kt | [ ] |
| No outfit receipts (no chronicle/evidence entries) | client-only | InventoryModel.kt | [ ] |
| Outfit not inventory/equipment/economy objects | client-only | InventoryModel.kt | [ ] |
| Rename / alias message for v0 contract | TBD (server: world_state PlayerPublic) | n/a | [ ] |
