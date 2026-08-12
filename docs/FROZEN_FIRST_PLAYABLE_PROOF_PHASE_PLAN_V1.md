# Frozen First Playable Proof Phase Plan v1

**Status:** A1 source implementation authorized; A2–A5 runtime and participant
execution not authorized

**Planning authority:** project-owner approval in the active Codex thread on
2026-08-12: `Approved to create phase plan`

**A1 authority:** project-owner approval in the active Codex thread on
2026-08-12: `Approved`

**Stage boundary:** controlled playable pre-alpha

## Objective

Prove that one fixed Akalynth web build supports one complete, understandable,
server-authoritative player journey:

```text
account entry
  -> character creation and selection
    -> The Gate Remembers in Rookguard
      -> High City
        -> Gather -> Attune -> Deliver
          -> disconnect and reconnect
            -> restored progress and Chronicle evidence
```

This plan does not add another game system. It joins and proves the existing
account, Rookguard, gather, receipt, persistence, and client surfaces as one
playable slice.

## Authority boundary

The planning approval authorized creation and review of this plan. The later A1
approval authorizes only the Phase 1 and Phase 3 source changes, local
verification, commit, and feature-branch push described here. Neither approval
authorizes:

- merge to a protected or canonical branch;
- installation of release manifests;
- service, Kubernetes, Caddy, or environment changes;
- live account, character, gameplay, or receipt writes;
- cohort creation or activation;
- invite issuance or participant recruitment;
- a public-launch, content-alpha, retention, or product-market-fit claim.

Each mutating phase below has its own explicit authority gate.

## Current baseline

Re-probe every item before execution. At plan creation, the observed baseline
is:

- backend commit `948c944849fb558986d925929bd5d36446abf6c9` is live;
- site commit `121cb9900a4ddff1f01a6c95f02a9f5ec85d2e57` is the portal source;
- schema v27 is live with both cohort manifest-binding columns;
- the cohort ledger has zero cohorts and zero invites;
- `CHILL_ZONE_GATHER_ENABLED=1` and `CHILL_ZONE_REFINE_ENABLED=1` are live;
- invite enforcement is off and no active release-manifest path is configured;
- Android v2026080704 remains healthy but the first pilot platform is web;
- the live receipt chain passes with the accepted bounded historical exception;
- the successful publish recovery snapshot is retained at
  `/var/backups/akalynth-beta-publish/20260812T022044Z`.

The latest observed receipt head is not a frozen cohort boundary. Capture a new
head at each phase that performs live writes.

## Player promise

A fresh player can enter through the real account page, understand and finish
one initiation, reach High City, complete one calm repeatable activity, leave,
and return without losing server-owned progress.

### Required journey

1. Register or sign in through the real account surface.
2. Create and select a Rookguard character.
3. Enter the world with account-scoped token login, never guest fallback.
4. Complete the six marks of **The Gate Remembers**:
   movement, local chat, Tem, training slime, vocation, and gate passage.
5. Reach High City, currently backed by the legacy `Azura` runtime id.
6. Complete **Gather -> Attune -> Deliver** using server-provided node and
   station ids.
7. Disconnect, obtain a fresh play token through the account page, reconnect,
   and observe the same completed quest, map, identity, and Chronicle state.

The Rookguard canal cast is an optional discovery beat. It grants no power and
must never block passage.

## Proof levels

| Level | Meaning | Evidence required |
| --- | --- | --- |
| P0 — assembled | All required source paths and focused verifiers exist. | Clean source, passing focused gates, exact planned release identity. |
| P1 — technically playable | One credentialed live account completes the whole journey and reconnects. | Redacted smoke report, exact receipt slice, chain verification, stable health. |
| P2 — human-playable pre-alpha | Real newcomers can attempt the journey without coaching and all stalls are reconstructable. | Frozen 12-person cohort evidence with interventions and exclusions. |
| P3 — earns return | The fixed build produces meaningful voluntary return signal. | At least 4 qualified returns under the accepted seven-day protocol, followed by a second independent cohort. |

P1 is a technical release claim, not proof of fun. P2 and P3 require humans.

## Authorization gates

| Gate | Separate approval required | Enables |
| --- | --- | --- |
| A0 | Plan approval — granted | Review and refine this document only. |
| A1 | Source implementation, commit, and push — granted | Read-only manifest tooling and the bounded journey smoke harness. |
| A2 | Trusted manifest installation and beta restart | Root-custodied active/rollback identity with invite enforcement still off. |
| A3 | Credentialed live-write smoke | One disposable technical account and its append-only gameplay evidence. |
| A4 | Invite-policy activation and sentinel admission | Closed-traffic policy switch, one non-pilot sentinel cohort/invite. |
| A5 | Cohort activation, invite issue, and recruitment | The 12-person stranger pilot. |

An earlier approval never implies a later gate.

## Phase 0 — Re-probe and freeze the candidate tuple

**Mutation:** none.

### Work

- Reconfirm backend, portal, `/play/`, policy, routing, and optional Android
  identities from live files and APIs.
- Verify app and ops Git heads equal their GitHub and forge targets.
- Verify schema v27, zero cohorts, zero invites, public health, Caddy, pod
  readiness, receipt continuity, and recovery custody.
- Name the exact rollback generation and prove its backend and static files are
  readable from the retained snapshot or protected previous generation.
- Create a timestamped private evidence root and a redacted public evidence
  index. Do not copy secrets or the raw receipt chain into Git.

### Exit gate

- One immutable candidate tuple is named.
- One recoverable rollback tuple is named.
- No source, live state, policy, cohort, or receipt mutation occurred.

## Phase 1 — Produce release-manifest preimages

**Authority:** A1.

### Work

Add or reuse a read-only manifest materializer/verifier. It must never validate
by inserting a cohort row. If a new tool is needed, keep it bounded to:

- reading explicit backend, portal, `/play/`, policy, routing, and optional
  Android inputs;
- hashing regular non-symlink files;
- emitting canonical `akalynth.beta_release_manifest.v1` JSON;
- parsing the emitted JSON through the canonical server parser;
- verifying the release manifest against the exact live files;
- verifying the rollback preimage against the retained rollback artifacts;
- writing no database row, receipt, service configuration, or runtime file.

Produce three logical identities:

1. **Proof release manifest** — current live artifacts with
   `AKALYNTH_BETA_REQUIRE_INVITE=false`.
2. **Pilot release manifest** — the same approved gameplay artifacts but with
   `AKALYNTH_BETA_REQUIRE_INVITE=true`; it is inactive until A4.
3. **Rollback manifest** — the exact retained last-known-good artifacts and
   their actual policy.

The proof and pilot manifests intentionally have different digests because
admission policy is part of release identity. They must never be substituted
for one another.

### Verification

- Canonical JSON is stable across input key order and whitespace.
- Unknown, missing, duplicate, symlinked, or mutable inputs fail closed.
- Release and rollback backend commits match their `BUILD_INFO.json` files.
- All declared portal and `/play/` hashes match their named artifact roots.
- The Caddy hash and logical routing values are exact.
- Web-only manifests do not require Android identity; Android may be retained
  as supplemental release evidence without changing pilot platform.

### Exit gate

- All three immutable preimages and SHA-256 digests exist in protected evidence.
- The proof manifest matches current live policy.
- The pilot manifest is clearly marked inactive.
- The rollback manifest has a retained, readable artifact preimage.

## Phase 2 — Install the proof active manifest

**Authority:** A2.

### Work

- Copy the proof release, rollback, and active manifest files into a
  root-custodied release directory outside developer checkouts.
- Keep the release and active files as separate regular single-link files even
  when their bytes are identical.
- Set ownership to root and remove group/other write access.
- Configure
  `AKALYNTH_BETA_ACTIVE_RELEASE_MANIFEST=/etc/akalynth-beta/active-release-manifest.v1.json`.
- Keep `AKALYNTH_BETA_REQUIRE_INVITE=0` and leave the cohort ledger empty.
- Restart through the reviewed beta deployment path and verify the runtime
  loads the manifest, its backend commit, and all four policy booleans.

### Exit gate

- Health still reports the intended commit.
- Web and `/play/` return 200.
- Kubernetes is ready with no restart loop.
- Schema remains v27; cohorts and invites remain zero.
- The active manifest digest equals the proof release digest.
- Receipt verification passes after restart.

### Rollback

Restore the previous environment file and deployment configuration. Do not
truncate receipts, delete player state, or replace the canonical chain.

## Phase 3 — Implement the bounded first-playable smoke

**Authority:** A1.

### Work

Create a focused live harness, preferably alongside rather than inside the
existing entry-only `smoke-beta-account-play.mjs`. Reuse its account, cookie,
token-redaction, Playwright, and report custody. Reuse the exact action paths
from `verify:rookguard-codex-path` and `test:gather-loop`; do not add a new
WebSocket message.

The harness must:

- refuse live targets unless given an explicit `--live` acknowledgement;
- use a unique disposable technical account and character;
- drive only public HTTP, browser, and existing intent-only WebSocket surfaces;
- prove account token login rather than guest fallback;
- complete all required Rookguard marks under server authority;
- optionally exercise the zero-economy canal cast;
- complete one refined High City delivery;
- disconnect, reacquire a token through the account surface, and reconnect;
- write a redacted report with no email, password, cookie, invite, CSRF, play
  token, Chronicle key, or raw receipt body;
- identify its synthetic account and character so pilot reporting excludes it.

No direct database writes, position injection, quest completion injection,
receipt fabrication, debug-only runestone action, or post-test receipt cleanup
is permitted.

### Focused verification

```text
npm run verify:beta-player-readiness
npm run verify:beta-account-play-portal
npm -w apps/server run verify:rookguard-quest
npm -w apps/server run verify:rookguard-codex-path
CHILL_ZONE_GATHER_ENABLED=1 CHILL_ZONE_REFINE_ENABLED=1 npm -w apps/server run test:gather-loop
npm -w apps/debug-client run build
bash scripts/verify_protocol_sync.sh
npm -w apps/server run test:receipts-chain
focused tests for the manifest materializer and new smoke harness
```

Use the repository test runner to confirm exact command names before execution.
A composite verifier failure must be attributed rather than hidden.

### Exit gate

- The harness is locally deterministic against a fresh disposable server.
- Its negative tests prove secret redaction, guest-fallback rejection, and
  refusal to run live without acknowledgement.
- No protocol, economy, combat formula, schema, or anti-cheat rule changed.

## Phase 4 — Run one credentialed live journey

**Authority:** A3.

### Pre-boundary

- Re-run Phase 0 admission checks.
- Record the exact active proof-manifest digest.
- Record and verify the canonical receipt head.
- Confirm zero cohorts and zero invites.
- Confirm no release or policy drift will occur during the smoke.

### Live action

Run exactly one disposable technical journey through the real account and
`/play/` surfaces. Stop immediately on guest fallback, an impossible required
mark, unexplained state loss, P0 behavior, repeated P1 behavior, receipt-chain
failure, or build/manifest drift.

### Required server evidence

| Beat | Server state touched | Required receipt evidence |
| --- | --- | --- |
| Entry | account, session, character, play-token selection | `account_created`, `account_email_verified`, `account_login_succeeded`, `character_created`, `character_selected`, `enter_world` |
| Rookguard | position, tutorial flags, Tem, training projection, vocation | `move_intent`, `tutorial_step_complete`, `chat`, `tem_challenge_issued`, `tem_challenge_passed`, `mob_kill`, `item_minted`, `vocation_declared` |
| Optional canal | place and cooldown | `skill_use_intent`, `rookguard_canal_fished`, `skill_resolved` when attempted |
| Passage | tutorial completion, map transfer, Chronicle projection | `gate_unlock`, `tutorial_completed` |
| High City ritual | ephemeral held item and refinement; durable delivery | one `delivery_recorded` with `refined=true`, refinery provenance, and the existing non-tradeable acknowledgment |
| Reconnect | account token, hydrated quest/identity/map projections | a new successful `enter_world`; restored state must agree with prior receipts |

Gather and refine progress messages are transient. `delivery_recorded` is the
durable receipt for the completed ritual; the plan must not invent additional
durability.

### Exit gate — P1

- The redacted harness report passes.
- The exact post-smoke receipt slice contains the expected actions once where
  uniqueness is required and contains no secret material.
- Full receipt verification passes through the new head.
- Reconnect restores Rookguard completion, vocation, High City location, and
  Chronicle memory without client-authored truth.
- Public health, web, `/play/`, Android update identity, and pod readiness remain
  green.

P1 may then be reported as **technically playable on the frozen web build**.

## Phase 5 — Activate invite policy with a sentinel

**Authority:** A4.

This phase changes release identity because the invite-policy boolean changes.
Use a closed-traffic activation window.

### Work

1. Re-verify the inactive pilot manifest against the still-served artifacts.
2. Close public traffic through the reviewed deployment procedure.
3. Install the pilot manifest as the active manifest.
4. Set `AKALYNTH_BETA_ENABLED=1`, `AKALYNTH_BETA_REQUIRE_INVITE=1`, and the
   active-manifest path.
5. Restart and prove local health, manifest-policy equality, account recovery,
   and operator access before reopening traffic.
6. Create a one-seat sentinel cohort bound to the pilot and rollback manifests.
7. Issue one private sentinel invite, reopen traffic, and prove registration,
   redemption, account recovery, character entry, and cohort projection.
8. Close the sentinel cohort. Exclude it and its synthetic player from the
   stranger denominator.

Never expose the raw invite in Git, receipts, logs, screenshots, or public
evidence.

### Exit gate

- Uninvited registration fails closed while existing account recovery works.
- The sentinel invite redeems once and cannot be reused.
- Cohort status reports the exact pilot and rollback manifest digests.
- Receipt verification passes and the sentinel is explicitly excluded from
  pilot metrics.
- A new pre-participant receipt head is captured after the sentinel closes.

## Phase 6 — Run the 12-person stranger pilot

**Authority:** A5.

### Cohort protocol

- Create one 12-seat web cohort bound to the active pilot and rollback manifests.
- Issue invitations through the approved private channel only.
- Freeze gameplay code, UI, policy, routing, and manifest digest for the window.
- Give each newcomer exactly one instruction:

> Create a character and play for up to 30 minutes. Stop whenever you want.

- Do not coach objectives, Tem, canal, vocation, gate, gather, receipts, or
  return behavior.
- Log only consented observations, interventions, exclusions, and bounded exact
  quotes. Keep identifying information private.
- Do not remind or reward anyone for returning during the seven-day window.

### Measures

- account to world-entry success;
- first accepted action and first stall;
- each of the six Rookguard marks;
- gate completion and elapsed time;
- unaided canal discovery;
- post-gate continuation;
- unaided Gather -> Attune -> Deliver completion;
- optional action after the last instructed beat;
- technical intervention, P0, and P1 counts;
- qualified voluntary return under the accepted 24-hour to seven-day rule.

Client observations supplement receipts but never establish movement,
progression, inventory, rewards, or return truth.

### Stop conditions

Pause recruitment on any of:

- reproducible P0 behavior;
- repeated P1 failure in account entry or a required mark;
- build, active-manifest, policy, portal, `/play/`, or routing drift;
- receipt-chain or schema integrity failure;
- invite leakage, reuse, or cap breach;
- an outage that makes clean attribution impossible.

Do not hot-patch inside a cohort. Close or mark the cohort contaminated, repair
under a new release manifest, and begin a new evidence window.

## Phase 7 — Decide from evidence

Use the accepted return bands:

| Qualified voluntary returns | Decision |
| --- | --- |
| 0–1 | The journey is not earning return. Repair the dominant measured stall; do not add broad content. |
| 2–3 | Pull is weak or ambiguous. Make one bounded correction and repeat with a new manifest and cohort. |
| 4+ | Meaningful directional signal. Run a second independent cohort before expanding the slice. |

The dominant-stall correction may change presentation, route legibility, retry
copy, or one existing interaction. Any protocol, persistence, economy,
anti-cheat, or receipt change must be routed through its domain authority and
creates a new release identity.

After two independent positive cohorts, the next content promotion should be
one existing server-authoritative High City seed, such as Witness Moth Bloom.
Do not jump directly to origins, factions, a dungeon, boss, or final-choice
system.

## Abuse and integrity controls

- Clients send intents only; the server owns position, timers, challenges,
  combat, quest state, held items, rewards, transfer, and persistence.
- Existing movement cadence, chat limits, Tem escalation, gather cooldowns,
  station proximity, and single-use invite rules remain active.
- The training slime is a shared-object denial risk; repeated newcomer stalls
  there are a stop signal, not permission to grant completion.
- Canal fishing remains zero-economy and optional.
- Gather acknowledgments retain their existing non-tradeable semantics; this
  plan adds no faucet or balance change.
- Synthetic and operator activity is labeled and excluded from stranger and
  return metrics.
- Receipts are append-only. Test cleanup may revoke credentials or close a
  cohort, but must never erase or rewrite canonical evidence.

## Evidence custody

Keep private operational evidence outside Git under a root-custodied directory
named for the release and phase. Commit only redacted summaries that omit:

- emails, handles, and direct identifiers;
- passwords, cookies, CSRF values, play tokens, and raw invite codes;
- Chronicle or signing keys;
- private feedback bodies;
- the raw canonical receipt chain.

Every phase handoff must state separately:

- implementation status;
- verification status;
- commit status;
- GitHub/forge push status;
- install/deploy status;
- live-write status;
- cohort/invite/recruitment status;
- exact remaining authorization gate.

## Explicit deferrals

- public launch and unrestricted registration;
- Android as a participant platform for the first cohort;
- full High City runtime-id migration;
- origin-specific openings and faction reputation;
- First Archive dungeon and Unindexed Truth boss;
- Preserve / Suppress / Release final choice;
- new progression, economy, combat, protocol, or anti-cheat systems;
- any retention claim beyond the named directional cohorts.

## Source references

- [`ROOKGUARD_FOCUSED_ADVENTURE_EXECUTION_V1.md`](./ROOKGUARD_FOCUSED_ADVENTURE_EXECUTION_V1.md)
- [`ROOKGUARD_STRANGER_RETURN_PILOT_V1.md`](./ROOKGUARD_STRANGER_RETURN_PILOT_V1.md)
- [`CLIENT_PLAY_SURFACE_CONTRACT_V1.md`](./CLIENT_PLAY_SURFACE_CONTRACT_V1.md)
- [`AKALYNTH_STRANGER_PILOT_RELEASE_MANIFEST_BINDING_V1`](./decisions/AKALYNTH_STRANGER_PILOT_RELEASE_MANIFEST_BINDING_V1/DECISION.md)
- [`beta-player-readiness-runbook-v1.md`](./runbooks/beta-player-readiness-runbook-v1.md)
- [`FIRST_PLAYABLE_SOURCE_INTAKE.md`](./asset-decisions/AKALYNTH_FIRST_PLAYABLE_SOURCE_INTAKE_V1/FIRST_PLAYABLE_SOURCE_INTAKE.md)
