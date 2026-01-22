## Description

<!-- Describe your changes in detail -->

## Type of Change

- [ ] Bug fix (non-breaking change which fixes an issue)
- [ ] New feature (non-breaking change which adds functionality)
- [ ] Breaking change (fix or feature that would cause existing functionality to not work as expected)
- [ ] Documentation update
- [ ] Infrastructure/tooling change

## Verification

**Required before merge:**

- [ ] `npm run verify` passes locally
- [ ] CI verification spine check passes (will run automatically)

**Optional (but recommended):**

- [ ] `npm run verify:quick` passes (phases 0-1 only)
- [ ] Reviewed verification report in CI artifacts

## High-Leverage Checklist (for significant changes)

If this PR adds new features or changes architecture, score using [HIGH_LEVERAGE_DECISION_CHECKLIST.md](../docs/HIGH_LEVERAGE_DECISION_CHECKLIST.md):

- [ ] **Multiplier:** Does this unlock future capabilities? (0-3 points)
- [ ] **Force Multiplier:** Does this eliminate classes of work/failure? (0-3 points)
- [ ] **Strategic Irreversibility:** Does this lock in a guarantee? (0-3 points)

**Total score:** ___/9

- **7-9 points (Critical):** Ship immediately
- **4-6 points (High):** Prioritize
- **2-3 points (Medium):** Batch or delegate
- **0-1 points (Low):** Question necessity

## Additional Context

<!-- Any other context, screenshots, or relevant information -->

## Related Issues

<!-- Link to related issues/PRs -->

Closes #

---

**Note:** The Verification Spine is **constitutionally mandatory** (see `docs/VERIFICATION_SPINE_API.md`).
PRs that fail verification will be blocked from merging.
