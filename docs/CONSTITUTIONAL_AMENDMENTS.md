# Constitutional Amendment Process

This document establishes the formal process for modifying constitutional files after v1.0.0-world-law.

## Purpose

Akalynth's constitutional files define the immutable guarantees that protect players and ensure fair gameplay. These files are anchored at version tags and changes require deliberate, documented amendments.

## Amendment Requirements

After v1.0.0-world-law, changes to protected constitutional files require:

1. **Proposal PR** with title `[AMENDMENT] <description>`
2. **Justification** in PR body explaining why the change is needed
3. **Impact assessment** describing which guarantees are affected
4. **Verifier updates** if behavior changes (all verifiers must pass)
5. **Version bump** to next `-world-law` tag upon merge

## Protected Constitutional Files

The following files are constitutionally protected:

### Core Guarantees
- `docs/MONETIZATION_CONSTITUTION.md` — Monetization principles
- `packages/shared/protocol.ts` — Wire protocol contract
- `packages/shared/types.ts` — Domain type definitions

### Receipt Infrastructure
- `apps/server/src/audit/logger.ts` — Receipt emission
- `apps/server/src/audit/public_receipts.ts` — Public receipt filtering
- `packages/coordination-kernel/src/receipt/` — Chain integrity

### Verification Gates
- `apps/server/tools/verify-lifecycle.ts` — Boot/shutdown ordering
- `apps/server/tools/verify-monetization.ts` — Monetization policy
- `apps/server/tools/verify-treasury.ts` — Gold consistency
- `apps/server/tools/verify-work-contracts.ts` — Work contract rules

## Amendment Workflow

### 1. Create Amendment PR

```bash
git checkout -b amendment/describe-change
# Make changes to constitutional files
git commit -m "[AMENDMENT] Describe what changed and why"
git push origin amendment/describe-change
```

### 2. PR Body Template

```markdown
## Amendment: [Title]

### Justification
[Why is this change necessary?]

### Affected Guarantees
- [ ] Monetization principles
- [ ] Receipt chain integrity
- [ ] Protocol stability
- [ ] Verification gates

### Impact Assessment
[What existing behavior changes?]

### Backward Compatibility
[How are existing chains/data handled?]

### Verification
- [ ] All verifiers pass
- [ ] New verifier added (if applicable)
- [ ] Documentation updated
```

### 3. Review Requirements

- At least one reviewer must acknowledge the constitutional impact
- CI must pass all verification gates
- No `|| true` escapes in CI for constitutional verifiers

### 4. Merge and Tag

After approval:
```bash
# Bump version in package.json files
# Merge PR
git tag -a v1.X.0-world-law -m "Amendment: [description]"
git push origin v1.X.0-world-law
```

## Amendment History

| Version | Date | Amendment |
|---------|------|-----------|
| v1.0.0-world-law | 2026-01-20 | Initial constitutional anchor |

## Non-Constitutional Changes

Changes that do NOT require the amendment process:

- Bug fixes that don't alter guarantees
- Performance optimizations
- New features that extend (not modify) existing behavior
- Documentation clarifications
- Tooling improvements

When in doubt, ask: "Does this change what players can rely on?"

## Verification Commands

Before any constitutional change, run:

```bash
cd apps/server
npm run verify:lifecycle      # Boot/shutdown ordering
npm run verify:monetization   # Monetization policy
npm run verify:work-contracts # Work contract rules
npm run verify:treasury       # Gold consistency
npm run verify:ops            # Operational/deployment readiness
```

The full suite is the root spine (`npm run verify`), which runs all verifiers; the
server-scoped `verify:*` scripts above (run from `apps/server`) each check one domain.

All must pass without modification to pass CI.
