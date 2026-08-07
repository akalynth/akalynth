# Akalynth Player Loop Contract v1

**Status:** Proposed acceptance contract.  
**Date:** 2026-07-12  
**Intent:** Freeze the core player experience loop. UI expansion and new surface work are paused until this contract is demonstrably learnable by a stranger with zero explanation.

This document defines the universal player cycle and the minimum experiential promises at three time horizons. It is the reference against which all future changes to movement, observation, intent, consequence, memory, and return must be judged.

## The Core Player Loop

```
Enter
  ↓
Observe (place, presence, signals)
  ↓
Understand place (small legible meaning)
  ↓
Choose intent (move, act, speak, gather, witness…)
  ↓
Influence world (server resolves)
  ↓
World changes (visible, immediate)
  ↓
World remembers (durable trace)
  ↓
Return (absence + re-entry)
  ↓
Discover consequence (what happened while away, or what your action caused)
```

The loop is closed and repeatable. Every full cycle should leave the player with a slightly richer model of the world without requiring external explanation.

Server authority is absolute: the client proposes intent; the server owns truth, resolution, and memory.

## Time Horizons

### First 5 Minutes (New Stranger)

Without any tutorial text, onboarding overlay, or verbal explanation, a person handed the app should be able to answer:

1. I am in a specific place with a name and character.
2. I can move by intent; the server decides where I end up.
3. The world already contains history and other actors (players or traces).
4. I can perform at least one action that visibly affects something.
5. When something changes, I can see both the immediate effect and a hint that the world kept a record.

**Success signal:** The player keeps playing for the full five minutes without asking "what do I do?" or "why did that happen?"

**Current grounding references (do not expand scope):**
- Rookguard spawn + basic movement (server-validated)
- Local chat as an accountable signal
- Visible work / gather / refine / deliver beats in chill zones (when enabled)
- Small location meaning texts (Layer 1)
- Immediate world reaction (mob behavior, merchant pressure, broadcast)

### After One Session

The player should carry away, without being told:

- "My actions leave traces that survive my departure."
- "The world has its own clock and will continue without me."
- "Returning is different from the first time because something may have happened."
- "Other people (or the world itself) can see or be affected by what I did."

**Key experience:** The Return + Discover Consequence step must feel meaningful even after a short break.

### After One Week

The player should feel:

- The world has a memory that is larger than any single session.
- Repeated returns reveal new layers of consequence (not just "more stuff").
- There is a reason to come back that is not "daily login reward" or "quest checklist."
- Their personal history is legible through the world's traces (not through a personal journal the game hands them).

## What the Player Understands Without Explanation

The contract is only satisfied when the following require **zero** verbal or textual explanation:

- Where I am and that it has character.
- How to move and that movement is not freeform client prediction.
- That the world has history (even if the player cannot yet read the full chain).
- That actions are possible and have visible results.
- That the world remembers what happened (via return experience or visible change).

**Explicitly not required for basic understanding (and must not be explained to pass the stranger test):**
- Chronicle
- Receipts
- Causal graphs
- "Glyphs"
- Tem / heat
- Protocol
- Any internal model name

If the player must be told any of the above to answer the five questions, the interface has failed the contract.

## Memory Layering (Frozen)

Three stable layers. No new layers or major visual treatments until the contract is proven.

**Layer 1 — Always visible (Small location meaning)**  
Example:  
Rookguard Canal  
Fishermen returned

This is the constant background texture of place. It should be present, quiet, and accumulative.

**Layer 2 — Return experience (Temporary)**  
"While you were away…"

Signals change that occurred during absence. Honest, time-bounded, not dramatic.

**Layer 3 — World map memory (Rare symbols)**  
"This place remembers."

Sparse, high-signal markers that a location has accumulated significant history. These must be derived from the receipt/chronicle truth, never the source of truth themselves.

**Rule:** The glyph (or any visual memory artifact) is always a presentation of a projection. Deleting the asset must never erase or invalidate the underlying history. World truth lives in the receipt chain and its projections.

## Core Loop Instantiation (Current Baseline)

This section grounds the abstract loop in the actual systems that must not regress. When the loop is adjusted, every step must still produce the same experiential outcomes for a stranger.

| Loop Step          | Player Action                  | Server State Touched                          | Primary Receipts / Projections                  | Visible Signal (Layers)      | Anti-Cheat / Abuse Risk                  |
|--------------------|--------------------------------|-----------------------------------------------|-------------------------------------------------|------------------------------|------------------------------------------|
| Enter              | Connect / character select     | Session, presence, currentMap, world clock    | `presence_entered`, connect audit               | Immediate location + Layer 1 | Impersonation, session reuse            |
| Observe            | Render map + nearby signals    | Zone players, echoes, active world events     | Broadcasts, chronicle world_event rows          | Layer 1 small meaning + presence | None (read-only)                        |
| Understand place   | See name + static meaning      | Map metadata + derived location text          | None (projection of world state)                | Layer 1                      | None                                    |
| Choose intent      | Move, chat, use_skill, gather, etc. | Intent queue (`processSessionQueue`)         | Varies (see below)                              | Pending action feedback      | Cadence, spam, perfect movement         |
| Influence world    | Server resolves intent         | World state (position, gather node, auction, etc.) | Intent-specific (e.g. `move`, `chat`, `work_completed`, `gather_completed`) | Immediate change             | Heat, Tem, witness quorum               |
| World changes      | Broadcast + local mutation     | Affected projections (inventory, property, events) | Same receipt as above + materializers           | Layer 1 update + visible effect | None (server truth)                     |
| World remembers    | Receipt written + chronicle    | Receipt chain, chronicle, causal rows         | The primary receipt + any `world_event_*`       | Layer 2 / 3 potential        | Receipt tampering, replay divergence    |
| Return             | Reconnect after absence        | Last presence window + causal slice since exit| Any events during absence                       | Layer 2 "While you were away" | Stale client state abuse                |
| Discover consequence | See effect of prior action or world evolution | Replayed projections, new Layer 1/2/3       | Consequence receipts (or absence receipts)      | Updated Layer 1 + Layer 2/3  | Lying about what the world did          |

**Critical invariants that must survive any change:**
- Client never supplies position, inventory state, or "what happened" as truth.
- Every consequential step above emits at least one durable receipt.
- Glyphs / memory visuals are always projections; the receipt chain + chronicle are the source.
- Return experience must be computable from the receipt/chronicle slice alone.

## Server State and Receipts (Design Rule)

When adjusting anything that touches this loop, explicitly document in the change:

- **Player action loop step** affected
- **Server state touched** (presence, world clock, zone state, specific projections)
- **Receipts emitted** (or absence receipts, world events, chronicle rows)
- **Derived player-visible signal** (Layer 1/2/3)
- **Risk to the stranger test**

Changes that would require a new player to be told about Chronicle, receipts, or internal names in order to answer the five questions are disallowed until the contract is proven.

Example for a return:
- Server state: last presence window + causal rows since departure
- Receipts: any world events or consequence receipts in the interval
- Visible: Layer 2 temporary text + possible Layer 1 update
- Risk: Over-explaining the return ("the game is telling you about receipts") breaks "understands without explanation"

## Verification Path (The Five-Minute Stranger Test)

This is the primary and currently only required test for the contract.

**Protocol:**
- Give a new person the app (current debug client or Android build). Use a clean account or guest flow.
- Provide **zero** documentation, verbal explanation, or pointing at internal concepts.
- Observe for five minutes of unaided play.
- At the end (or from spontaneous comments), determine whether the player can answer:

  1. Do they know where they are?
  2. Do they know how to move?
  3. Do they notice the world has history?
  4. Do they understand an action is possible?
  5. Do they know why something changed?

**Pass:** All five are answered affirmatively from the player's own words or behavior, without the observer supplying concepts like "receipts", "chronicle", or "glyphs".

**Evidence:** Timestamped notes + build identifier + (optionally) screen recording. A passing test must be recorded before UI or memory surface expansion resumes.

**Secondary / supporting paths (for implementers):**
- Existing `npm run verify:showcase`, `verify:rookguard-*`, chill-zone WS E2E, and causal visibility checks must continue to pass.
- Any change to return, consequence, or memory surfaces must include a before/after receipt identity proof for the affected systems.

## Anti-Cheat and Abuse Considerations

The loop must remain playable by real humans while the existing defenses continue to function:

- Movement cadence and heat still apply on intent entry.
- Chat and action spam still feed the detector / Tem / witness paths.
- Return and consequence signals must not be forgeable by clients (they are receipt-derived).
- The stranger test itself must not be gamed by adding hidden explanatory text that would not exist in a normal play session.

No change to the loop may weaken the existing anti-cheat surfaces or make the world feel like it trusts the client.

## Freeze Rules

Until a recorded, passing five-minute stranger test exists:

- No new permanent UI chrome for "progress," "memory," or "history" views.
- No additional tutorial text or explanatory overlays that teach the loop.
- No new glyph layers or visual memory systems.
- Changes to existing surfaces must be justified by "does this make one of the five questions easier or harder for a stranger?"
- Polish that does not change the learnability of the loop is allowed only if it is strictly visual fidelity (no new information architecture).

## Relationship to Existing Documents

This contract takes precedence for player experience claims over:
- `ROOKGUARD_FIRST_30_MINUTES_V1.md` (tutorial scaffolding, not the universal loop)
- `FIRST_FIVE_MINUTES_AGENT_ECONOMY_V1.md` (economy-specific path)

Those remain useful as implementation plans **inside** the loop but do not redefine what a stranger must be able to discover unaided.

## Skill & Steward Alignment

This contract lives at the **GAMEPLAY MEANING** layer (`gameplay-loop-designer`).

It is intentionally upstream of:
- Runtime reality (`server-cartographer`)
- Authority + protocol (`protocol-guardian`)
- History + proof (`receipt-chain-steward`)

Changes that feel like they belong in a different layer (new protocol messages, new receipt shapes, new persistence guarantees) must be routed through the correct steward and must still satisfy this contract for the player.

## Immediate Post-Contract Work (as proposed)

1. Record a baseline five-minute stranger test on the current build.
2. Run a combined `receipt-chain-steward` + `protocol-guardian` derivation audit:
   - Confirm every player-visible memory/glyph/consequence surface is computed from the receipt → chronicle → causal projection path.
   - Confirm that the visual layer can be removed or the assets deleted without losing world history.
3. Freeze further glyph / return / memory UI work until both the stranger test passes and the derivation audit is clean.

**Completed artifacts (2026-07-12):**
- `docs/STRANGER_TEST_OBSERVATION_20260712.md` — pure surface observation under the exact protocol ("Open this and explore", no MMO mention).
- `docs/RECEIPT_DERIVATION_AUDIT_V1.md` — end-to-end chain proof with the three deletion questions answered.

The skill boundaries exist precisely to prevent the common failure mode of "new surface → new special case → new exception." Need → correct layer → existing authority path → verified change.

---

**This contract is deliberately small.** Its only job is to keep the world's emerging language learnable by living in it.

A new person should be able to enter, act, leave, return, and understand that the world noticed — without ever being told how the noticing is implemented.

*End of Akalynth Player Loop Contract v1*