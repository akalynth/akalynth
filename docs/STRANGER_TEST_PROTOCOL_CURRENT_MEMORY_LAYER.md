# Stranger Test Protocol — Current Memory Layer (Glyphs + While You Were Away)

**Purpose:** Measure whether the current implementation creates the emotional "I want to see what happened" and "the world is waiting for me" feeling, per PLAYER_LOOP_CONTRACT_V2.

**Date:** 2026-07-12

## Test Protocol (Brutal, Zero Explanation)

**Observer instructions:**
- You know nothing about the project.
- You will not explain anything.
- You will not use words like: MMO, game, quest, inventory, chronicle, memory, event, glyph, world, return, etc.
- Hand the device (or open the debug client in a clean browser tab) and say only:

  > “Open this and explore.”

- Sit quietly. Take notes on what the person says and does. Do not guide.
- After ~5 minutes of unaided exploration, or when they seem ready to stop, ask the questions below **only if they have not spontaneously answered them**.
- To test "return", have them close/minimize the app/tab for 30-60 seconds (simulate absence), then reopen. Do not explain why.

**What to prepare:**
- Clean session (new browser profile or incognito, or fresh Android install if testing native).
- The memory layer must be active (current build has glyphs for high-impact events and while-away card).
- Server should have some pre-existing chronicle data (e.g., from previous play or fixtures that include canal/caravan style events). If starting fresh, do a short guided play first to seed data, then reset the "stranger" tester.

## Observation Questions (The Five)

Do **not** prompt these unless the player has not already demonstrated the answer through behavior or spontaneous comments.

After the first 5 minutes:

1. **Where am I?**
   - Can they name the place or describe its character without being told?

2. **What can I do?**
   - Do they discover movement and at least one contextual action?

3. **Does this place have history?**
   - Do they notice the glyph(s) or location hint as evidence of prior events?
   - Do they comment on it unprompted? ("Something happened here", "This looks different", etc.)

4. **Did something I did matter?**
   - After performing an action that should have consequence (e.g., fishing, protecting a route), do they see immediate or hinted effect?
   - Do they connect their action to a visible change?

5. **Do I want to return?** (The product metric)
   - After "leaving" (close tab/app for a bit) and coming back:
     - Do they show curiosity about what changed?
     - Do they comment on the "While You Were Away" card or updated glyphs/hints?
     - Spontaneous language like:
       - "Oh, something happened while I was gone."
       - "The place feels different now."
       - "I should check on that again."
     - Or do they treat it like a normal app that resets?

**Record:**
- Exact quotes from the player.
- What they did first.
- When (if) they noticed a glyph or memory element.
- Reaction to return.
- Any confusion points.
- Whether they kept playing or wanted to stop.

**Success criteria (from contract):**
- Player can answer the first four from their own exploration.
- For #5: Evidence of mild anticipation or attachment ("I want to see what happened").

## Current Surfaces Under Test

- **Map glyphs**: Small chronicle glyphs appearing on tiles for high-impact world events (caravan route, canal recovery, etc.).
- **Location hint**: Small persistent text near the map ("Rookguard Canal · ...").
- **While You Were Away card**: Temporary summary shown on return/reconnect.
- **Actions**: Contextual based on location + state (should feel like "what this spot allows now").

**Do not mention any of these.** Let the player discover (or not discover) them.

## Observation Capture Format (Use This Exactly)

**Minute 0-1: Orientation**

Record:
- Where did they look first?
- Did they find their character?
- Did they understand movement?
- Did they understand what was interactive?

Important quote examples:
- Good: “Oh, I am near a village.”
- Bad: “What am I supposed to do?”

**Minute 1-3: Agency**

Watch: Do they discover:
- Fish?
- Talk?
- Explore?
- Move toward landmarks?

Ideal reaction: “I wonder what this does.”

**Minute 3-5: Memory**

Do not ask: “Did you notice the Chronicle?”

Ask: “What do you think happened here?”

If they say: “Something happened here before.” → map is working.

**Return test**

After closing/minimizing for 30-60s and returning:

The strongest signal: The player says something like “I want to see what changed.”

Capture exact spontaneous quotes.

## Post-Test Analysis

After the session, answer:

- Did the memory layer make the world feel alive?
- Did the glyph communicate "something happened here" without text explanation?
- Did the return experience create curiosity?
- Gap between "the world remembers" (system) and "the world is waiting for me" (feeling)?
- Specific friction or delight points.
- Did they want to return? (key metric)

## Notes for Observer

- This is not a usability test of buttons.
- It is a test of whether the simulation + memory projection creates emotional investment.
- Silence is data. If they play for 5 minutes and say nothing about history or change, that is important.
- Multiple short tests with different people are better than one long session.
- Do not rescue or explain during the test. The protocol is "Open this and explore."

**Protocol ends here. Do not expand the experience during the test.**

## How to Launch for a Stranger Test (Current Build)

1. Ensure a server is running with some chronicle data that includes high-impact world events (canal, caravan-style). 
   - Example: Use existing fixtures or run a short play session first to seed data, then use a fresh client session for the actual stranger.
   - The memory layer activates when `chronicle` events of the right kind are present.

2. For the debug client (recommended for quick iteration):
   - `cd repos/akalynth/apps/debug-client`
   - `npm run dev`
   - Open the URL in a clean incognito window / new profile.
   - Use the full play flow (not just ExistenceShell) so glyphs + while-away are active.

3. To simulate "return" during test:
   - Have the player explore.
   - Close the tab or navigate away for 30–60+ seconds.
   - Reopen the same URL (or refresh after absence flag triggers).
   - The "While You Were Away" card should appear if the logic detects prior disconnect + interesting events.

4. Observation:
   - Open DevTools console (F12) **before** handing over.
   - After the session, copy the `[STRANGER-TEST]` logs. These are passive and do not affect the player's UI.
   - Note any spontaneous player comments exactly.

**Important:** The test subject must use the interface with zero prior knowledge of Akalynth concepts. The logs are for the observer only.

## Passive Observation Points (Dev Console Only)

- `[STRANGER-TEST] glyph surfaced ...`
- `[STRANGER-TEST] While You Were Away card shown`
- (Additional logs may appear from existing EventLog / state changes)

These help reconstruct timeline without changing what the player sees or hears.
