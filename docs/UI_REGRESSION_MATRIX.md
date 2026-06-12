# UI Regression Matrix

**Version**: 1.0
**Baseline**: UI_PROPOSAL.md v0.3 (FROZEN)
**Enforcement**: All assertions must pass before PR merge

> This matrix defines the behavioral contract for Android UI. Each row maps to one or more automated tests. Violations block merge.

---

## Legend

| Symbol | Meaning |
|--------|---------|
| **T0** | Instant (no confirmation) |
| **T1** | Single tap + feedback + cooldown |
| **T2** | Hold 1.5s with progress ring |
| **T3** | Slide ≥90% threshold |
| **≤Nms** | Hard timing constraint |
| **±Nms** | Acceptable tolerance |

---

## 1. Movement & Thumb Zones

| ID | Action | Tier | Timing | State Transition | Assertion |
|----|--------|------|--------|------------------|-----------|
| M1 | D-pad press (N/NE/E/SE/S/SW/W/NW) | T0 | input → movement ≤50ms | none | Direction maps correctly incl diagonals; continuous while held |
| M2 | D-pad release | T0 | release → stop ≤50ms | none | Releasing stops movement; no "stuck" movement |
| M3 | D-pad hitbox | T0 | n/a | none | Each direction button hitbox ≥44dp |
| M4 | Dead zone separation | n/a | n/a | none | Min distance D-pad↔action ≥100dp in all layouts |

### Test Coverage

```text
M1 → DPadTest.allEightDirectionsMapCorrectly()
M1 → DPadTest.holdingDirectionMaintainsMovement()
M2 → DPadTest.releasingStopsMovement()
M3 → DPadTest.allButtonsHaveMinimumHitbox()
M4 → GameHUDTest.deadZoneEnforced()
M4 → GameHUDTest.deadZoneEnforcedSmallScreen()
```

---

## 2. Combat Action Safety (Attack)

| ID | Action | Tier | Timing | State Transition | Assertion |
|----|--------|------|--------|------------------|-----------|
| A1 | Attack tap | T1 | feedback immediate; cooldown ≤300ms visible | `hasEngagedCombat=true` | Tap triggers exactly 1 attack; cooldown blocks re-trigger |
| A2 | Attack spam during cooldown | T1 | n/a | none | No additional attacks; cooldown overlay remains |
| A3 | Attack visibility (Stage 0) | n/a | n/a | none | Attack button NOT visible at Stage 0 |
| A4 | Attack visibility (Stage 1+) | n/a | n/a | none | Attack button visible at Stage ≥1 |

### Test Coverage

```text
A1 → Tier1ButtonTest.tapTriggersExactlyOneCallback()
A1 → Tier1ButtonTest.cooldownOverlayAppearsAfterTap()
A2 → Tier1ButtonTest.tapDuringCooldownIsIgnored()
A3 → GameHUDTest.attackHiddenAtStage0()
A4 → GameHUDTest.attackVisibleAtStage1()
```

---

## 3. Inventory Safety (Drops)

| ID | Action | Tier | Timing | State Transition | Assertion |
|----|--------|------|--------|------------------|-----------|
| D1 | Drop normal item (hold) | T2 | holdDuration=1500ms ±100ms | none | Release <1500ms cancels; ≥1500ms confirms once |
| D2 | Release during hold | T2 | cancel immediate | none | `onCancel` invoked; progress resets to 0 |
| D3 | Drop legendary (slide) | T3 | confirm at progress ≥0.9 | none | <0.9 snaps back; ≥0.9 confirms once |
| D4 | Legendary incomplete slide | T3 | snap-back ≤200ms | none | Progress animates to 0; no confirm callback |
| D5 | Legendary dismiss | T3 | immediate | none | Dismiss closes sheet; no drop |
| D6 | Hotbar visibility (Stage <2) | n/a | n/a | none | Hotbar NOT visible at Stage <2 |
| D7 | Hotbar visibility (Stage 2+) | n/a | n/a | none | Hotbar visible at Stage ≥2 |

### Test Coverage

```text
D1 → Tier2HoldButtonTest.holdFullDurationConfirms()
D1 → Tier2HoldButtonTest.holdDurationIs1500ms()
D2 → Tier2HoldButtonTest.releaseBeforeCompletionCancels()
D2 → Tier2HoldButtonTest.progressResetsOnCancel()
D3 → Tier3SlideConfirmTest.slideAboveThresholdConfirms()
D4 → Tier3SlideConfirmTest.slideBelowThresholdSnapsBack()
D4 → Tier3SlideConfirmTest.snapBackAnimationCompletes()
D5 → Tier3SlideConfirmTest.dismissClosesWithoutConfirm()
D6 → GameHUDTest.hotbarHiddenAtStage0()
D6 → GameHUDTest.hotbarHiddenAtStage1()
D7 → GameHUDTest.hotbarVisibleAtStage2()
```

---

## 4. Progressive Disclosure (Unlock Stages)

| ID | Trigger | Stage | Timing | Persistence | Assertion |
|----|---------|-------|--------|-------------|-----------|
| U1 | Fresh install | 0 | n/a | default | Only D-pad + HP + Chat visible |
| U2 | First combat | 1 | update ≤250ms | persisted | Attack visible; persists after restart |
| U3 | First item pickup | 2 | update ≤250ms | persisted | Hotbar visible; persists after restart |
| U4 | First death | 3 | update ≤250ms | persisted | Rep/Gold/Nearby/Why visible; persists |
| U5 | Stage monotonicity | all | n/a | must never regress | Stage never decreases |
| U6 | DataStore write | all | n/a | verified | Write confirmed before stage change acknowledged |

### Test Coverage

```text
U1 → UnlockStateTest.freshInstallIsStage0()
U1 → GameHUDTest.stage0ShowsOnlyDpadHpChat()
U2 → UnlockStateTest.combatTriggersStage1()
U2 → UnlockStateTest.stage1PersistsAfterRestart()
U3 → UnlockStateTest.itemPickupTriggersStage2()
U3 → UnlockStateTest.stage2PersistsAfterRestart()
U4 → UnlockStateTest.deathTriggersStage3()
U4 → UnlockStateTest.stage3PersistsAfterRestart()
U5 → UnlockStateTest.stageNeverDecreases()
U6 → UnlockRepositoryTest.writeConfirmedBeforeStateChange()
```

---

## 5. Death Experience

| ID | Action | Tier | Timing | State Transition | Assertion |
|----|--------|------|--------|------------------|-----------|
| X1 | Death toast appears | n/a | ≤500ms after death | `hasDied=true` | Toast renders; contains items lost |
| X2 | Toast auto-dismiss | n/a | dismiss at 5000ms ±250ms | none | Disappears without interaction |
| X3 | Tap toast → recap | n/a | sheet opens ≤300ms | none | Correct killer/location/time displayed |
| X4 | Copy event ID | n/a | clipboard set ≤300ms | none | Copies `chronicleEventId` |
| X5 | Why button visibility | n/a | n/a | none | Why button visible only at Stage ≥2 |

### Test Coverage

```text
X1 → DeathToastTest.appearsWithin500ms()
X1 → DeathToastTest.showsItemsLost()
X2 → DeathToastTest.autoDismissesAt5000ms()
X3 → DeathToastTest.tapOpensRecapSheet()
X3 → DeathRecapSheetTest.displaysCorrectDetails()
X4 → DeathRecapSheetTest.copyEventIdWorks()
X5 → GameHUDTest.whyButtonHiddenBeforeStage2()
X5 → GameHUDTest.whyButtonVisibleAtStage2()
```

---

## 6. Chronicle Feed

| ID | Action | Tier | Timing | State Transition | Assertion |
|----|--------|------|--------|------------------|-----------|
| C1 | Open chronicle | n/a | open ≤300ms | none | Events grouped by day |
| C2 | Death event row tap | n/a | recap opens ≤300ms | none | Only death rows are tappable |
| C3 | Load more | n/a | request immediate | none | Pagination trigger fires once per tap |
| C4 | Event icons | n/a | n/a | none | Correct icon for each event kind |

### Test Coverage

```text
C1 → ChronicleSheetTest.eventsGroupedByDay()
C2 → ChronicleSheetTest.deathRowOpensRecap()
C2 → ChronicleSheetTest.nonDeathRowsNotTappable()
C3 → ChronicleSheetTest.loadMoreTriggersPagination()
C4 → ChronicleSheetTest.correctIconsForEventKinds()
```

---

## 7. Character Creation

| ID | Action | Tier | Timing | State Transition | Assertion |
|----|--------|------|--------|------------------|-----------|
| N1 | Enter create screen | n/a | n/a | none | Create button disabled when name empty |
| N2 | Name input | n/a | n/a | none | Max length 16 enforced |
| N3 | World/sex/outfit select | n/a | n/a | none | Selection toggles preview sprite and outfit id |
| N4 | Create submit | n/a | immediate | `character_created` emitted | Emits v2 payload: name, world id, sex, outfit id |

### Test Coverage

```text
N1 → CharacterCreateScreenTest.createDisabledWhenNameEmpty()
N2 → CharacterCreateScreenTest.nameMaxLength16()
N3 → CharacterCreateScreenTest.worldSexOutfitSelectionTogglesSprite()
N4 → CharacterCreateScreenTest.createEmitsCorrectV2Payload()
```

---

## Timing Constants (Canonical)

| Constant | Value | Tolerance | Used By |
|----------|-------|-----------|---------|
| `HOLD_DURATION_MS` | 1500 | ±100ms | T2 confirmations |
| `SLIDE_THRESHOLD` | 0.9 | exact | T3 confirmations |
| `COOLDOWN_MS` | 500 | ±50ms | T1 attack cooldown |
| `TOAST_DURATION_MS` | 5000 | ±250ms | Death toast |
| `TOAST_APPEAR_MS` | 500 | max | Death toast trigger |
| `SHEET_OPEN_MS` | 300 | max | Any sheet/dialog |
| `STAGE_UPDATE_MS` | 250 | max | Unlock transitions |
| `SNAP_BACK_MS` | 200 | max | T3 slide reset |
| `DEAD_ZONE_DP` | 100 | min | Thumb zone separation |
| `MIN_HITBOX_DP` | 44 | min | Touch targets |

---

## Regression Test Execution

### Pre-merge Gate

All tests in this matrix must pass before PR merge. CI runs:

```bash
./gradlew :app:testDebugUnitTest --tests "*.ui.regression.*"
```

### Test Structure

```text
app/src/test/java/com/akalynth/client/ui/regression/
├── CharacterCreateScreenTest.kt
├── ChronicleSheetTest.kt
├── DPadTest.kt
├── DeathRecapSheetTest.kt
├── DeathToastTest.kt
├── FakeDataStore.kt            # test helper
├── GameHUDTest.kt
├── HotbarDropConfirmationTest.kt
├── HotbarTest.kt
├── Tier1ButtonTest.kt
├── Tier2HoldButtonTest.kt
├── Tier3SlideConfirmTest.kt
├── TopBarTest.kt
├── UnlockRepositoryTest.kt
├── UnlockStateTest.kt
└── WhyExplanationSheetTest.kt
```

### Failure Policy

| Failure Type | Action |
|--------------|--------|
| Timing violation | Block merge; adjust implementation |
| Missing visibility state | Block merge; fix stage gating |
| Persistence failure | Block merge; verify DataStore write |
| Hitbox violation | Block merge; increase touch target |

---

## Amendment Rule

Changes to this matrix require:

1. Update this document
2. Update corresponding tests
3. Review by 2+ engineers
4. Bump version header

**Locked assertions** (cannot weaken without architectural review):
- Dead zone ≥100dp
- Hold duration 1500ms
- Slide threshold 0.9
- Hitbox ≥44dp

---

*Document version: 1.0*
*Last updated: 2026-01-21*
*Related: UI_PROPOSAL.md, UI_IMPLEMENTATION_PROPOSAL.md*
