# High-Leverage Task Decision Checklist

**Status:** Active Decision Engine
**Effective:** 2026-01-22
**Purpose:** Filter tasks by impact, enforce strategic discipline

## The Litmus Test

Before starting any task, run this single-question filter:

> **What would break if I removed this in six months?**

- If the answer is "nothing" → **Low leverage**
- If the answer is "one feature" → **Medium leverage**
- If the answer is "the entire verification/trust model" → **High leverage**

---

## The Three Properties

A **high-leverage task** has **at least two** of these properties. The best tasks have **all three**.

### 1. Multiplier (1 → Many)

**Does this task unlock multiple future capabilities?**

✅ **High Leverage Examples:**
- Receipt chain verification CLI (enables all audits)
- Protocol schema validator (prevents all breaking changes)
- Capability boundary enforcement (secures all future agents)
- Central observability spine (debugs all future bugs)

❌ **Low Leverage Examples:**
- One-off bug fix (only fixes one symptom)
- Feature-specific optimization (only speeds one path)
- Cosmetic UI tweak (no architectural impact)

**Scoring:**
- Creates 5+ future affordances → **+3 points**
- Creates 2-4 future affordances → **+2 points**
- Creates 1 future affordance → **+1 point**
- Creates 0 future affordances → **0 points**

---

### 2. Force Multiplier (Removes Classes of Work)

**Does this task eliminate entire categories of failure or manual toil?**

✅ **High Leverage Examples:**
- Fail-closed verification (can't proceed if invalid = no silent corruption)
- Automated protocol drift detection (no manual review needed)
- Receipt-driven state reconstruction (no hand-written migration scripts)
- Deterministic test harness (no flaky test debugging)

❌ **Low Leverage Examples:**
- Manual test case (still requires human execution)
- Documentation improvement (still requires reading)
- Code comment (still requires interpretation)

**Scoring:**
- Eliminates entire class of failures → **+3 points**
- Eliminates repeated manual work → **+2 points**
- Reduces manual work frequency → **+1 point**
- No elimination effect → **0 points**

---

### 3. Strategic Irreversibility (Locks in Guarantees)

**Does this task make bad states harder or impossible to reach?**

✅ **High Leverage Examples:**
- Chronicle signing (makes retroactive edits detectable)
- Protected slot guarantees (makes item loss predictable)
- SPINE_V1 directory lock (prevents monorepo regression)
- Civil Guarantees enforcement (makes governance violations mechanical)

❌ **Low Leverage Examples:**
- Optional validation (can be bypassed)
- Warning message (can be ignored)
- Convention documentation (can be violated)

**Scoring:**
- Makes violations impossible (mechanical) → **+3 points**
- Makes violations detectable (audit) → **+2 points**
- Makes violations harder (friction) → **+1 point**
- No guarantee change → **0 points**

---

## Scoring System

**Total Score = Property 1 + Property 2 + Property 3**

| Score | Tier | Action |
|-------|------|--------|
| 7-9   | **Critical** | Do immediately. This changes the game. |
| 4-6   | **High** | Prioritize. Strong leverage. |
| 2-3   | **Medium** | Useful but not transformative. |
| 0-1   | **Low** | Defer or delegate. Local optimization. |

---

## Decision Matrix

### Critical (7-9 points) - Ship First

These tasks have **strategic irreversibility**:
- They change the rules, not just the score
- Removing them later would break core assumptions
- They create new invariants

**Examples from Akalynth:**
- Receipt chain integrity tooling
- Protocol breaking-change detector
- Capability boundary enforcement
- Verification spine unification

**Decision:** Ship these before features. They're infrastructure.

---

### High (4-6 points) - Prioritize

These tasks have **multiplier + force multiplier**:
- They unlock multiple capabilities
- They remove classes of work
- But they're not constitutionally binding

**Examples from Akalynth:**
- Golden test vectors for protocol evolution
- Minimal observability spine (logs → receipts → traces)
- Agent delegation contracts
- Chronicle evidence API

**Decision:** Schedule these before new game mechanics.

---

### Medium (2-3 points) - Batch or Delegate

These tasks have **one strong property**:
- Useful locally
- Don't change the slope
- Can be done anytime

**Examples from Akalynth:**
- Performance optimization (non-bottleneck)
- Additional test coverage (no new guarantees)
- Documentation improvements
- Code cleanup/refactoring

**Decision:** Batch these together or delegate. Don't interrupt critical work.

---

### Low (0-1 points) - Defer or Question

These tasks are **local optimizations**:
- No architectural impact
- Don't unlock future work
- Don't remove failure classes

**Examples from Akalynth:**
- Cosmetic UI changes
- One-off bug fixes (no pattern)
- Premature abstraction
- Hypothetical future-proofing

**Decision:** Ask "Is this actually necessary?" If yes, defer until batch window.

---

## Application Workflow

### Before Starting Any Task

1. **Name the task** (one sentence)
2. **Score each property** (0-3 points per property)
3. **Calculate total** (0-9 points)
4. **Check tier** (Critical / High / Medium / Low)
5. **Apply decision** (Ship / Prioritize / Batch / Defer)

### Example: "Add receipt chain verification CLI"

**Property 1 (Multiplier):** +3
*Unlocks all future audits, disputes, compliance checks*

**Property 2 (Force Multiplier):** +3
*Eliminates entire class of "how do I verify this?" questions*

**Property 3 (Strategic Irreversibility):** +3
*Makes silent chain corruption impossible (fail-closed)*

**Total:** 9 points → **Critical**
**Decision:** Ship immediately. This is infrastructure.

---

### Example: "Optimize render loop for 144Hz displays"

**Property 1 (Multiplier):** +0
*Only affects one client feature (rendering)*

**Property 2 (Force Multiplier):** +0
*Doesn't eliminate work or failures*

**Property 3 (Strategic Irreversibility):** +0
*No guarantee impact*

**Total:** 0 points → **Low**
**Decision:** Defer. Not a bottleneck yet.

---

## Anti-Patterns to Avoid

### 1. Optimizing Non-Bottlenecks
"Let's make this 10x faster!" → Is it slow? Is it a problem? Measure first.

### 2. Hypothetical Future-Proofing
"We might need this later!" → YAGNI. Build when needed, not when imagined.

### 3. Adding Surface Area Without Invariants
"Let's add a config flag!" → Does it make anything safer? Or just more complex?

### 4. Premature Abstraction
"Let's create a helper for these three uses!" → Wait for the fourth. Then abstract.

### 5. Improving Without Measuring
"This feels better!" → Does it change outcomes? Does it remove failure modes?

---

## Integration with Akalynth

### Existing High-Leverage Work (Already Shipped)

| Task | Tier | Why |
|------|------|-----|
| Receipt chain (JSONL audit) | Critical | Multiplier + Force + Irreversible |
| SPINE_V1 directory lock | Critical | Force + Irreversible |
| Civil Guarantees (G1-G15) | Critical | Irreversible |
| Chronicle signing | Critical | Irreversible |
| Protected slots | High | Force + Irreversible |
| verify_mvp.sh harness | High | Multiplier + Force |

### Remaining High-Leverage Work

| Task | Tier | Why |
|------|------|-----|
| Unified Verification Spine API | Critical | Implemented; continue enforcing verifier registration |
| Protocol breaking-change detector | Critical | Force + Irreversible |
| Receipt chain CLI (one-command verify) | Critical | Multiplier + Force |
| Capability boundary enforcement | High | Force + Irreversible |
| Chronicle evidence forensics | High | Multiplier + Force |

### Leverage Tier Mapping (Next Step)

See: `docs/LEVERAGE_TIER_MAPPING.md`.

---

## When in Doubt

Run the litmus test:

> **What would future-me refuse to remove because everything depends on it?**

If the answer is "nothing depends on it," it's not high leverage.

---

## Changelog

| Version | Date | Changes |
|---------|------|---------|
| v1 | 2026-01-22 | Initial decision engine (from high-leverage synthesis) |

---

## See Also

- [SPINE_V1.md](SPINE_V1.md) - Directory structure discipline
- [GOVERNANCE_INVARIANTS.md](GOVERNANCE_INVARIANTS.md) - Constitutional law
- [PROOF_BUNDLES.md](PROOF_BUNDLES.md) - Portable truth
- [LEVERAGE_TIER_MAPPING.md](LEVERAGE_TIER_MAPPING.md) - Current task audit
