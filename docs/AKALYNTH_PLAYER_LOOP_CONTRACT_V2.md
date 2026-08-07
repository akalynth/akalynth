# Akalynth Player Loop Contract v2

**Status:** Governing contract for the current phase.  
**Date:** 2026-07-12  
**Scope:** One-page rule. All future work on observation, intent, consequence, memory, glyphs, return, and world state must be judged against this document.

## Akalynth World Rule

Nothing important happens without an event.

Every consequential event **must** answer, in the receipt + chronicle:

- **Who** acted (or caused it)?
- **What** was the intent?
- **Where** did it occur (map + location)?
- **Why** (context, state that made it possible)?
- **Result** (immediate, visible change)?
- **Future effect** (what the world now carries forward)?

The receipt chain is the only source of truth. Projections (state, UI, glyphs, summaries) are derived and may be deleted without losing history.

## The Player Loop

```
Enter
  ↓
Observe (the place itself)
  ↓
Understand (small legible meaning in the world)
  ↓
Choose intent (what this exact spot currently allows)
  ↓
Influence (server resolves, client never supplies truth)
  ↓
World changes (visible)
  ↓
World remembers (durable trace in Chronicle)
  ↓
Leave
  ↓
Return
  ↓
Discover consequence (the world continued and is different)
```

## Player Experience Contrast

**Before (unacceptable):**
"I did a thing."

**After (required):**
"I changed a place."

The player must be able to feel, without being told:
- The place has a memory.
- My past action is part of why it is different now.
- Returning is not the same as the first visit.

## Memory on the Map (Glyph Rule)

The map itself is the primary carrier of history.

- Glyphs are **symbols of history**, not explanations or spam.
- Only high-impact, world-scale events earn a glyph.
- Glyphs are rare. A glyph everywhere becomes wallpaper.
- The glyph is a **view**, never the source. Deleting glyph assets must not affect the underlying receipts or chronicle.
- Player learns the language by seeing symbols in the world and discovering their meaning through presence and return.

Text belongs in the small always-visible location hint or the temporary return card. The map stays visual and clean.

## Implementation Requirements

When designing or changing anything that touches the loop:

1. **Player action loop step** affected.
2. **Server state touched**.
3. **Receipts emitted** (or world_event rows).
4. **Anti-cheat / abuse risks** (client must not be able to lie about consequence or history).
5. **Test / playtest path** (stranger test + receipt chain verification).

No change may require a new player to be told about "Chronicle", "receipts", or internal names to answer:
- Where am I?
- What can I do here?
- What changed?
- Why is it different?

## Verification

**Primary test (the only one that matters until it passes cleanly):**

Hand a stranger the client with **zero** explanation.

After unaided play + at least one return:

1. Do they know where they are?
2. Do they know what they can do?
3. Do they notice something changed?
4. Do they understand why it changed?
5. Do they want to return?

If the answer to any is "no" or "I had to be told", the contract is violated.

Secondary verification (for implementers):
- Every visible memory or consequence must be derivable from the receipt → chronicle → causal projection path.
- The receipt chain must be replayable and produce the same consequence.

## Relationship to Skills

This contract is owned by the intersection of:
- `gameplay-loop-designer` (loop definition + no fake actions)
- `receipt-chain-steward` (memory is real or it is nothing)

Changes that cross into protocol, anti-cheat, or persistence must also satisfy `protocol-guardian` and `receipt-chain-steward` before touching player experience.

**This document is deliberately one page.** Its job is to keep the emerging language of the world learnable by living in it.

*End of Akalynth Player Loop Contract v2*
