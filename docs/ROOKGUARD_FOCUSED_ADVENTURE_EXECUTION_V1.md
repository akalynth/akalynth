# Rookguard Focused Adventure Execution v1 — The Gate Remembers

**Current system:** Rookguard newcomer adventure
**Primary tension:** the first session must feel like one dangerous-world initiation without adding infrastructure, padding time, or weakening server authority.

**Status:** AUTHORIZED LOCAL IMPLEMENTATION LANE
**Authorization evidence:** gameplay-architect chat authorization, 2026-07-30
**Canon / adoption:** pending review and merge
**Implementation:** local feature branch only
**Deployment:** not authorized

## Design Goals

| Goal | Player feeling / behavior |
| --- | --- |
| One coherent premise | “The keep is deciding whether it will remember me.” |
| Six legible earned marks | Movement, speech, Tem, combat, identity, and passage feel like parts of one rite rather than unrelated checks. |
| Optional breathing room | The canal rewards curiosity and patience without currency, items, XP, or mandatory completion. |
| Durable closure | The existing completion receipt opens the gate and projects a Chronicle memory. |
| Honest recovery | A failed attempt always points back to an available server-owned retry path. |
| No grind-to-safety | Repetition does not grant power, bypass Tem, or substitute for the required marks. |

## Player Contract

### Premise

Rookguard's golden gate does not open for a claimed identity. It opens after the
keep has witnessed six earned marks.

### Required marks

1. **Wake the road-rune** — cross the silver rune east of the arrival square.
2. **Raise a signal** — speak once in local chat.
3. **Answer Tem** — face the violet rune and answer the server-issued human check.
4. **Earn the yard-mark** — defeat the training slime.
5. **Choose an oath** — select Warden, Cantor, Hexer, or Reaver in the guild hall.
6. **Cross the gate** — return to the golden gate and enter High City.

The wire identity remains `rookguard_city_codex_path_v1`; only its player-facing
title becomes **The Gate Remembers**. This avoids a protocol or persistence
migration.

### Optional canal beat

The old canal is a discoverable pause beside the existing fishing post and
reeds. A cast:

- is accepted only while the server places the character inside the canal
  landmark;
- emits the existing `rookguard_canal_fished` receipt;
- returns one atmospheric line;
- grants no gold, item, XP, reputation, access, travel, heat change, or penalty;
- is never required to open the gate.

The canal is an intentional mastery edge in attention, not a reward farm.

## Core Loops

### Adventure loop

```text
Arrive unknown
  → discover the first mark
    → act under server authority
      → see the mark advance
        → choose whether to follow the oath road or explore
          → earn all six marks
            → gate opens
              → High City + Chronicle memory
```

### Optional calm loop

```text
Notice canal landmark
  → stand beside the post
    → request a cast
      → server validates place + cooldown
        → quiet result + durable receipt
          → return to the oath road
```

There are no forced timers. A knowledgeable player may finish quickly; the
thirty-minute envelope comes from observation, social contact, optional
exploration, and choice—not from waiting gates.

## State, Receipts, and Visible Consequence

| Beat | Server-owned state | Existing canonical evidence | Visible consequence |
| --- | --- | --- | --- |
| Arrival | session, map, spawn | `enter_world`, presence receipts | Rookguard, premise, first objective |
| Road-rune | tutorial movement mark | `tutorial_step_complete` | first progress mark fills |
| Signal | tutorial chat mark | `chat`, `tutorial_step_complete` | signal witnessed; next mark shown |
| Tem | challenge state + tutorial Tem mark | `tem_challenge_issued`, `tem_challenge_passed`, `tutorial_step_complete` | challenge clears; training opens |
| Canal | place, cooldown | `skill_use_intent`, `rookguard_canal_fished`, `skill_resolved` | honest quiet-cast line |
| Yard | training projection | `mob_kill`, `item_minted` | yard-mark fills |
| Oath | identity vocation | `vocation_declared` | vocation badge and oath profile |
| Gate | tutorial completion + map transfer | `gate_unlock`, `tutorial_completed` with adventure, gate, destination, vocation, and six-mark evidence | High City entry and `tutorial_complete` Chronicle projection |

Canonical receipts remain truth. Quest state, UI marks, dialogue, and Chronicle
are rebuildable projections.

## Failure States and Recovery

| Failure | Consequence | Earned recovery |
| --- | --- | --- |
| Select High City before initiation | No bypass is granted | Character enters Rookguard; the selected world remains destination affinity |
| Miss or leave a required mark | Gate stays closed | Objective and unfinished mark remain visible |
| Tem failure / timeout | Existing throttle and failure receipt | Retry after the server-owned boundary |
| Training slime already defeated | Shared respawn delay | Wait, explore, speak, or visit the canal; no permanent denial |
| Remote or pre-world fishing | Receipted `invalid_target` rejection | Stand inside the canal landmark and retry |
| Fishing cooldown | Receipted cooldown rejection | Return after the existing cooldown; no lost asset |
| Disconnect | No client-authored completion | Receipt replay restores completed marks on reconnect |
| Projection failure after completion | Receipt remains canonical | Rebuild Chronicle and quest state from the chain |

## System Interactions

- **Progression:** vocation is durable identity, not a stat or power grant.
- **Combat:** the training slime remains the only required combat proof; formulas
  and drops are unchanged.
- **Economy:** canal fishing is explicitly zero-economy.
- **Social:** local chat is one required public signal; guide and steward
  dialogue explain the rite without coordinates or implementation language.
- **World simulation:** no new actor, event service, timer, or autonomous system.
- **Risk spine:** the player earns passage through accepted acts; the client
  cannot submit position, quest completion, catch, or Chronicle truth.
- **Chronicle:** `tutorial_completed` commits the selected vocation and six-mark
  completion evidence, then derives one `tutorial_complete` memory; the receipt
  is never rewritten.
- **Presentation assets:** runtime UI chrome uses the reviewed deterministic
  Classic 32 source textures. Generated raw checkerboard previews are not
  promoted into the built/client mirrors.

## Anticipated Player Behavior

### Healthy

- Read the route from landmarks rather than coordinates.
- Talk to the guide or steward for context.
- Detour to the canal because it looks interesting.
- Help another newcomer locate the yard or hall.
- Choose an oath for identity rather than an immediate numerical advantage.
- Finish quickly through knowledge without bypassing proof.

### Toxic / exploit pressure

- Remote fishing calls from another map or before world entry.
- Cooldown spam.
- Empty chat filler solely to clear the signal.
- Shared-slime denial or spawn camping.
- Client attempts to claim position, mark completion, or catch outcome.

Existing cadence, Tem, cooldown, server position, shared-mob, and receipt
controls remain authoritative. No new anti-cheat heat is attached to legitimate
canal curiosity.

## Kill-Switches and Balancing Levers

- Remove the canal action from client projection while retaining receipts and
  required path.
- Raise or lower the existing fishing cooldown.
- Tighten or widen the canal landmark.
- Reword guide, steward, objective, or outcome copy without changing mechanics.
- Disable recruitment if build identity, account entry, receipt integrity, or
  runtime availability is unstable.
- Revert the presentation title and progress marks without rewriting any
  gameplay receipt.

The required six-mark gate predicate is not a live-content balancing lever in
this lane.

## Long-Term Health Metrics

| Metric | Why it matters |
| --- | --- |
| Account character → successful `enter_world` | Detects entry traps |
| Time to first accepted movement mark | Orientation |
| Tem pass / retry / abandonment | Pressure without confusion |
| Canal discovery and accepted-cast rate | Voluntary curiosity |
| Remote fishing rejection rate | Client/context drift or abuse |
| Training wait, kill, and abandonment | Shared-object denial |
| Vocation choice distribution | Identity legibility |
| Gate completion rate and elapsed time | Adventure closure |
| Optional action after last instructed mark | Self-directed play |
| Qualified D1–D7 voluntary return | Product truth |

Receipt-derived metrics may prove behavior. Loss comprehension, delight, and
desire to return require human evidence.

## Edge Cases and High-Skill Play

- Fast routing is allowed. Knowledge compresses travel; it does not waive marks.
- A player may ignore the canal and still finish.
- A player may fish repeatedly within cooldown rules, but gains no power.
- Multiple players may share the route and slime; no player owns the gate.
- Reconnect after any completed mark must restore the same projection.
- Completion at the gate must materialize once; duplicate delivery must not
  create a second Chronicle event.

## Compatibility Classification

- **Wire contract touched:** none.
- **Receipt content touched:** existing `gate_unlock` and
  `tutorial_completed` receipts gain additive server-derived evidence fields;
  their action names and replay meaning are retained.
- **Compatibility impact:** wire-compatible; existing message and receipt names
  are retained.
- **Client action required:** web and Android only hide the existing fishing
  action outside its actual landmark and render existing payload copy.
- **New infrastructure:** none.
- **New protocol version:** none.
- **New economy / progression / combat formula:** none.

## Verification Gate

Required before handoff:

```text
npm -w apps/server run test:character-v2
npm -w apps/server run verify:rookguard-quest
npm -w apps/server run verify:rookguard-codex-path
npm -w apps/debug-client run build
npx tsx packages/shared/test/builderDraft.test.ts
node scripts/smoke-web-play-shell.mjs --fake-playable --chrome <system-chromium> --out <temporary-evidence-dir>
bash scripts/verify_protocol_sync.sh
bash scripts/verify-rookguard-first30-presentation.sh
Android focused tests/build for changed Kotlin surfaces
npm run verify:assets
npm run verify:asset-sync
npm run verify:quick
CI-equivalent isolated rate-limit scenarios against four fresh local servers
```

`npm run verify:play-motion` targets the deployed `/play/` surface and is a
post-deployment gate. It must not be pointed at an older live build to claim
proof for uncommitted local source.

The generic `npm run verify` / `verify:full` profile currently invokes the
live-server rate-limit verifier without starting a server or assigning isolated
per-scenario connection budgets. It is therefore reported, not silently called
green: the final local run passed 24/25 and stopped only at that inherited
adapter topology. The canonical CI-equivalent proof starts one fresh server for
each of `ip_flood`, `move_spam`, `chat_spam`, and `attack_spam`; all four must
pass before push. Reworking the generic verification harness is outside this
frozen gameplay lane.

Passing automation proves authority, replay, compatibility, and presentation
integrity. It does not prove the adventure is excellent. That claim remains
blocked on the real-stranger protocol.
