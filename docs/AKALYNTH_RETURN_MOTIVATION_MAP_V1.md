# Akalynth Return Motivation Map v1

**Status:** Design artifact for the Return step of the Player Loop Contract  
**Date:** 2026-07-12  
**Scope:** Freeze current systems. One focused improvement: strengthen emotional anticipation on first return-after-absence.  
**Principle:** The player must feel "the world actually did something while I was gone" without new systems, notifications, or complex UIs.

This document is the direct response to the stranger test finding that "Would I come back?" was the weakest signal.

It does not propose new mechanics. It proposes how existing receipt-backed world events (fishing canal recovery, caravan merchant arrival) should express themselves so a player develops a relationship with specific people and places.

## Core Problem

Current return language is abstract and collective:

- "Rookguard Canal recovered. Fishermen have returned."
- "Merchant Lora returned with supplies. The eastern road carries trade again."

This says "the world changed."

It does not yet say "because *you* left, *this* continued, and now *this specific thing* is different for people who remember you."

## Return Motivation Map Template

For any consequential action the player can take, answer four questions. The answers become the source material for location memory, while-away summaries, and return discovery text.

| Phase       | Question                              | What it creates for the player                  | Must be receipt-derived |
|-------------|---------------------------------------|--------------------------------------------------|---------------------------|
| Immediate   | What changed *right now* because I acted? | "I see the direct result."                      | Yes (the action receipt) |
| While Away  | What continues or evolves *without me*? | "The world kept going."                         | Yes (time-based recovery / autonomous actor) |
| Return      | What do I discover that feels personal? | "Wait… this happened *because* I left."         | Yes (causal projection + merchant memory) |
| Identity    | Why does this belong to *me*?         | "I am known here as X."                         | Yes (player name in memory fields) |

The Return row is the one we are weakest on today. Strengthening it is the single allowed improvement.

---

## Fishing the Rookguard Canal

**Player Action:** Use the "Fish Rookguard canal" intent while the canal is calm.

### Immediate
- The canal is disturbed.
- You cast patiently. Nothing tradeable is caught.
- The canal merchant notices your patience (respect +1).
- Receipt: `ROOKGUARD_CANAL_FISHED_ACTION` + `ROOKGUARD_FISHING_MERCHANT_REACTED_ACTION`.
- Visible: Action completes. Small line: "Nothing worth selling bites, but the canal merchant notices your patience."

### While Away
- The canal slowly recovers (recovers_at_ms driven by receipt).
- The merchant's memory of your patience persists and can affect future behavior.
- If other players or the world interact, downstream effects may occur (future expansion).
- Current language: "Rookguard Canal recovered. Fishermen have returned."

### Return (Target — the improvement)
The player should discover something that makes them feel the world moved forward because of their earlier patience.

**Proposed stronger language (humanized, specific, identity-linked):**

Current (abstract):
> "Rookguard Canal recovered. Fishermen have returned."

Target for first return:
> "Mara’s family reopened their fish stall. The canal merchant told them a patient fisher helped the waters settle."

On later returns (accumulating):
> "The canal merchant nods when you approach. 'The patience you showed is still talked about at the stalls.'"

**Why this works:**
- Names a person (Mara’s family / the canal merchant).
- Ties the recovery directly to the player's past action ("a patient fisher" carries the player's identity from the receipt).
- Creates mild anticipation: "If I fish again, will the merchant remember more?"

**Identity hook:**
"You are known at the canal as someone who fishes with patience."

---

## Protecting / Enabling the Forgehold Caravan

**Player Action:** Set a guard patrol or otherwise contribute to the caravan route (current: `caravan_guard_patrol_set` receipt).

### Immediate
- Guard patrol is set on the route.
- Receipt records the protection.
- Visible: Route state updates. Possible immediate broadcast or location text.

### While Away
- Time passes (autonomous actor logic in `advanceForgeholdCaravanActor`).
- If the due time arrives, the merchant (Lora) travels and arrives.
- The route opens for trade. Stock appears.
- Merchant Lora becomes active.

### Return (Target)
Current (abstract):
> "Merchant Lora returned with supplies. The eastern road carries trade again."

**Proposed stronger language:**

> "Merchant Lora has set up a small stall on the eastern road. She mentions the guard you helped post made the first run possible. A child asked if the 'road protector' would be back."

On later returns:
> "The new trader at the edge of Rookguard recognizes you. 'Lora said the one who watched the route would come back through here.'"

**Why this works:**
- Specific named person (Merchant Lora).
- Credits the player's action for enabling the continuation.
- Introduces a secondary person (child / new trader) who has heard of the player.
- Creates "I have a reputation on this road."

**Identity hook:**
"You are known as a road protector on the eastern route."

---

## General Rules for Return Text

1. **Always name someone.** Collective ("fishermen", "merchants") is weak. Specific (Mara’s family, Merchant Lora, the canal merchant) creates relationship.
2. **Credit the player's past action.** Use language like "because you...", "the patience you showed", "the guard you helped post".
3. **Make it discoverable on return, not pushed.** The existing "While You Were Away" card or location consequence text is the right surface. Do not add new notifications.
4. **Keep it small.** One or two sentences. The emotion is quiet recognition, not a quest update.
5. **Tie to identity over time.** Repeated returns can accumulate memory ("still talks about...", "the second time you...").
6. **Everything must be derivable from receipts + causal state.** No new state. Use existing `merchant_memory`, `last_actor`, player name, event chains.

---

## One Improvement Only — Scope

This map defines the target language for the two live return-after-absence experiences:

- Rookguard Canal fishing recovery + merchant reaction
- Forgehold caravan merchant arrival

Implementation should be a minimal, targeted change to the existing `computeWhileAwaySummaries` (or the location consequence / memory layer that feeds it) and the public state strings in `rookguardFishingPublicState` / caravan logic.

**Do not:**
- Add more while-away cards
- Add new UI
- Add new world events
- Add quest tracking or "relationship meters"
- Expand to more actions yet

**Do:**
- Humanize the two existing return moments so a returning player thinks "the world noticed I was gone and something specific happened because of what I did."

---

## Verification Against Player Loop Contract

This map is judged against `AKALYNTH_PLAYER_LOOP_CONTRACT_V2.md` (the current governing one-page rule).

It directly strengthens the "Return → Discover consequence" step.

Success for the next stranger test would be a player who, after leaving and returning (even in simulation), spontaneously says something like:

- "Oh, the merchant remembers me."
- "The canal got better because I fished there earlier."
- "I should go back and see what else changed."

When that feeling exists for the first return moment, the anticipation ("something will happen because you left") starts to form.

---

## Relationship to Other Documents

- Builds directly on `AKALYNTH_PLAYER_LOOP_CONTRACT_V1.md` (Return step).
- Informed by `STRANGER_TEST_OBSERVATION_20260712.md` (weakest answer: "Would I come back?").
- Respects the architecture proven in `RECEIPT_DERIVATION_AUDIT_V1.md` (presentation never holds authority).
- Uses only existing receipt fields, merchant memory, causal state, and player names already present in the fishing and caravan systems.

---

## Focused Implementation Guidance (Minimal Change Only)

The single allowed change is to upgrade the language inside the existing return path.

**Primary surface to adjust:** `computeWhileAwaySummaries` (and the strings it feeds, plus `rookguardFishingPublicState` "next_consequence" / merchant memory).

**Target strings pulled from this map (use player_name and event details where available):**

**Canal fishing return (first time):**
- `Mara’s family reopened their fish stall. The canal merchant told them a patient fisher helped the waters settle.`

**Canal fishing return (accumulated respect):**
- Use the existing `merchant_memory` field or construct: `The canal merchant nods when you approach. 'The patience you showed is still talked about at the stalls.'`

**Caravan / Forgehold return:**
- `Merchant Lora has set up a small stall on the eastern road. She mentions the guard you helped post made the first run possible. A child asked if the 'road protector' would be back.`

**How to source the names without new data:**
- Fishing already records `player_name` and builds a `memory` string in the receipt.
- Caravan already uses "Merchant Lora" in the autonomous actor receipt inputs.
- The canal merchant can be referred to as "the canal merchant" (or `ROOKGUARD_FISHING_MERCHANT_ID`).

**Guardrails for the change:**
- Keep the "While You Were Away" card or location hint as the only delivery mechanism.
- No new UI components.
- No increase in number of summary lines.
- All text must still be generatable from the causal projection of receipts.
- Test with the five-minute stranger lens: after doing the action, leaving for a simulated absence, and returning, does the player feel the world continued *because of them*?

This single language upgrade is the entire improvement until the next stranger test shows stronger "Would I come back?" signals.

*End of Akalynth Return Motivation Map v1*