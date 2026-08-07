# PLAYER_LOOP_CONTRACT_V2_AUDIT_RESULT

**Date:** 2026-07-12  
**Scope:** Audit of current glyph + while-away implementation against `AKALYNTH_PLAYER_LOOP_CONTRACT_V2.md`.  
**Systems audited:** Debug client memory layer (mapMemoryGlyphs, while-away-card, location hint) + server receipt → chronicle → causal path for relevant events (canal fishing, forgehold caravan).

## Authority Test

**Question:** Can a client create a glyph without a real world event?

**Result:** PASS

**Evidence:**
- Glyphs are computed exclusively in `apps/debug-client/src/App.tsx:mapMemoryGlyphs` from `state.chronicle?.events`.
- `state.chronicle` is populated only from server `chronicle_snapshot` messages (see `useGameClient.ts:1552`).
- Server world events are created only via materialization from signed receipts ( `persist/materializers.ts:1327+` for world_events, `skills/handlers.ts` for FORGEHOLD_CARAVAN_EVIDENCE_RECOVERED_ACTION etc.).
- No client-to-server path exists that can inject a `world_event` or force a glyph. Client sends only intents (use_skill, move, etc.).
- Causal parity events are built server-side from receipts ( `shared/causalParity.ts:buildCausalParityEvent` ).

Client cannot lie about history.

## Deletion Test (Persistence)

**Question:** Remove glyph asset / renderer / map decoration. Does the world still contain the truth?

**Result:** PASS

**Evidence:**
- Glyph rendering lives only in:
  - `apps/debug-client/src/components/MapCanvas.tsx` (canvas draw of 10-12px images from chronicleGlyphUrl)
  - `apps/debug-client/src/App.tsx` (computation + tooltip)
  - Sprite assets under `data/assets-src/sprites/effect__chronicle_*.png` (and built atlas)
  - CSS for .while-away-card and .world-location-hint
- Server truth lives in:
  - Receipt JSONL + signed chain (`/var/lib/akalynth/audit`)
  - `world_events` table (materialized from receipts)
  - Chronicle rows (via `chronicleEventFromRow`)
  - Causal state transitions
- Removing client glyph code and assets leaves all server rows, receipts, and replayability intact. State changes (canal calm, route safety, merchant stock) survive.

Visual layer is presentation only.

## Reconstruction Test

**Question:** Fresh client session rebuilds memory from server?

**Result:** PASS

**Evidence:**
- On connect: server sends `chronicle_snapshot` (full recent events) and `shared_world_observation`.
- Client recomputes `mapMemoryGlyphs` and `computeWhileAwaySummaries` purely from received events + `causalVisibilityForEvent`.
- No local storage of glyph positions or summaries beyond current React state.
- Fresh browser/Android session + clean cache will re-request and re-derive identical glyphs for the same chronicle slice.
- Server materializers are deterministic given the receipt sequence.

## Rarity Test

**Question:** How many events can create glyphs?

**Result:** PASS (current implementation is correctly restrictive)

**Evidence (client filter in App.tsx):**
```ts
const isHighImpact = eid.includes('caravan') || eid.includes('forgehold') || eid.includes('canal')
  || (causal?.world && causal.world.length > 20);
```
Only these patterns currently produce glyphs + tooltips:
- FORGEHOLD_CARAVAN_* (guard decision, merchant arrival, evidence)
- ROOKGUARD_CANAL_* (fishing + merchant reaction)

**Current glyph-producing events (high-impact only):**
- Caravan route restoration / guard set
- Merchant Lora arrival with supplies
- Canal recovery from patient fishing

**Events that correctly do NOT produce glyphs:**
- Individual `ROOKGUARD_CANAL_FISHED_ACTION` (low-level casts)
- Generic item pickups, movement, chat, work ticks, etc.
- Any non-`world_event` kind

Matches the contract's intent: "archaeology, not a notification board."

## Replay / Derivation Integrity

**Result:** PASS

**Evidence:**
- All audited events have corresponding signed receipts (verified in `tools/verify-fishing-caravan-events.test.ts`, `verify-forgehold-*.ts`).
- Receipts are hash-chained and Ed25519 signed (coordination-kernel).
- `chronicleEventFromRow` + `causalPlayerViewForDetails` are pure derivations.
- `sharedWorldObservationFromRows` rebuilds current state from the causal event slice.
- Deleting client glyph code has zero effect on replay or state reconstruction on server.

## Stranger Interpretation (Observational)

**Result:** NOT RUN (requires live human session)

**Current surfaces (as observed in code):**
- Map: rare 10-12px chronicle glyphs in tile corners (only high-impact).
- Location hint: small always-visible "Place · short consequence".
- On return: temporary "WHILE YOU WERE AWAY" card with 1-3 lines.
- Actions: contextual (already present before glyphs).

**Predicted answers for a clean stranger (5 min + one return):**
1. Where am I? → Yes (map + hint).
2. What can I do? → Yes (ActionsPanel shows context from location + state).
3. Notice history? → Yes (glyph appears on changed tiles).
4. Understand why changed? → Likely (tooltip on glyph gives human sentence; card on return).
5. Want to return? → Unknown (this is the critical unknown metric).

**Recommendation:** Run the exact five-minute stranger test on current build with zero explanation. Record spontaneous comments.

## Known Gaps

- Glyph computation currently in debug-client only (React prototype). Android client does not yet have equivalent glyph rendering or memory layer.
- "While You Were Away" trigger is session-based in prototype; production should tie to actual last-presence window from server.
- Tooltip reveal for glyphs is mouse-hover only in current code. Mobile "approach" (player proximity) not yet wired to surface memory.
- Rarity filter is heuristic on event_id strings. Should eventually be driven by a server-side "memory_worthy" flag on world_event rows (to keep client dumb).
- No visual distinction yet between "your action caused this" vs "world event happened" on the map glyph itself (relies on tooltip text).

## Authority / Derivation Chain (Summary)

```
Client intent (use_skill / move)
  ↓ (validated)
Server receipt (signed, hashed, chained)
  ↓
Materialized world_event row + chronicle row
  ↓
CausalParityEvent (with player_view, world, result)
  ↓
Client receives via chronicle_snapshot / shared_world_observation
  ↓
Client projection (mapMemoryGlyphs, computeWhileAwaySummaries)
  ↓
Glyph on canvas + card + hint (pure view)
```

No shortcut from client to glyph exists.

## Next Allowed Change (per V2)

Only changes that:
- Make one of the five stranger questions easier or more reliable.
- Keep glyphs rare (no new low-impact event types).
- Preserve deletion safety (visuals remain pure projection).
- Can be justified with receipt → chronicle → causal proof.

**Suggested next (if stranger test passes):** Wire player proximity to memory glyphs (so standing on/near a glyph tile can surface the tooltip or a contextual action without extra chrome).

---

**Overall:** The audited surfaces (glyph + while-away) currently satisfy the core invariants of PLAYER_LOOP_CONTRACT_V2.

The architecture is strong. The emotional "want to return" signal remains the unmeasured variable that now needs a real stranger test.

*End of audit result*
