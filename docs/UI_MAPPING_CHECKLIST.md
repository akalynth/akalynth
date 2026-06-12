# Akalynth Mobile UI v0 - Implementation Mapping Checklist

Maps each v0 UI spec item to its server message and Android client component.

Source spec: `docs/UI_PROPOSAL.md` (v0.3 FINAL FREEZE)

> **Verification pass (2026-05-30):** The Client Component column has been
> reconciled with the actual Android source tree under
> `apps/android/app/src/main/java/com/akalynth/client/`. Paths are relative to
> `ui/components/` unless noted. Component names that had no matching source file
> are marked `(no exact match)` and flagged for human review. Status checkboxes
> are left unchanged — presence of a file does not prove the row's behavior is
> fully implemented or tested.

| Spec Item | Server Message | Client Component | Status |
|-----------|----------------|------------------|--------|
| Layout: thumb-zone layout with dead zone | client-only | hud/GameHUD.kt | [ ] |
| Layout: D-pad left, actions right, dead zone >=100px | client-only | hud/GameHUD.kt | [ ] |
| Layout: D-pad is 8-direction | client-only | movement/DPad.kt | [ ] |
| Layout: top bar is status-only (HP/Rep/Gold/Menu/Why) | client-only | topbar/TopBar.kt | [ ] |
| Layout: left thumb zone contains movement only | client-only | movement/DPad.kt | [ ] |
| Layout: right thumb zone contains actions only | client-only | ActionButtons.kt | [ ] |
| Layout: dead zone contains no buttons | client-only | hud/GameHUD.kt | [ ] |
| Layout: hitbox minimums (D-pad/actions 44x44, hotbar 48x48) | client-only | hud/GameHUD.kt | [ ] |
| Layout: hotbar slot spacing >=10px | client-only | hotbar/Hotbar.kt | [ ] |
| Layout: top bar slots reserved, stage gating hides visibility only | client-only | topbar/TopBar.kt | [ ] |
| Layout: disconnect only via Menu -> Settings | client-only | (no exact match; FLAG) | [ ] |
| Confirmations: Tier 0-3 enabled | client-only | confirmation/ (Tier2HoldButton.kt, Tier3SlideConfirm.kt) | [ ] |
| Tier 0 instant (move/chat/target) | client-only | (no exact match; movement/DPad.kt, ChatOverlay.kt) | [ ] |
| Tier 1 tap (attack/use/cast) + cooldown + feedback | client-only | ActionButtons.kt | [ ] |
| Tier 2 hold 1.5s + progress ring | client-only | confirmation/Tier2HoldButton.kt | [ ] |
| Tier 3 slide confirm for legendary drop/destroy + decay timer | client-only | confirmation/Tier3SlideConfirm.kt | [ ] |
| Release cancels Tier 2/3 | client-only | confirmation/Tier2HoldButton.kt, Tier3SlideConfirm.kt | [ ] |
| Tier 3 classification rule (legendary => Tier 3 else Tier 2) | inventory_snapshot | hotbar/DropConfirmationOverlay.kt | [ ] |
| Progressive disclosure: local state; visibility gating, not position | client-only | progression/UnlockState.kt | [ ] |
| Stage 0/1/2/3 triggers + unlocks + persistence (DataStore/SharedPrefs) | client-only | progression/UnlockRepository.kt | [ ] |
| Chat toggle opens bottom sheet (half height); swipe down closes | client-only | ChatOverlay.kt | [ ] |
| Nearby players read-only (name + hostility dot only) | world_state | (no exact match; FLAG) | [ ] |
| Why recap: Level 1-2 only | death_notice / chronicle_snapshot | death/DeathRecapSheet.kt, why/WhyExplanationSheet.kt | [ ] |
| Death notice includes lost_items summary (kind/qty/rarity) | death_notice | n/a | [ ] |
| Death notice includes chronicle_event_id (optional link) | death_notice | n/a | [ ] |
| Level 1 death toast within 500ms | death_notice | death/DeathToast.kt | [ ] |
| Level 1 toast auto-dismiss 5s; shows items lost; tap for details | death_notice (lost_items) | death/DeathToast.kt | [ ] |
| Level 2 recap sheet (half height) | chronicle_snapshot | death/DeathRecapSheet.kt | [ ] |
| Level 2 shows killer/location/time/items lost | chronicle_snapshot | death/DeathRecapSheet.kt | [ ] |
| Copy Event ID to clipboard (evidence_ref.chronicle_event_id) | chronicle_snapshot | death/DeathRecapSheet.kt | [ ] |
| No forensic math displayed (drop breakdown, RNG, weights) | evidence_snapshot (ignored in v0) | death/DeathRecapSheet.kt | [ ] |
| No receipt hashes displayed or copied in v0 | chronicle_snapshot | death/DeathRecapSheet.kt | [ ] |
| Chronicle feed (simple list) | get_chronicle / chronicle_snapshot | chronicle/ChronicleSheet.kt | [ ] |
| Chronicle grouped by day | chronicle_snapshot | chronicle/ChronicleSheet.kt | [ ] |
| Chronicle event icons per kind | chronicle_snapshot | chronicle/ChronicleSheet.kt | [ ] |
| Chronicle item_lost grouped under death | chronicle_snapshot | chronicle/ChronicleSheet.kt | [ ] |
| Chronicle pagination (before/limit) + Load more | get_chronicle | chronicle/ChronicleSheet.kt | [ ] |
| Chronicle death events tappable -> recap | chronicle_snapshot | chronicle/ChronicleSheet.kt | [ ] |
| Identity: account-character creation v2 | POST /v1/characters | character/CharacterCreateScreen.kt + CharacterCreateActivity.kt | [x] |
| World selection UI | world_id in POST /v1/characters | character/CharacterCreateScreen.kt | [x] |
| Sex selection UI (male/female) | sex in POST /v1/characters | character/CharacterCreateScreen.kt | [x] |
| Outfit selection UI | outfit_id in POST /v1/characters | character/CharacterCreateScreen.kt | [x] |
| World/sex/outfit stored server-side | account_characters + receipts | CharacterCreateActivity.kt | [x] |
| Synced on login | selected account character projection | CharacterCreateActivity.kt | [x] |
| Starter outfit cosmetic only (no stats/bonuses) | client-only | (no exact match; FLAG) | [ ] |
| Outfit picker filters by selected sex | client-only + server catalog parity | character/CharacterCreateScreen.kt | [x] |
| No outfit receipts (no chronicle/evidence entries) | client-only | (no exact match; FLAG) | [ ] |
| Outfit not inventory/equipment/economy objects | client-only | (no exact match; FLAG) | [ ] |
| Legacy Azura world id rejected for account-character creation | POST /v1/characters | verify-character-v2.test.ts | [x] |
