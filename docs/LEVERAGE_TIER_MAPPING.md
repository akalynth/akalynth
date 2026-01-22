# Leverage Tier Mapping — Akalynth Current State

**Status:** Active Audit
**Effective:** 2026-01-22
**Purpose:** Apply HIGH_LEVERAGE_DECISION_CHECKLIST to current/planned work

**Decision Engine:** [HIGH_LEVERAGE_DECISION_CHECKLIST.md](HIGH_LEVERAGE_DECISION_CHECKLIST.md)

---

## Summary

This document applies the **High-Leverage Decision Checklist** scoring system to:
1. Work already shipped (validate past decisions)
2. Work currently missing (identify gaps)
3. Planned future work (prioritize roadmap)

**Scoring Reminder:**
- 7-9 points = **Critical** (changes the game)
- 4-6 points = **High** (strong leverage)
- 2-3 points = **Medium** (useful locally)
- 0-1 points = **Low** (defer/question)

---

## Part 1: Already Shipped (Validation)

These are high-leverage tasks **already in production**. This validates past architectural decisions.

### Critical Tier (7-9 points) ✅

| Task | Score | Multiplier | Force | Irreversible | Status |
|------|-------|------------|-------|--------------|--------|
| **Receipt Chain (JSONL audit)** | 9 | +3 (unlocks all audits) | +3 (eliminates "what happened?" questions) | +3 (makes retroactive edits detectable) | ✅ Shipped |
| **Chronicle Signing** | 9 | +3 (enables all cryptographic proofs) | +3 (eliminates forgery class) | +3 (makes unsigned receipts impossible in prod) | ✅ Shipped |
| **SPINE_V1 Directory Lock** | 8 | +2 (enables monorepo tooling) | +3 (eliminates monolith regression) | +3 (CI-enforced structure) | ✅ Shipped |
| **Civil Guarantees (G1-G15)** | 8 | +2 (creates constitutional API) | +3 (eliminates arbitrary enforcement) | +3 (locks in player rights) | ✅ Shipped |
| **Protected Slots Policy** | 7 | +2 (enables deterministic drops) | +2 (reduces "why did I lose this?" support) | +3 (makes item loss predictable) | ✅ Shipped |

**Insight:** All critical shipped work scores 7-9. Past decisions were sound.

---

### High Tier (4-6 points) ✅

| Task | Score | Multiplier | Force | Irreversible | Status |
|------|-------|------------|-------|--------------|--------|
| **verify_mvp.sh Harness** | 6 | +3 (enables all scenario testing) | +3 (eliminates manual test runs) | +0 (can be replaced) | ✅ Shipped |
| **18 Verification Tools** | 5 | +2 (enables domain-specific checks) | +2 (reduces manual audits) | +1 (establishes verification culture) | ✅ Shipped |
| **Tem Anti-Cheat System** | 5 | +2 (enables all bot detection) | +2 (reduces human review burden) | +1 (makes challenges enforceable) | ✅ Shipped |
| **Witness Ledger (TTL-based)** | 5 | +2 (enables social proof) | +2 (reduces admin judgment calls) | +1 (establishes witness pattern) | ✅ Shipped |
| **Public Receipts Feed** | 4 | +2 (enables transparency) | +1 (reduces "what's happening?" questions) | +1 (establishes privacy redaction) | ✅ Shipped |

**Insight:** High-tier work enabled future capabilities without locking in irreversible constraints.

---

## Part 2: Missing Critical Work (Gaps)

These are **high-leverage tasks not yet built** but score Critical (7-9). These are the **priority targets**.

### Critical Tier (7-9 points) 🎯

| Task | Score | Multiplier | Force | Irreversible | Priority | Why Missing |
|------|-------|------------|-------|--------------|----------|-------------|
| **Unified Verification Spine API** | 9 | +3 (unifies 18 scattered tools) | +3 (eliminates "which verifier?" questions) | +3 (makes verification first-class) | **P0** | No central orchestrator |
| **Receipt Chain CLI (one-command verify)** | 8 | +3 (enables all external audits) | +3 (eliminates manual chain inspection) | +2 (establishes verification UX) | **P0** | No standalone tool |
| **Protocol Breaking-Change Detector** | 8 | +2 (prevents all future API breakages) | +3 (eliminates manual review) | +3 (makes drift detectable) | **P0** | Only has warning hook |
| **Capability Boundary Enforcement** | 7 | +2 (enables agent isolation) | +2 (reduces privilege escalation risk) | +3 (makes violations mechanical) | **P1** | CAPS_ENABLED exists but not enforced universally |
| **Deterministic Test Fixture Generator** | 7 | +3 (enables all fixture-based tests) | +2 (eliminates flaky timestamp issues) | +2 (establishes fixture culture) | **P1** | Manual fixture creation |

**Recommendation:** Ship P0 tasks **before any new game features**.

---

### High Tier (4-6 points) 🔨

| Task | Score | Multiplier | Force | Irreversible | Priority | Why Useful |
|------|-------|------------|-------|--------------|----------|------------|
| **Chronicle Evidence API** | 6 | +3 (enables all "why this?" features) | +2 (reduces support burden) | +1 (establishes evidence pattern) | **P2** | Player-facing forensics |
| **Golden Test Vectors (Protocol)** | 6 | +2 (enables regression tests) | +2 (reduces manual testing) | +2 (locks protocol behavior) | **P2** | Protocol evolution safety |
| **Central Observability Spine** | 6 | +3 (enables all debugging) | +2 (reduces log archaeology) | +1 (establishes trace → receipt link) | **P2** | Debugging is ad-hoc |
| **Agent Delegation Contracts** | 5 | +2 (enables safe custom agents) | +2 (reduces architectural violations) | +1 (establishes delegation pattern) | **P3** | Custom agents exist but informal |
| **Proof Bundle Export CLI** | 5 | +2 (enables sharing/storage) | +2 (reduces "how do I save this?" questions) | +1 (establishes export pattern) | **P3** | Format exists, no CLI |

**Recommendation:** Batch P2 tasks together. P3 can wait until user demand.

---

## Part 3: Planned Future Work (Roadmap)

These are **documented but not yet started** features. Scored to determine priority.

### From V1_SCOPE.md (Out of Scope)

| Task | Score | Tier | Should Prioritize? |
|------|-------|------|---------------------|
| Moderation System (Phase 7) | 3 | Medium | No — wait for abuse patterns |
| Witness UI (Phase 6) | 4 | High | Maybe — if witness adoption low |
| Mail MMO System | 2 | Medium | No — speculative feature |
| Appeals Workflow | 3 | Medium | No — moderation prerequisite |

### From MONETIZATION_BLUEPRINT.md (Future Features)

| Task | Score | Tier | Should Prioritize? |
|------|-------|------|---------------------|
| Personal Chronicle Entries (purchasable) | 2 | Medium | No — cosmetic, not infrastructure |
| Legend Engraving System | 1 | Low | No — hypothetical vanity |
| Death Echo Memorials | 1 | Low | No — cosmetic death feature |
| Cosmetic Skins/Titles | 0 | Low | No — pure cosmetic |

**Insight:** Most future features are **Medium/Low leverage**. Don't prioritize over Critical gaps.

---

## Part 4: Ad-Hoc Work (Risk Areas)

Tasks that **might seem urgent but score low**. These are traps.

### Low-Leverage Traps (0-1 points) ⚠️

| Task | Score | Why Low Leverage | Decision |
|------|-------|------------------|----------|
| Optimize render loop for 144Hz | 0 | Not a bottleneck, no multiplier | **Defer** until measured |
| Add config flag for X | 0 | Adds complexity without guarantees | **Question necessity** |
| Refactor Y for cleanliness | 1 | Local improvement, no force multiplier | **Batch** with other refactors |
| Document feature Z | 1 | Useful but doesn't remove work | **Write only if blocking users** |
| Premature performance optimization | 0 | Hypothetical, no measured need | **Refuse** until profiled |

**Rule:** If it scores 0-1, ask **"Is this actually necessary?"** before starting.

---

## Part 5: Concrete Next Steps (This Branch)

Based on this audit, here are the **immediate high-leverage tasks** for `claude/high-leverage-tasks-6Kz2Z`:

### Phase 1: Document the Decision Engine ✅
- [x] Create HIGH_LEVERAGE_DECISION_CHECKLIST.md ✅
- [x] Create LEVERAGE_TIER_MAPPING.md (this file) ✅
- [ ] Create VERIFICATION_SPINE_API.md (next)

### Phase 2: Build Critical Infrastructure 🎯

**Priority 0 (Critical, Missing)**

1. **Unified Verification Spine API** (Score: 9)
   - Unify 18 scattered `verify-*.ts` tools
   - Single entry point: `npm run verify` or `akalynth-verify`
   - Output: pass/fail + actionable errors
   - Files: `packages/verification-spine/` (new package)
   - **ETA:** 1 design doc + 1 implementation session

2. **Receipt Chain CLI** (Score: 8)
   - One-command verification: `akalynth-verify-chain receipts.jsonl`
   - Outputs: chain integrity, signature validity, replay determinism
   - Files: `packages/verification-spine/cli/verify-chain.ts`
   - **ETA:** 1 implementation session

3. **Protocol Breaking-Change Detector** (Score: 8)
   - Automated schema diff detection
   - Fails CI if protocol.ts changes without PROTOCOL.md update
   - Extends existing `scripts/verify_protocol_sync.sh`
   - Files: `scripts/detect-protocol-breaking-changes.sh`
   - **ETA:** 1 implementation session

**Priority 1 (Critical, Partial)**

4. **Capability Boundary Enforcement** (Score: 7)
   - Universal capability checks (not just debug grants)
   - Fail-closed enforcement (can't bypass capabilities)
   - Files: `apps/server/src/world/capabilities.ts` (enhance existing)
   - **ETA:** 1 refactoring session

5. **Deterministic Test Fixture Generator** (Score: 7)
   - Automated fixture creation with fixed timestamps
   - Replaces manual fixture writes
   - Files: `apps/server/tools/generate-fixtures.ts`
   - **ETA:** 1 implementation session

---

## Part 6: Anti-Pattern Detection

Use the checklist to **block low-leverage work** before it starts.

### Recent Examples (Hypothetical)

| Proposed Task | Score | Decision | Reason |
|---------------|-------|----------|--------|
| "Add dark mode toggle" | 0 | **Defer** | Cosmetic, no architectural impact |
| "Optimize SQL query X" | 1 | **Measure first** | Not proven bottleneck |
| "Refactor movement.ts" | 2 | **Batch later** | Local cleanup, no multiplier |
| "Document runestone flow" | 1 | **Only if blocking** | Doesn't remove work |

**Process:**
1. New task proposed
2. Run through checklist (score 0-9)
3. If < 4 points → question necessity
4. If < 2 points → defer/refuse

---

## Part 7: Metrics (How to Measure Success)

High-leverage work should change these metrics:

### Before Verification Spine
- 18 scattered verify tools
- No central orchestrator
- Manual "which verifier?" decisions
- Verification culture exists but fragmented

### After Verification Spine
- 1 unified entry point
- All verifiers callable via API
- Zero "which verifier?" questions
- Verification is first-class (can't ship without it)

**Success Metric:** New features automatically include verification (force multiplier achieved).

---

## Part 8: Governance (Preventing Leverage Drift)

### Enforcement Mechanism

Add to CI pipeline (`.github/workflows/leverage-audit.yml`):

```yaml
- name: High-Leverage Audit
  run: |
    # Check that new features include verification
    # Check that protocol changes include schema validation
    # Check that no low-leverage work sneaks in
```

### Code Review Questions

Before merging any PR, ask:

1. **Multiplier:** Does this unlock future capabilities?
2. **Force Multiplier:** Does this eliminate classes of work/failure?
3. **Strategic Irreversibility:** Does this lock in a guarantee?

If answers are all "no" → **question the PR's necessity**.

---

## Changelog

| Version | Date | Changes |
|---------|------|---------|
| v1 | 2026-01-22 | Initial leverage tier audit |

---

## See Also

- [HIGH_LEVERAGE_DECISION_CHECKLIST.md](HIGH_LEVERAGE_DECISION_CHECKLIST.md) - Decision engine
- [VERIFICATION_SPINE_API.md](VERIFICATION_SPINE_API.md) - Unified verification design (next)
- [SPINE_V1.md](SPINE_V1.md) - Directory structure lock
- [V1_SCOPE.md](V1_SCOPE.md) - Current scope boundaries
