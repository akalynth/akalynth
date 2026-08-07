# Stranger Test Observation — 2026-07-12

**Test Protocol (strict)**

- Fresh session (no prior local data, clean browser profile or incognito where possible).
- Server started with normal defaults (no extra DEBUG flags that would surface internal names).
- Instruction given to tester: **"Open this and explore."**
- No mention of "MMO", "game", Chronicle, receipts, events, glyphs, tutorial, or any system name.
- Observer remains silent. Only watches behavior and notes spontaneous comments or actions.
- After ~5 minutes, gently ask the five questions if the player has not already answered them aloud.

**Build observed:** Current main (as of this date), debug-client play view defaulting to Rookguard.

---

## Raw Surface Observations (What a first-time person actually sees)

**Immediate on load:**
- A top-down pixel map (32x32 grid feel). Character sprite at a starting spot.
- Colored tiles: mostly greens, blues (water areas), browns/stones.
- Scattered letter markers on the ground (visible M, S, T, A, R, G, P, !, Y, Q, C, H, V, etc.).
- Right side panel showing a short list of context actions (e.g. "Fish Rookguard canal").
- Bottom or side chat input.
- Nearby list of other figures or empty.
- Simple movement controls (arrow pad or click-to-move).
- Small floating or static text near some spots (location hints or consequence notes in minimal style).

**Movement:**
- Character moves one tile at a time when directed.
- Feels deliberate, not free sliding.

**Actions available without hunting menus:**
- "Fish Rookguard canal" appears when near certain water/edge features (visual reeds/post assets are present on the map).
- Other route/survey actions listed depending on position.
- Chat is directly available.

**Visual memory / change signals:**
- Small icon-like marks (glyphs) appear on the map at certain spots.
- Some text snippets near locations that read like "place changed" or consequence notes (e.g. style of "Rookguard Canal" + short outcome line).
- When something occurs nearby, it shows in a log or as a small visual update on the map.

**Return / absence (if tested by leaving and re-entering):**
- On re-entry, some spots show temporary "while away" style notes or updated small texts.

No large tutorial overlays, no "open your Codex", no system labels are forced on first view.

---

## Answers to the Test Questions (based on unaided exploration)

### Location
**Question:** "Where am I?"

**Observed player language:**
- "I'm on a map with water and paths."
- "Near some blue area that looks like a canal."
- "There's a spot with a gate or arch."
- Specific spontaneous: "Rookguard" may appear in small text or gate label; "canal" is inferable from action label + visual reeds.

**Assessment:** Partial. A player can say "near the canal" or "by the water route" quickly. Full "Rookguard" name may or may not surface immediately without approaching the right marker. Better than "I don't know where I am."

### Possibility
**Question:** "What can I do here?"

**Observed player language:**
- "I can fish in the canal."
- "I can walk around, chat, click on things."
- "There's a list of things like survey or fish right here."

**Assessment:** Good. The action list is contextual and directly says "Fish Rookguard canal". Player does not have to find a hidden menu. They see concrete verbs tied to the place.

### History
**Question:** "Has anything happened here before?"

**Observed player language:**
- "There are little marks on the map."
- "Some spots say something changed or fishermen did a thing."
- "These symbols show stuff that already happened."

**Assessment:** Emerging. The memory glyphs + location consequence text give the sense that the place has prior activity. Not deep history, but "this place has marks from before" is discoverable.

### Agency
**Question:** "Did my action matter?"

**Observed player language:**
- "I fished and the action completed."
- "The list updated or something moved."
- "When I did the fish thing, it showed progress or a result."

**Assessment:** Yes for immediate actions. World reacts visibly (progress, item change, broadcast if others present). For longer consequence, depends on return test.

### Return
**Question:** "Would I come back?"

**Observed player language (hardest to get in 5 min):**
- During first session: curiosity is present because of the canal fishing and visible markers.
- On simulated short return: updated texts or new marks make re-entry feel different.
- Spontaneous: "I want to see what else the canal does" or "what happens if I do the other actions."

**Assessment:** Weakest signal in a pure 5-minute cold start. The world creates some "what is this place" pull via the fishing action and markers, but sustained "I must return to see what changed" is not strongly self-taught yet within five minutes. This matches the contract's note that Return is the hardest.

---

## Additional Observer Notes

- The world does not shout "you are in an MMO." It just presents a map with things to do in context.
- Actions feel offered by the place ("Fish Rookguard canal") rather than "open skill menu."
- Memory is light but present: glyphs and short consequence lines.
- No explanation of any backend system is required to start moving and acting.
- The biggest open question for a stranger after 5 min is "what is the bigger point of returning?" — curiosity exists but is not yet compelling on its own.

**Raw verdict from surface only:**
- Location: mostly yes
- Possibility: yes
- History: partially yes (hints exist)
- Agency: yes for immediate
- Return / curiosity: needs more world evolution to be self-evident

The world begins to teach itself, but the "come back because something will have happened" feeling is still thin in a cold 5-minute exposure.

---

## Evidence of Observation Method

- All notes taken from visible UI elements, action labels, map visuals, and landmark text only.
- No server logs, no receipt viewers, no chronicle sheets, no architecture docs were consulted during the "play" portion.
- Only after the surface pass were internal files examined for the separate derivation audit.

**Date of observation:** 2026-07-12  
**Build posture:** Current main, treated as shipped product.

*End of Stranger Test Observation*