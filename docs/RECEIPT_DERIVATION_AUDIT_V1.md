# Receipt-Chain Derivation Audit — Glyphs & Memory Surfaces

**Date:** 2026-07-12  
**Auditors (per skill):** receipt-chain-steward + protocol-guardian posture  
**Purpose:** Prove that all player-visible memory, consequence, and glyph surfaces are strictly derived from the canonical receipt/chronicle path, and that the world remains intact if the presentation layer is removed.

## The Required Chain (must hold for every memory surface)

```
World Event (server resolution of intent or autonomous actor)
    ↓
Receipt (appendReceipt / coordination-kernel, fsync before projection)
    ↓
Chronicle Materialization (world_event rows, causal rows)
    ↓
Causal Projection (causalParity, PlayLoopProgress, shared world state)
    ↓
Memory Surface / Glyph (client rendering only)
    ↓
Player Interpretation
```

If any arrow is reversed or if the visual can exist without the receipt, the audit fails.

---

## Evidence Traced (Current Baseline)

### 1. World Event → Receipt
- World events (fishing recovery, caravan arrival, witness moth bloom, property auction settle, gather deliver, etc.) are emitted only after server-side resolution.
- Receipt actions include: `activity:fishing:rookguard`, world event actions (`WORLD_EVENT_STARTED`, `WORLD_EVENT_CONTRIBUTION`, `WORLD_EVENT_RESOLVED`, etc.), `gather_completed`, `delivery_recorded`, etc.
- Source: `apps/server/src/world/*` (autonomousCaravan, auction-loop, gather, fishing logic), materializers in `persist/materializers.ts`.
- All go through the single receipt logger (`apps/server/src/audit/logger.ts` or coordination-kernel `appendReceiptSync`).
- Chain integrity: BLAKE3 event_hash + Ed25519 signature + prev_hash. fsync before any onWrite projection.

### 2. Receipt → Chronicle Materialization
- Receipts with world_event kinds are materialized into `world_events` and chronicle tables.
- `persist/index.ts`, chronicle queries, `crates/chronicle`.
- Verifiers (`tools/verify-world-events.ts`, `verify-fishing-caravan-events.test.ts`) explicitly assert receipt order precedes materialization and that projections can be rebuilt from receipts alone.
- `WORLD_EVENT_*` receipts are the durable record; Chronicle rows are derived.

### 3. Chronicle / Causal → Projection
- `packages/shared/causalParity.ts` + `causalPlayerViewForDetails`.
- Client: `apps/debug-client/src/chronicle/causalVisibility.ts` turns `ChronicleEvent` (world_event kind) into `CausalPlayerView`.
- Server also exposes via `PlayLoopProgress` and shared world state.
- `onwardRoutes`, fish stock, recovery deadlines, etc. are carried in these projections.

### 4. Projection → Memory Surface / Glyph (Presentation Only)
- Client map rendering: `MapCanvas.tsx` receives `memoryGlyphs?: Array<{x, y, glyphKind, tooltip}>`.
- Glyph assets and mapping: `chronicle/chronicleGlyphs.ts` (maps event kinds to `sprites/effect__chronicle_*.png`).
- `ChronicleGlyphIcon.tsx` renders the image or ASCII fallback.
- Location consequence text: `.world-location-hint .consequence` in CSS + dynamic text from route memory / causal at spot (see `ActionsPanel.tsx` comments on "Chronicle memory at current spot").
- Assets for canal/fishing: `rookguard_canal_reeds`, `rookguard_fishing_post` in placements.
- Action labels ("Fish Rookguard canal") are derived from `PlayLoopProgress.onwardRoutes` + location + chronicle memory.

**Critical:** These are read-only presentation. No client message ever sends glyph data or "memory state" back as truth. All actions remain pure intents.

### 5. Player Interpretation
- The player sees the glyph + tooltip or short consequence line.
- No protocol message exposes the internal receipt id or chronicle row id in the primary play surface (they are in separate Chronicle sheet, which is optional).

---

## The Three Audit Questions — Results

**Q1: If the glyph asset is deleted, does the event still exist?**

**Yes.**

- Glyph PNGs live only in `data/assets-src/sprites/` and client atlas.
- The underlying `world_event` rows, receipts, and causal data live in the receipt JSONL + SQLite projections.
- Removing `effect__chronicle_*.png` only affects the `ChronicleGlyphIcon` render path (falls back to ASCII label). The `CausalVisibilitySummary`, `PlayLoopProgress`, and server state are untouched.
- Verified by asset manifest separation and client error handling in `ChronicleGlyphIcon`.

**Q2: If the Chronicle UI (sheet, list, glyphs) disappears entirely, does the world state remain?**

**Yes.**

- Core gameplay (movement validation, fishing progress, gather nodes, auction settlement, caravan, property, heat, death, etc.) does not depend on the client Chronicle components.
- `PlayLoopProgress`, ground items, nearby players, action availability, and map state continue to function.
- Server projections (SQLite) and receipt chain are independent of any client UI.
- The map memory layer (`memoryGlyphs`) is one optional overlay; the actions and world simulation do not require it.

**Q3: If Android (or any client) cache is cleared, can the world rebuild?**

**Yes.**

- On reconnect / fresh client:
  - Server replays the receipt chain on startup (`persist/index.ts` + `persist/replay.ts`).
  - Materializers rebuild SQLite projections (players, inventory, auctions, world_events, heat, etc.).
  - Client receives fresh `PlayLoopProgress`, current map state, and relevant chronicle events on join.
  - Glyphs are re-derived from the events the client receives.
- Anti-cheat state that must survive (heat/penalty) is receipt-backed and re-hydrated.
- Verified by multiple `verify:*` that include replay + projection parity (e.g. `verify-anticheat-persistence`, fishing caravan verifiers, property auction persistence).

---

## Failure Modes Checked

- No client-side "memory" that can survive a receipt replay mismatch.
- No glyph or consequence text is minted without a preceding receipt.
- World events that affect player view (canal fish stock recovery, merchant reactions, caravan arrival) are always receipted first.
- Presentation code (`ActionsPanel`, `MapCanvas` memory layer) only reads from server-provided projections.
- Protocol remains intent-only (confirmed via `protocol-guardian` posture — `ClientMessage` union contains no truth assertions).

---

## Conclusion

**Pass.**

Every examined memory / consequence / glyph surface follows the strict derivation chain.

- The visual layer (glyph images, location consequence text, "while you were away" notes) is presentation only.
- Deleting the visual layer or clearing client state does not remove or invalidate the underlying world event.
- The receipt chain + chronicle materialization + causal projection are sufficient to reconstruct the player's view of history and consequence.

This confirms that the presentation layer does not secretly hold authority.

---

## Recommendations (Observation Only)

- Continue treating glyph assets and client-side memory rendering as the least authoritative layer.
- Any future expansion of Layer 1/2/3 text must be generated from the same causal projection path.
- The stranger test result (separate document) is the human-side counterpart to this technical derivation proof.

**Next natural step after both artifacts exist:** Observe the gap between "technical derivation is clean" and "a stranger can feel the history without being told."

*End of Receipt Derivation Audit V1*