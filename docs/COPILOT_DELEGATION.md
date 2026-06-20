# Codex Delegation

> **Purpose:** Explain the delegation pattern Akalynth uses to keep architecture-critical work inside guardrails, and how it is realized today through the `.codex` operating map, Codex skills/plugins, and the canonical skill source.
>
> **Current implementation note:** The active local map for Codex is `.codex/CODEX_MAP.md`. Akalynth's authored skill source is still `.claude/skills/` (each skill is a `SKILL.md` with `name` + `description` frontmatter), while Codex consumes those skills through the user-level `~/.codex/skills/` symlinks and the curated `plugins/akalynth-studio/skills/` plugin surface. There is no `.claude/agents/`, no `.claude/commands/`, and no root `CLAUDE.md` workflow to maintain.

## What is Codex Delegation?

**Codex delegation** is a development pattern where a general-purpose AI coding assistant routes specialized tasks through **focused skills** -- domain experts with specific knowledge, tools, and constraints.

Think of it as a senior engineer (Codex) consulting a team of specialized engineers. The working entry point is `.codex/CODEX_MAP.md`; the authored skill bodies live in `.claude/skills/`; Codex sees those skills through the configured user/plugin skill stores.

## Core Concept

```
┌─────────────────────────────────────────────────────────┐
│              General Codex (Manager)                    │
│  • Understands full repository context                  │
│  • Routes tasks to appropriate specialists              │
│  • Validates overall integration                        │
└────────────┬────────────────────────────────────────────┘
             │
             ├─► Skill: protocol-guardian
             │   └─ Expertise: WebSocket protocol / client-server contract
             │
             ├─► Skill: anti-cheat-steward
             │   └─ Expertise: Detection, heat, Tem, enforcement
             │
             ├─► Skill: server-cartographer
             │   └─ Expertise: Server world / map authority
             │
             └─► Skill: receipt-chain-steward
                 └─ Expertise: Append-only receipts, evidence chain
```

## Why Delegation Matters for Akalynth

Akalynth has **strict architectural constraints** that are easy to violate accidentally:

### 1. **Receipt-First Architecture**
- ❌ Bad: Add a feature, then add receipts as afterthought
- ✅ Good: Codex skill ensures receipts are designed first, code follows

### 2. **Server Authority**
- ❌ Bad: Client sends coordinates, server validates
- ✅ Good: Codex skill enforces intent-only pattern

### 3. **Civil Guarantees (G1-G15)**
- ❌ Bad: Introduce RNG that's not reproducible
- ✅ Good: Codex skill blocks non-deterministic changes

### 4. **Anti-Cheat Vigilance**
- ❌ Bad: Add movement feature that bypasses speed checks
- ✅ Good: Codex skill validates against detector patterns

## How It Works

### Traditional Approach (No Delegation)
```
User: "Add item drop evidence for players"
     ↓
Codex: *writes code directly*
     ↓
Result: May violate receipts-first, forget audit trail, 
        or introduce client-authoritative pattern
```

### With Delegation
```
User: "Add item drop evidence for players"
     ↓
Codex: *recognizes this is chronicle/receipt evidence work*
     ↓
Codex: *loads the receipt-chain-steward skill*
     ↓
Skill:
  - Validates against Civil Guarantees
  - Ensures receipt-driven design
  - Uses existing explainDeathDrops() function
  - Adds proper ownership validation
  - Creates read-only WS endpoint
     ↓
Result: Architecturally sound implementation
```

## Engineering Loop: From Delegated Task To Git Push

Codex delegation does not end when code compiles. For Akalynth, delegation carries work through a bounded engineering loop before code is allowed to leave the local worktree:

```text
User intent
  ↓
Codex reads .codex/CODEX_MAP.md
  ↓
Codex identifies affected domains
  ↓
Codex loads relevant skill(s)
  ↓
Codex makes bounded implementation
  ↓
Codex runs focused verification
  ↓
Codex records evidence
  ↓
Codex commits with domain-aware message
  ↓
Codex pushes only after gates pass
```

The goal is to prevent architecture-critical work from reaching Git history without the same constraints that governed implementation.

### Core Rule

A Codex-assisted git push is allowed only when the implementation, evidence, and commit message all preserve the delegated domain contract.

That means:

1. The task was routed through `.codex/CODEX_MAP.md`.
2. The relevant skill constraints were applied.
3. The changed files match the delegated scope.
4. Verification commands were run.
5. Any skipped checks are explicitly named.
6. The commit message records the domain and evidence path.
7. The push does not include unrelated worktree changes.

### Engineering Loop Authority Boundaries

The engineering loop separates authority, execution, evidence, verification, and presentation.

| Layer | Owner | Purpose |
|---|---|---|
| User intent | Human operator | Defines the requested outcome |
| Routing authority | `.codex/CODEX_MAP.md` | Determines which skills apply |
| Domain constraints | `.claude/skills/*/SKILL.md` | Defines what must not be violated |
| Execution | Codex / local runtime | Edits files and runs commands |
| Evidence | Terminal output, diffs, receipts, manifests | Shows what happened |
| Verification | Tests, linters, domain verifiers | Checks the result |
| Git custody | Branch, commit, push | Transfers local work into shared history |
| Review | Human or delegated reviewer | Accepts or rejects the pushed work |

Codex may execute the loop, but it does not become the authority. The authority remains in the project map, skill source, tests, verifiers, and Git history.

### Delegated Git Push Contract

Before pushing, Codex should produce a small, auditable push record.

```markdown
Delegated push record:
- Task:
- Branch:
- Skills used:
- Files changed:
- Domain constraints checked:
- Verification commands run:
- Verification result:
- Known gaps:
- Commit hash:
- Push target:
```

Example:

```markdown
Delegated push record:
- Task: Add player-visible death drop evidence endpoint
- Branch: feat/death-drop-evidence
- Skills used:
  - receipt-chain-steward
  - protocol-guardian
  - test-runner
- Files changed:
  - apps/server/src/ws/evidence.ts
  - packages/shared/protocol.ts
  - docs/PROTOCOL.md
  - apps/server/test/death-drop-evidence.test.ts
- Domain constraints checked:
  - Receipt-first evidence path
  - Ownership validation before data exposure
  - Read-only evidence endpoint
  - Protocol/docs parity
- Verification commands run:
  - npm run verify
  - npm run verify:skills
  - npm test -- death-drop-evidence
- Verification result:
  - Passed locally
- Known gaps:
  - No browser client UI added
- Commit hash:
  - <hash after commit>
- Push target:
  - origin feat/death-drop-evidence
```

This record is not a replacement for tests. It is a custody note for the operator and reviewer.

### Engineering Loop Phases

#### Phase 0: Worktree Preflight

Before Codex edits anything, inspect the current Git state:

```bash
git status --short
git branch --show-current
git remote -v
```

Codex should not mix delegated work with unrelated local changes. If unrelated changes exist, refuse the push until the operator commits them separately, stashes them, or explicitly includes them in this delegated task.

#### Phase 1: Route The Task

Codex reads `.codex/CODEX_MAP.md`, identifies the domain lane, and names the selected skills before implementation.

```markdown
Delegation route:
- Primary skill: receipt-chain-steward
- Supporting skill: protocol-guardian
- Verification skill: test-runner
- Reason: request adds player-visible evidence over the WebSocket protocol
```

#### Phase 2: Bound The Scope

Before editing, Codex defines the expected file boundary. If implementation requires expanding scope, Codex stops and restates the new boundary and any additional skill required.

```markdown
Expected scope:
- packages/shared/protocol.ts
- apps/server/src/ws/*
- apps/server/src/receipts/*
- docs/PROTOCOL.md
- tests covering evidence access
Out of scope:
- client UI redesign
- combat balance
- map data changes
- unrelated refactors
```

#### Phase 3: Implement Under Skill Constraints

Implementation must follow the relevant skill's hard constraints. Receipt evidence work preserves append-only evidence, ownership validation, stable receipt identifiers, deterministic explanation paths, and no client-authoritative claims. Protocol work preserves shared type updates, server/client handler parity when applicable, docs parity, and receipt/event schema sync. Anti-cheat work preserves deterministic detection, evidenced heat changes, explainable enforcement, and no enforcement without a receipt path.

#### Phase 4: Focused Verification

Codex chooses verification commands through `test-runner` or the relevant domain skill. The minimum loop should be:

```bash
git diff --check
npm run verify:skills
npm run verify
```

Domain-specific commands should be added when applicable, such as `npm test -- death-drop-evidence`, `npm test -- protocol`, `npm test -- anticheat`, `npm test -- movement`, `npm run lint`, or `npm run typecheck`. A check is only verified if Codex names the command and reports the observed result.

If a required command fails, the loop does not proceed to push unless the operator explicitly authorizes a failing push.

#### Phase 5: Evidence Capture

For architecture-critical changes, Codex leaves enough evidence for another operator to reconstruct the work: diff summary, verification output, tests, schema/docs changes, generated manifests, and commit hash. High-risk work may add a local manifest under `docs/evidence/<YYYY-MM-DD>-<task-slug>.md`.

#### Phase 6: Commit Discipline

The commit preserves the delegation boundary. Recommended format:

```text
<domain>: <imperative summary>

Delegation:
- Primary skill: <skill>
- Supporting skills: <skills>
Evidence:
- <commands run>
- <tests added/updated>
- <manifest path if present>
Constraints:
- <constraint checked>
- <constraint checked>
Known gaps:
- <gap or none>
```

Suggested sequence:

```bash
git add <scoped files>
git diff --cached --stat
git diff --cached --check
git commit
```

Codex should avoid `git add .` unless the worktree has already been proven clean and every changed file belongs to the delegated task.

#### Phase 7: Push Gate

Before push:

```bash
git status --short
git log --oneline -1
git diff origin/$(git branch --show-current)..HEAD --stat
```

Push is allowed only when the worktree is clean, the latest commit matches the delegated task, verification passed or gaps are explicitly authorized, and the target branch is correct. Prefer feature branches; if a protected branch rejects the push, push a feature branch and leave review instructions.

### Git Push Decision Table

| Condition | Action |
|---|---|
| Worktree has unrelated changes | Refuse push |
| Skill constraints not applied | Refuse push |
| Required tests failed | Refuse push |
| Verification command unavailable | Record gap; ask operator only if push depends on it |
| Docs changed without protocol/schema sync | Refuse push |
| Protocol changed without shared type update | Refuse push |
| Receipt feature lacks receipt/evidence path | Refuse push |
| Anti-cheat enforcement lacks evidence | Refuse push |
| Commit includes unrelated refactor | Split commit |
| All gates pass | Push feature branch |

### Push Refusal Examples

```text
Refused — violates git push custody: unrelated worktree changes detected.
Unrelated files:
- apps/client/src/theme.ts
- notes/local-debug.md
Required correction:
- remove, stash, or separately commit unrelated files before this delegated push.
```

```text
Refused — violates delegation contract: protocol files changed without protocol-guardian route.
Changed files:
- packages/shared/protocol.ts
- docs/PROTOCOL.md
Required correction:
- re-run review through protocol-guardian before commit/push.
```

```text
Refused — violates verification gate: `npm run verify` failed.
Observed result:
- Type error in apps/server/src/ws/evidence.ts
Required correction:
- fix the failure and rerun verification before push.
```

```text
Refused — violates scoped commit discipline: staged diff includes local config.
Staged file:
- .env.local
Required correction:
- unstage the file and verify `.gitignore` coverage.
```

## Akalynth's Codex Skill System

### Directory Structure

The active Codex entry point is `.codex/CODEX_MAP.md`. It records the local dev-box authority, skill stores, plugin surfaces, and routing matrix.

Authored Akalynth skills live under `.claude/skills/`, one directory per skill, each containing a `SKILL.md`:

```text
.claude/
├── skills/
│   ├── anti-cheat-steward/SKILL.md          # Heat, Tem, enforcement
│   ├── protocol-guardian/SKILL.md           # WebSocket protocol / contract
│   ├── server-cartographer/SKILL.md         # Server world / map authority
│   ├── receipt-chain-steward/SKILL.md       # Append-only receipt chain
│   ├── coordination-kernel-steward/SKILL.md
│   ├── gameplay-loop-designer/SKILL.md
│   ├── content-designer/SKILL.md
│   ├── map-and-lore-builder/SKILL.md
│   ├── debug-client/SKILL.md
│   ├── android-client/SKILL.md
│   ├── ci-steward/SKILL.md
│   ├── deploy-steward/SKILL.md
│   ├── test-runner/SKILL.md
│   ├── git-push-steward/SKILL.md          # Git custody / push boundary
│   ├── delegation-steward/SKILL.md          # Turns requests into delegated tasks/issues
│   └── akalynth-system-audit/SKILL.md
└── settings.json                            # Claude Code permission allowlist
```

Codex-facing surfaces point back to that authored source:

```text
.codex/
├── CODEX_MAP.md                             # Active Codex map for this dev box
├── config.toml.example                      # Recommended Codex posture template
└── skills/
    └── akalynth-system-audit/               # Project Codex-format audit skill

plugins/akalynth-studio/skills/              # Curated Codex plugin skills
~/.codex/skills/                             # User-level Akalynth skill symlinks
```

> The authored source for Akalynth domain skills is `.claude/skills/`. Codex should read `.codex/CODEX_MAP.md` first for routing and then use the relevant skill. Do not hand-edit installed copies under `.agents/skills` or `~/.codex/skills`.

### Skill Anatomy

Each skill is a `SKILL.md` file with:

1. **Frontmatter** — `name` and `description` (the description states when to use the skill)
2. **Role Statement** — what the skill does
3. **Hard Constraints** — non-negotiable rules
4. **Scope** — what's in/out of scope
5. **Operating Principles** — how to approach tasks
6. **Project Context** — Akalynth-specific knowledge

Example (abridged) from `.claude/skills/anti-cheat-steward/SKILL.md`, consumed by Codex through the configured skill stores:

```markdown
---
name: anti-cheat-steward
description: Use when modifying Akalynth anti-cheat detection, heat, Tem challenges, enforcement, penalties, evidence, or player-facing anti-bot feedback.
---

# Anti-Cheat Steward

Keep enforcement deterministic, evidenced, and explainable.

Separate these concerns:
- Detection: signals, cadence, movement anomalies, chat rate, priors.
...
```

## When to Use Delegation

### ✅ Use Codex Skills For:

1. **Architecture-Critical Changes**
   - Protocol modifications
   - Receipt schema additions
   - Anti-cheat detector patterns

2. **Domain-Specific Features**
   - Chronicle evidence (use `receipt-chain-steward`)
   - Tem challenge logic (future `anticheat-engineer`)
   - World state updates (future `world-engineer`)

3. **Compliance Enforcement**
   - Civil Guarantees validation
   - Audit trail completeness
   - Deterministic behavior verification

### ❌ Don't Need Delegation For:

1. **Simple Fixes**
   - Typos, formatting
   - Adding comments
   - Updating dependencies

2. **Documentation Only**
   - README updates
   - Comment improvements
   - Doc structure changes

3. **Tooling**
   - Scripts that don't touch game logic
   - Build configuration
   - CI/CD setup

## Benefits for Akalynth

### 1. **Constraint Enforcement**
Codex skills act as **guardrails** for complex architectural rules:

```typescript
// WITHOUT SKILL CONTEXT: Easy to forget
function handleMove(x: number, y: number) {
  player.position = {x, y};  // ❌ Client-authoritative!
}

// WITH SKILL CONTEXT: Enforces intent-only pattern
function handleMoveIntent(direction: Direction) {
  // Validate intent
  // Server computes new position
  // Emit receipt
  // Broadcast result
}
```

### 2. **Knowledge Preservation**
Skills capture tribal knowledge that's scattered across:
- `docs/ARCHITECTURE.md`
- `docs/PROTOCOL.md`
- `docs/ANTICHEAT.md`
- Comments in code

### 3. **Consistency**
Same task → same approach, every time:
- Always emit receipts in JSONL format
- Always validate ownership before exposing data
- Always check tiles are walkable before movement

### 4. **Reduced Review Burden**
Pull requests produced with the right skill context need less scrutiny because constraints are pre-validated.

### 5. **Faster Onboarding**
New contributors can rely on skills to teach them patterns:
- "Use anti-cheat-steward to add a detection signal"
- Skill guidance walks them through proper pattern

## Creating Or Updating Codex Skills For Akalynth

### Step 1: Identify the Domain

Good skill candidates:
- **Protocol Engineer** - WebSocket message types, client/server contract
- **Anticheat Engineer** - Detector patterns, Tem challenges, heat scoring
- **World Engineer** - Map data, movement validation, spawn points
- **Persistence Engineer** - Receipt-driven SQLite, materialization
- **Audit Engineer** - JSONL format, public receipt redaction

### Step 2: Define Hard Constraints

From Akalynth's architecture:
```markdown
Hard constraints (non-negotiable):
1. Server is authoritative. Client sends intent only.
2. Every player action emits a JSONL receipt.
3. Movement must validate: walkable tile, speed limit, direction.
4. Anti-cheat checks run before applying intent.
5. No RNG without deterministic seed from receipt_hash.
```

### Step 3: Specify Scope

```markdown
Scope:
- Movement validation logic
- Tile walkability checks
- Speed limit enforcement
- Direction validation

Out of scope:
- Combat mechanics (separate skill)
- Inventory system (separate skill)
- Chat (separate skill)
```

### Step 4: Add Operating Principles

```markdown
Operating principles:
- Check tile walkability before updating position
- Always emit move_intent receipt before move_result
- Broadcast to nearby players only (within view range)
- Reject impossible moves with clear error messages
```

### Step 5: Provide Project Context

```markdown
Project context:
- Movement logic: apps/server/src/world/movement.ts
- World state: apps/server/src/world/state.ts
- Map data: packages/shared/maps/*.json
- Protocol: packages/shared/protocol.ts (move_intent, move_result)
```

### Template

```markdown
---
name: [skill-name]
description: Use when working on [feature area]...
---

You are the [Role] for Akalynth.

Your role:
- [Primary responsibility]
- [Secondary responsibility]

Hard constraints (non-negotiable):
1. [Architectural rule from ARCHITECTURE.md]
2. [Protocol rule from PROTOCOL.md]
3. [Anti-cheat rule from ANTICHEAT.md]

Scope:
- [Feature area 1]
- [Feature area 2]

Explicitly out of scope:
- [Other feature areas]
- [Changes requiring a different skill]

Operating principles:
- [How to approach tasks]
- [Key validation steps]

Project context:
- [Relevant file paths]
- [Key functions to reuse]
- [Protocol message types]

If asked to do anything outside this scope, respond with:
"Refused — violates [constraint]: [reason]."
```

## Practical Examples

### Example 1: Adding Anti-Cheat Signal

**Without delegation:**
```typescript
// Developer adds signal but forgets heat calculation
if (perfectCadence) {
  console.log("Suspicious pattern detected");
}
```

**With anti-cheat-steward:**
```typescript
// Skill guidance ensures proper pattern:
// 1. Detect pattern
// 2. Update heat score
// 3. Emit receipt
// 4. Check threshold
// 5. Issue Tem if needed
if (perfectCadence) {
  heat += HEAT_PERFECT_CADENCE;
  emitReceipt("heat_signal", {pattern: "perfect_cadence"});
  if (heat >= TEM_THRESHOLD) {
    issueTemChallenge();
  }
}
```

### Example 2: Protocol Change

**Without delegation:**
```typescript
// Developer adds field without documenting
interface MoveResult {
  x: number;
  y: number;
  newField: string;  // ❌ Not in PROTOCOL.md
}
```

**With protocol-guardian:**
```typescript
// Skill guidance ensures:
// 1. Update docs/PROTOCOL.md
// 2. Update packages/shared/protocol.ts
// 3. Add server handler
// 4. Add client handler
// 5. Add receipt type
// 6. Update verification scenario
```

### Example 3: Evidence Feature

**Task:** "Show players why their item dropped on death"

**Delegation flow:**
```
Codex recognizes: chronicle/receipt evidence work
    ↓
Delegates to: receipt-chain-steward
    ↓
Skill implements:
  ✅ Read-only WS endpoint (get_evidence)
  ✅ Validates player ownership
  ✅ Reuses explainDeathDrops()
  ✅ Anchors to chronicle_event_id
  ✅ Returns structured evidence
  ✅ Preserves Civil Guarantees
```

## Integration with General Guidance

General, project-wide guidance (project overview, build/test commands, commit discipline, MVP scope) lives in the top-level docs and Codex entry points — primarily `AGENTS.md`, `README.md`, `.codex/CODEX_MAP.md`, `docs/ARCHITECTURE.md`, and `docs/CURRENT_STAGE.md`. Skills are **specialists** that operate within that guidance but add domain-specific knowledge.

### Division of Responsibility

**General guidance** (`AGENTS.md`, `README.md`, `.codex/CODEX_MAP.md`, `docs/ARCHITECTURE.md`, `docs/CURRENT_STAGE.md`):
- Project overview
- Build/test commands
- File structure
- Commit discipline
- MVP scope

**Skills** (Domain Specialists):
- Specific feature constraints
- Domain-specific patterns
- Technical decision rationale
- Code organization for that domain

### Example Flow

```
User: "Add Tem challenge for chat spam"
    ↓
General docs (ARCHITECTURE.md / ANTICHEAT.md): Context on Tem + anticheat pipeline
    ↓
Codex: Recognizes this is anti-cheat work
    ↓
Skill (anti-cheat-steward): Implements with proper:
  - Heat scoring
  - Threshold checks
  - Challenge issuance
  - Receipt emission
  - Audit trail
```

## Skills and Validation

### Skills (`.codex/CODEX_MAP.md` routing -> `.claude/skills/*/SKILL.md` source)

**Purpose:** Domain expertise for both quick checks and full implementation

**Examples:**
- `anti-cheat-steward` — anti-cheat detection, heat, Tem, enforcement
- `protocol-guardian` — WebSocket protocol / client-server contract
- `server-cartographer` — server world / map authority
- `receipt-chain-steward` — append-only receipt chain
- `ci-steward` — CI gates and verification workflow
- `test-runner` — running and triaging tests
- `git-push-steward` — commit and push custody, scoped staging, and push-readiness gates

**When to use:** Building features, refactoring domains, or running a focused review within a domain's constraints.

> Historical note: earlier revisions of this guide split delegation into `.claude/commands/*.md` (quick checks) and `.claude/agents/*.md` (full implementation). Those directories no longer exist. Codex routing is documented in `.codex/CODEX_MAP.md`, and domain instructions are authored under `.claude/skills/`.

## Best Practices

### 1. **Delegate Early**
```
❌ Try yourself first, load skill if stuck
✅ Recognize domain, delegate immediately
```

### 2. **Trust the Skill Context**
```
❌ Skill guidance leads → You rewrite blindly → Lose constraints
✅ Skill guidance leads → You review → Preserve expertise
```

### 3. **Scope Skills Narrowly**
```
❌ "world-and-combat-and-inventory-engineer"
✅ "world-engineer", "combat-engineer", "inventory-engineer"
```

### 4. **Update Skills with Learnings**
```
When you discover a new constraint or pattern:
→ Update the relevant skill's hard constraints
→ Prevents future violations
```

### 5. **Use Verification Commands**
```
Before PR:
-> Route via `.codex/CODEX_MAP.md`
-> Use `test-runner` for command choice
-> Run focused checks such as `npm run verify`, `npm run verify:skills`, or the relevant domain verifier
```

### 6. **Delegate Through The Git Boundary**

Do not stop delegation at implementation. Implementation skills decide how code should change, `test-runner` decides how it should be checked, and `git-push-steward` decides whether it is safe to commit and push.

```text
Bad:
Codex implements feature → git add . → git commit → git push

Good:
Codex implements feature under domain skill
  → verifies through test-runner
  → stages scoped files
  → commits with evidence
  → push gate through git-push-steward
  → pushes feature branch
```

## Future Skill Opportunities

Based on Akalynth's architecture, consider creating:

### Protocol Engineer
- WebSocket message validation
- Client/server contract enforcement
- Protocol documentation sync

### Anticheat Engineer
- Detection pattern implementation
- Heat scoring logic
- Tem challenge design

### World Engineer
- Map data validation
- Movement logic
- Spawn point management

### Persistence Engineer
- Receipt-driven materialization
- SQLite projection validation
- Query optimization

### Audit Engineer
- JSONL format validation
- Public receipt redaction
- Evidence chain integrity

## Measuring Success

A good Codex skill:

1. **Catches violations** before code review
2. **Teaches patterns** to developers
3. **Maintains consistency** across features
4. **Reduces bugs** from architectural misunderstandings
5. **Speeds up** experienced developers (less decision fatigue)

A good delegated engineering loop:

- prevents unrelated changes from entering commits
- makes every pushed branch reconstructable
- records which skills governed the work
- records which verification commands were run
- names skipped or failed checks honestly
- keeps Git history aligned with architecture boundaries
- lets another operator replay the reasoning from map → skill → diff → test → commit

## Anti-Patterns to Avoid

### 1. Over-Delegation
```
❌ Create a skill for every tiny feature
✅ Create skills for architectural domains
```

### 2. Under-Specified Skills
```
❌ "You are the engineer. Do engineering."
✅ "You enforce receipts-first. Reject non-deterministic RNG."
```

### 3. Overlapping Skills
```
❌ Two skills both handle movement logic
✅ Clear boundaries: world-engineer = logic, protocol-engineer = messages
```

### 4. Ignoring Skill Refusals
```
❌ Skill refuses → Ask unguided Codex instead
✅ Skill refuses → Understand why → Fix approach
```

## Conclusion

Codex delegation is Akalynth's **force multiplier** for maintaining architectural integrity at scale. By encoding domain expertise into Codex skills, the project ensures that:

- Complex constraints are enforced automatically
- New contributors learn patterns through guided implementation
- Code reviews focus on business logic, not architectural correctness
- Tribal knowledge is preserved and accessible

As the project grows, Codex skills become increasingly valuable—they're living documentation that **actively participates** in development rather than passively sitting in `/docs`.

## Further Reading

- `.codex/CODEX_MAP.md` — Codex routing, local authority, skill stores
- `docs/ARCHITECTURE.md` — System architecture
- `docs/PROTOCOL.md` — WebSocket protocol
- `docs/ANTICHEAT.md` — Anti-cheat system
- `.claude/skills/delegation-steward/SKILL.md` — How requests become delegated tasks
- `.claude/skills/anti-cheat-steward/SKILL.md` — Example domain skill
- `.claude/skills/` — Authored Akalynth domain skill source

---

## Maintainer note

This guide is now Codex-facing. `.codex/CODEX_MAP.md` is the operational routing map; `.claude/skills/` remains the authored source for Akalynth domain skills; Codex consumes those skills through the configured user and plugin surfaces.

Keep this guide as the human-readable overview. Put detailed domain rules in the per-skill `SKILL.md` files and keep `.codex/CODEX_MAP.md` aligned with the actual routing surface.
