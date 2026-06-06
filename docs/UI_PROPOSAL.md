# Akalynth Mobile UI v0 (FREEZE)

The mobile client exists to prevent accidental loss and clarify outcomes. v0 ships safety and clarity. Proof infrastructure defers to v1.

---

## Scope + Non-Goals

| In v0 | Not in v0 |
|-------|-----------|
| Thumb-zone layout with dead zone | Trust Ribbon / verification % |
| Safety confirmations (Tier 0-3) | Forensic breakdown (deterministic_u, weights) |
| Progressive disclosure (local) | Export proof / verify online |
| "Why?" recap (Level 1-2) | Type-to-confirm (Tier 4) |
| Chronicle feed (simple list) | Receipt hashes in UI |
| Male/Female selection | Outfit stats/bonuses |
| Starter outfit (cosmetic only) | Outfit drops/crafting |

---

## 1. Thumb-Zone Layout

```
┌─────────────────────────────────────────────────────────────────┐
│ [Menu]                  STATUS BAR                       [Why?] │
│                         HP ████████░░                           │
│                                                                 │
│                     ┌─────────────────┐                         │
│                     │                 │                         │
│                     │   GAME WORLD    │                         │
│                     │                 │                         │
│                     └─────────────────┘                         │
│                                                                 │
│   ┌───────────┐         ≥100px          ┌───────────┐           │
│   │   D-PAD   │      ◄──────────►       │  ACTIONS  │           │
│   └───────────┘        DEAD ZONE        └───────────┘           │
│                                                                 │
│   LEFT THUMB                                RIGHT THUMB          │
└─────────────────────────────────────────────────────────────────┘
```

### Zone Rules

| Zone | Contains | Never Contains |
|------|----------|----------------|
| Top bar | HP, Rep, Gold, Menu, Why? | Gameplay buttons |
| Left thumb | D-pad (8 directions) | Action buttons |
| Right thumb | Hotbar, Attack | Movement |
| Dead zone | Nothing | Any buttons |

### Minimum Distances

| From | To | Distance |
|------|----|----------|
| D-pad edge | Any action button | ≥100px |
| D-pad edge | Disconnect (in menu) | ∞ (menu-only) |
| Hotbar slots | Each other | ≥10px |

### Hitbox Sizes

| Element | Minimum |
|---------|---------|
| D-pad buttons | 44×44px |
| Action buttons | 44×44px |
| Hotbar slots | 48×48px |

### Stage-Gated Top Bar Slots

The layout is stable; progressive disclosure gates **visibility**, not position.

| Stage | Top Bar Shows |
|-------|---------------|
| 0 | HP + Chat toggle only |
| 1 | + Menu |
| 2 | + Why? |
| 3 | + Rep, Gold, Nearby players |

In Stage 0, [Menu] and [Why?] are hidden; positions remain reserved.

---

## 2. Safety Confirmations

### Tier Definitions

| Tier | Trigger | Confirmation | Undo |
|------|---------|--------------|------|
| **0** | Instant | None | — |
| **1** | Single tap | Button feedback | Cooldown |
| **2** | Hold 1.5s | Progress ring fills | Release cancels |
| **3** | Slide | Thumb drag across track | Decay timer |

### Tier 0: Instant

**Actions**: Movement, chat, targeting

No confirmation. Immediate response.

### Tier 1: Single Tap

**Actions**: Attack, use item, cast spell

Visual feedback (button press animation). Cooldown prevents spam.

### Tier 2: Hold to Confirm

**Actions**: Drop item, unequip

```
┌───────────────────────┐
│     Drop Ration?      │
│                       │
│    ╭──────────╮       │
│    │  ◯────   │       │  ← Ring fills over 1.5s
│    │  HOLD    │       │
│    ╰──────────╯       │
│                       │
│  Release to cancel    │
└───────────────────────┘
```

### Tier 3: Slide to Confirm

**Actions**: Drop legendary, destroy item

```
┌───────────────────────────────────────────┐
│     ⚠ DROP LEGENDARY                     │
│                                           │
│     ⚔ Flame Sword (Tier 3)               │
│     Heat: 5                               │
│                                           │
│     ┌─────────────────────────────┐      │
│     │ ▶ ═══════════════════ DROP │      │
│     └─────────────────────────────┘      │
│                                           │
│     Slide to confirm                      │
└───────────────────────────────────────────┘
```

**Classification rule**: Tier 3 applies when `item.rarity >= LEGENDARY`, otherwise Tier 2.

**Note**: Tier 4 (type-to-confirm) deferred to v1.

---

## 3. Progressive Disclosure

UI complexity unlocks as players progress. State stored locally (DataStore/SharedPrefs). No receipts required.

### Stages

| Stage | Trigger | Unlocks |
|-------|---------|---------|
| **0** | Enter world | D-pad, HP, Chat toggle |
| **1** | First combat | Attack button, Menu button |
| **2** | First item pickup | Hotbar (4 slots), "Why?" button |
| **3** | First death | Rep, Gold, Nearby players |

**Nearby players** is read-only: name + hostility dot only. No inspect, no actions from it in v0.

**Chat toggle** opens a bottom sheet (half height). Closes on swipe down.

### Stage 0: Tutorial Entry

```
┌─────────────────────────────────────────────────────────────────┐
│                                                                 │
│                         ┌─────────────┐                         │
│                         │   WORLD     │                         │
│                         └─────────────┘                         │
│                                                                 │
│   ┌───┐                                                         │
│   │ ↑ │                                                         │
│ ┌─┼───┼─┐                              HP ████████████ 100%    │
│ │←│   │→│                                                       │
│ └─┼───┼─┘                                          [Chat ...]  │
│   │ ↓ │                                                         │
│   └───┘                                                         │
└─────────────────────────────────────────────────────────────────┘
```

### Stage 3: Full UI

```
┌─────────────────────────────────────────────────────────────────┐
│ [Menu]      REP: -3    HP ████████░░    GOLD: 150        [Why?] │
│                                                                 │
│                         ┌─────────────┐                         │
│                         │   WORLD     │   Nearby: 2 players    │
│                         └─────────────┘                         │
│                                                                 │
│   ┌───┐                                           ┌───┬───┐     │
│   │ ↑ │                                           │ 1 │ 2 │     │
│ ┌─┼───┼─┐                                         ├───┼───┤     │
│ │←│   │→│                                         │ 3 │ 4 │     │
│ └─┼───┼─┘                                         └───┴───┘     │
│   │ ↓ │                                             [⚔]        │
│   └───┘                                                         │
└─────────────────────────────────────────────────────────────────┘
```

### Unlock Persistence

```kotlin
data class UnlockState(
    val hasEngagedCombat: Boolean = false,
    val hasPickedUpItem: Boolean = false,
    val hasDied: Boolean = false
)
```

Stored in local DataStore. Persists across sessions.

---

## 4. "Why?" Recap (Evidence Lite)

Reduces rage by explaining losses. v0 ships Level 1-2 only.

### Level 1: Death Toast

Appears for 5 seconds after death. Auto-dismisses.

```
┌─────────────────────────────────────────┐
│  ☠ You died                             │
│  Lost: Flame Sword, 2 Rations           │
│                                         │
│  [TAP FOR DETAILS]                      │
└─────────────────────────────────────────┘
```

### Level 2: Recap Sheet

Half-sheet modal. Shows what happened, not forensic math.

```
┌─────────────────────────────────────────────────────────────────┐
│  DEATH RECAP                                               [X] │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  Killed by: DarkMage_99                                        │
│  Location: High City (12, 45)                                  │
│  Time: 14:32:07                                                │
│                                                                 │
│  ITEMS LOST (3):                                               │
│  • Flame Sword [LEGENDARY]                                     │
│  • Ration                                                      │
│  • Ration                                                      │
│                                                                 │
│  [COPY EVENT ID]                                               │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### Wire Format

Consumes `DeathNoticeMessage` and `ChronicleEvent`:

```typescript
// Simplified v0 view. The canonical type in packages/shared/protocol.ts
// also carries ok: true plus optional DeathNoticeExtras
// (chronicle_event_id, lost_items, killer_name, zone, x, y, time).
interface DeathNoticeMessage {
  type: 'death_notice';
  respawn_in_ms: number;
  map: MapName;
  spawn: { x: number; y: number };
  reason: string;
}

interface ChronicleEvent {
  kind: string;            // 'death', 'item_lost', etc.
  timestamp: string;
  zone: string | null;
  x: number | null;
  y: number | null;
  details: Record<string, unknown>;
  evidence_ref?: EvidenceRef;  // present but not displayed in v0
}
```

**"Copy Event ID"** copies `evidence_ref.chronicle_event_id` to clipboard (support/debug). Receipt hashes are not displayed or copied in v0.

### Not in v0

- Drop calculation breakdown
- Per-item weights
- Deterministic RNG values
- Export JSON button
- Verify online button

---

## 5. Chronicle v0

Simple history feed. Grouped by day.

### Layout

```
┌─────────────────────────────────────────────────────────────────┐
│  MY CHRONICLE                                              [X] │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  TODAY                                                          │
│  • 14:32  ☠ Died at High City (12, 45)                         │
│  • 14:28  ⚔ Killed RatBoy_12                                   │
│  • 14:15  📦 Picked up Iron Shield                             │
│  • 13:42  🏛 Entered High City                                  │
│                                                                 │
│  YESTERDAY                                                      │
│  • 22:15  🎓 Completed tutorial                                │
│  • 22:00  ✨ Character created                                 │
│                                                                 │
│  [LOAD MORE]                                                    │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### Event Icons

| Kind | Icon | Display |
|------|------|---------|
| `death` | ☠ | "Died at {zone} ({x}, {y})" |
| `item_lost` | — | (grouped under death) |
| `item_pickup` | 📦 | "Picked up {item_type}" |
| `zone_enter` | 🏛 | "Entered {zone}" |
| `combat_kill` | ⚔ | "Killed {target_name}" |
| `tutorial_complete` | 🎓 | "Completed tutorial" |
| `character_created` | ✨ | "Character created" |

### Wire Format

```typescript
// Request
interface GetChronicleMessage {
  type: 'get_chronicle';
  player_id?: string;  // omit for self
  limit?: number;      // default 50
  before?: string;     // ISO8601 pagination cursor
}

// Response
interface ChronicleSnapshotMessage {
  type: 'chronicle_snapshot';
  player_id: string;
  events: ChronicleEvent[];
  has_more: boolean;
}
```

### Not in v0

- Tap to expand (just shows toast if death)
- Filter by event type
- Search

---

## 6. Character Identity (v0)

Minimal identity for character creation. Cosmetic only, no ledger impact.

### Sex Selection

| Option | Affects | Does NOT Affect |
|--------|---------|-----------------|
| Male | Base sprite, animations | Stats, hitboxes, drops |
| Female | Base sprite, animations | NPC reactions, economy |

Chosen once at character creation. Permanent in v0.

### Outfit System

| Property | v0 Behavior |
|----------|-------------|
| Slots | 1 (single outfit slot) |
| Available | Starter outfit only |
| Bonuses | None |
| Drops | No (cosmetic flag, not item) |
| Receipts | None emitted |

### Character Creation UI

```
┌───────────────────────────────┐
│  CREATE CHARACTER             │
├───────────────────────────────┤
│                               │
│  Name: [___________]          │
│                               │
│  Sex:                         │
│   (●) Male   (○) Female       │
│                               │
│  [  character sprite  ]       │
│                               │
│        [ CREATE ]             │
└───────────────────────────────┘
```

No outfit picker in v0. Starter outfit auto-assigned based on sex.

### Where It Lives

| Data | Storage | Synced |
|------|---------|--------|
| Sex | Server (player record) | On login |
| Outfit | Server (player record) | On login |

**Not** treated as:
- Inventory items
- Equipment slots
- Economy objects
- Chronicle events

Sex/outfit are part of the player profile snapshot, not a receipt-driven system.

---

## Non-Goals (v0)

Explicitly out of scope:

| Feature | Reason | When |
|---------|--------|------|
| Trust Ribbon | Semantics unclear, support burden | v1+ |
| Forensic Level 3 | Needs stable server proof objects | v1+ |
| Export proof | Dev tooling first | v1+ |
| Verify online | Needs external verifier | v1+ |
| Type-to-confirm (Tier 4) | Rare use cases | v1 |
| Witness Mode | Debug builds first | v1 |
| Outfit stats/bonuses | Breaks economy clarity | v2+ |
| Outfit drops | Adds loss anxiety | v2+ |
| Outfit crafting | System bloat | v2+ |
| Outfit receipts | Not a proof concern | Never |
| Gender change | Identity migration | v1+ |
| Cosmetic monetization | Trust first | v2+ |

---

## Verification Checklist

### Layout

- [ ] D-pad on left, actions on right
- [ ] ≥100px gap between D-pad and any action button
- [ ] Disconnect button only accessible via Menu → Settings
- [ ] All hitboxes ≥44px

### Confirmations

- [ ] Movement is instant (Tier 0)
- [ ] Attack is single-tap (Tier 1)
- [ ] Drop item requires 1.5s hold (Tier 2)
- [ ] Drop legendary requires slide (Tier 3)
- [ ] Release during hold cancels action

### Progressive Disclosure

- [ ] New player sees only D-pad + HP + Chat
- [ ] Attack button appears after first combat
- [ ] Hotbar appears after first item
- [ ] Rep/Gold appear after first death
- [ ] Unlock state persists across sessions

### Why? Recap

- [ ] Death toast appears within 500ms of death
- [ ] Toast shows items lost
- [ ] Tap expands to recap sheet
- [ ] Recap shows killer, location, time
- [ ] "Copy Event ID" works

### Chronicle

- [ ] Shows events grouped by day
- [ ] Pagination works (Load More)
- [ ] Death events are tappable (opens recap)

### Character Identity

- [ ] Sex selection appears at character creation
- [ ] Male/Female sprites differ
- [ ] Outfit auto-assigned, no picker
- [ ] Sex/outfit synced on login
- [ ] No stats/bonuses from outfit
- [ ] No outfit-related receipts emitted

---

## Amendment Rule

Changes to this spec require:

1. Update this document
2. Bump version in header (v0 → v0.1 → v1)
3. Update verification checklist
4. Test all affected flows

**Frozen**: v0 spec locked until Android MVP ships.

---

*Document version: v0.3 (FINAL FREEZE)*
*Last updated: 2026-01-11*
*Related: EVIDENCE_UI_SPEC.md (v1 forensics), CIVIL_GUARANTEES.md*
