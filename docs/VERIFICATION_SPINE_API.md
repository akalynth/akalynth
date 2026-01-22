# Verification Spine API v1

**Status:** Design (Implementation Pending)
**Effective:** 2026-01-22
**Leverage Score:** 9 (Critical)
**Purpose:** Unify 18 scattered verification tools into a single, fail-closed spine

---

## The Problem

**Today:** 18 verification tools scattered across `apps/server/tools/verify-*.ts`:
- `verify-guarantees.ts`
- `verify-chronicle-chain.ts`
- `verify-treasury.ts`
- `verify-heat.ts`
- ...14 more

**Pain Points:**
1. **Fragmentation:** No central orchestrator
2. **Discovery:** Developers don't know which verifier to run
3. **Integration:** CI runs some but not all verifiers
4. **Ownership:** Unclear which team owns each verifier
5. **Reporting:** Each tool has different output format

**Result:** Verification exists but is not **first-class**. Easy to skip or ignore.

---

## The Solution: Verification Spine

A **unified verification system** that:

1. **Centralizes** all verification logic
2. **Standardizes** output format (pass/fail/skip)
3. **Orchestrates** all checks in dependency order
4. **Fails closed** (can't ship if verification fails)
5. **Provides one entry point** (`npm run verify`)

**Analogy:** The spine is your **test runner**, but for architectural invariants instead of unit tests.

---

## Spine Invariants (Non-Negotiable)

These constraints are **constitutionally binding**. They cannot be bypassed, ignored, or "temporarily disabled."

### ❌ Forbidden (Violations Fail CI)

1. **No deploy path bypasses `npm run verify`**
   - Every release artifact must pass spine verification
   - No "emergency deploy" exception
   - No "we'll verify later" exemption

2. **No CI green state without spine success**
   - CI must run `npm run verify` and fail if exit code ≠ 0
   - No merge without spine pass
   - No "verify" marked as optional check

3. **No release artifact without verification metadata**
   - Every release includes `verification-report.json`
   - Report must show all verifiers passed
   - Report includes timestamp, commit hash, verifier versions

4. **No manual verification bypass**
   - Developers cannot skip spine locally (may use `--skip-build` for speed, but must run spine)
   - CI cannot be configured to skip spine
   - No `SKIP_VERIFICATION=1` env var or equivalent

### ✅ Required (Must Be True)

1. **All future verifiers must register with the spine**
   - New `verify-*.ts` tools are forbidden (use spine plugins)
   - Existing tools must be wrapped by spine adapters
   - Unregistered verifiers are invisible to CI (and thus ineffective)

2. **Order is deterministic and dependency-aware**
   - Verifiers run in phase order (0 → 3)
   - Dependencies declared explicitly in verifier metadata
   - Same inputs always produce same execution order

3. **Failure is loud, blocking, and unskippable**
   - Exit code 1 on any verifier failure (fail-fast by default)
   - Exit code 2 on infrastructure error (missing files, etc.)
   - Exit code 0 only if all verifiers pass
   - No silent failures, no warnings-as-errors toggle

4. **Verification is observable and reproducible**
   - Every spine run produces JSON report
   - Report includes all verifier results, durations, error details
   - Given same inputs (code + env), spine produces identical results

### 🔒 Enforcement Mechanism

These invariants are enforced by:

1. **CI Pipeline** (`.github/workflows/ci.yml`)
   ```yaml
   - name: Verification Spine (Mandatory)
     run: npm run verify -- --json > verification-report.json
     # This step MUST NOT have `continue-on-error: true`
   ```

2. **Git Hooks** (optional but recommended)
   ```bash
   # .git/hooks/pre-push
   npm run verify || exit 1
   ```

3. **Release Process** (documented in V1_SCOPE.md)
   - No tag creation without spine pass
   - Release notes include verification report

4. **Code Review Checklist**
   - Every PR description must confirm: "Verification spine passes locally"
   - Reviewers must verify CI spine check passed
   - New features must include verifier (if adding new guarantees)

### 📜 Rationale

**Why so strict?**

Akalynth's trust model depends on **mechanical enforcement** of guarantees. If verification can be bypassed:
- Civil Guarantees (G1-G15) become suggestions
- Receipt chain integrity becomes optional
- Chronicle signing becomes theater

The spine is not "helpful tooling" — it is **civilizational law enforcement**.

If these constraints feel too strict, that's the point. High-leverage infrastructure should be **hard to remove**.

---

## Design Principles

### 1. Fail-Closed
If verification can't run (missing files, infra error), **fail hard**.
Default to safety, not convenience.

### 2. Dependency-Aware
Some verifiers depend on others (e.g., `verify-guarantees` needs DB).
Run in correct order, skip dependents if prerequisites fail.

### 3. Actionable Output
Every failure tells you **exactly what to fix**.
No vague errors like "validation failed."

### 4. Machine-Readable
Output as JSON for CI integration.
Human-readable text for local dev.

### 5. Extensible
New verifiers can be added without changing core orchestrator.
Plugin architecture, not monolith.

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                    Verification Spine CLI                       │
│                  (npm run verify / akalynth-verify)             │
└───────────────────────────┬─────────────────────────────────────┘
                            │
        ┌───────────────────┼───────────────────┐
        │                   │                   │
        ▼                   ▼                   ▼
┌───────────────┐   ┌───────────────┐   ┌───────────────┐
│   Verifier    │   │   Verifier    │   │   Verifier    │
│   Registry    │   │  Orchestrator │   │   Reporter    │
└───────────────┘   └───────────────┘   └───────────────┘
        │                   │                   │
        │                   ├─── Run Phase 0: Prerequisites
        │                   ├─── Run Phase 1: Core Guarantees
        │                   ├─── Run Phase 2: Domain Checks
        │                   ├─── Run Phase 3: Integration Tests
        │                   │
        └───────────────────┴───────────────────┘
                            │
                ┌───────────┴───────────┐
                ▼                       ▼
        ┌──────────────┐        ┌──────────────┐
        │  JSON Output │        │  Text Output │
        └──────────────┘        └──────────────┘
```

---

## Core Components

### 1. Verifier Interface

Every verifier implements this interface:

```typescript
interface Verifier {
  // Metadata
  id: string;                    // "guarantees", "chronicle-chain", etc.
  name: string;                  // "Civil Guarantees Gate"
  description: string;           // "Enforces G1-G15 mechanically"
  phase: VerificationPhase;      // 0-3 (dependency order)
  dependencies: string[];        // ["build", "db-exists"]

  // Execution
  run(opts: VerifierOptions): Promise<VerifierResult>;

  // Lifecycle
  canRun(): Promise<boolean>;    // Check prerequisites
  skip(reason: string): VerifierResult;
}

enum VerificationPhase {
  PREREQUISITES = 0,  // Build, file existence, schema checks
  CORE = 1,           // Civil Guarantees, protocol sync
  DOMAIN = 2,         // Treasury, heat, chronicle, etc.
  INTEGRATION = 3,    // Full MVP scenarios
}

interface VerifierOptions {
  verbose: boolean;
  skipBuild: boolean;
  dbPath?: string;
  receiptsPath?: string;
  // ... other env overrides
}

interface VerifierResult {
  verifier: string;
  status: 'pass' | 'fail' | 'skip';
  message: string;
  details?: Record<string, unknown>;
  exitCode: number;  // 0=pass, 1=fail, 2=skip/infra
  durationMs: number;
}
```

---

### 2. Verifier Registry

**Location:** `packages/verification-spine/src/registry.ts`

**Responsibilities:**
- Discovers all verifiers (static registration)
- Sorts by phase (0 → 3)
- Resolves dependencies

**Example:**

```typescript
const VERIFIERS: Verifier[] = [
  // Phase 0: Prerequisites
  {
    id: 'build',
    name: 'TypeScript Build',
    phase: VerificationPhase.PREREQUISITES,
    dependencies: [],
    run: async (opts) => {
      if (opts.skipBuild) return skip('build', '--skip-build flag set');
      // ... run tsc build
    },
  },

  // Phase 1: Core Guarantees
  {
    id: 'guarantees',
    name: 'Civil Guarantees (G1-G15)',
    phase: VerificationPhase.CORE,
    dependencies: ['build', 'db-exists'],
    run: async (opts) => {
      // ... existing verify-guarantees.ts logic
    },
  },

  // Phase 2: Domain Checks
  {
    id: 'treasury',
    name: 'Treasury Integrity',
    phase: VerificationPhase.DOMAIN,
    dependencies: ['build', 'receipts-exist'],
    run: async (opts) => {
      // ... existing verify-treasury.ts logic
    },
  },

  // ... register all 18 verifiers
];
```

---

### 3. Orchestrator

**Location:** `packages/verification-spine/src/orchestrator.ts`

**Responsibilities:**
- Runs verifiers in dependency order
- Stops on first failure (fail-fast mode)
- Collects results
- Generates report

**Algorithm:**

```typescript
async function runAllVerifiers(opts: VerifierOptions): Promise<VerificationReport> {
  const results: VerifierResult[] = [];
  const failed = new Set<string>();

  // Sort by phase, then by dependencies
  const sorted = topologicalSort(VERIFIERS);

  for (const verifier of sorted) {
    // Skip if dependencies failed
    const depsOk = verifier.dependencies.every(dep => !failed.has(dep));
    if (!depsOk) {
      results.push(verifier.skip('dependency failed'));
      continue;
    }

    // Check if can run
    const canRun = await verifier.canRun();
    if (!canRun) {
      results.push(verifier.skip('prerequisites not met'));
      continue;
    }

    // Run verifier
    const start = Date.now();
    const result = await verifier.run(opts);
    result.durationMs = Date.now() - start;
    results.push(result);

    // Track failures
    if (result.status === 'fail') {
      failed.add(verifier.id);
      if (opts.failFast) break;  // Stop immediately
    }
  }

  return { results, passed: failed.size === 0 };
}
```

---

### 4. Reporter

**Location:** `packages/verification-spine/src/reporter.ts`

**Responsibilities:**
- Formats results as JSON (machine-readable)
- Formats results as text (human-readable)
- Highlights failures with actionable next steps

**Text Output Example:**

```
╔══════════════════════════════════════════════════════════════╗
║           AKALYNTH VERIFICATION SPINE v1                     ║
╚══════════════════════════════════════════════════════════════╝

Phase 0: Prerequisites
  ✅ PASS  TypeScript Build                        (1.2s)
  ✅ PASS  Database Exists                         (0.1s)
  ✅ PASS  Receipts Chain Exists                   (0.1s)

Phase 1: Core Guarantees
  ✅ PASS  Civil Guarantees (G1-G15)               (2.3s)
  ✅ PASS  Protocol Sync (protocol.ts ↔ PROTOCOL.md) (0.5s)

Phase 2: Domain Checks
  ✅ PASS  Treasury Integrity                      (0.8s)
  ✅ PASS  Heat System                             (0.6s)
  ✅ PASS  Chronicle Chain                         (1.2s)
  ❌ FAIL  Protected Slots                         (0.4s)
      └─ Reason: Found 2 violations in receipts.jsonl
      └─ Details:
         - Line 1234: Item lost from protected slot
         - Line 5678: Protected slot override without receipt
      └─ Fix: Review PROTECTED_SLOT_POLICY in CIVIL_GUARANTEES.md

Phase 3: Integration Tests
  ⊘ SKIP  MVP Verification                        (0.0s)
      └─ Reason: Phase 2 failures block integration tests

════════════════════════════════════════════════════════════════
RESULT: ❌ FAILED (1/15 verifiers failed)
════════════════════════════════════════════════════════════════

Next steps:
  1. Fix protected slots violations (see details above)
  2. Re-run: npm run verify
  3. Once fixed, integration tests will run automatically
```

**JSON Output Example:**

```json
{
  "version": 1,
  "timestamp": "2026-01-22T10:30:00.000Z",
  "passed": false,
  "totalVerifiers": 15,
  "passed": 13,
  "failed": 1,
  "skipped": 1,
  "durationMs": 7200,
  "results": [
    {
      "verifier": "build",
      "name": "TypeScript Build",
      "status": "pass",
      "exitCode": 0,
      "durationMs": 1200
    },
    {
      "verifier": "protected",
      "name": "Protected Slots",
      "status": "fail",
      "exitCode": 1,
      "message": "Found 2 violations in receipts.jsonl",
      "details": {
        "violations": [
          { "line": 1234, "reason": "Item lost from protected slot" },
          { "line": 5678, "reason": "Protected slot override without receipt" }
        ]
      },
      "durationMs": 400
    }
  ]
}
```

---

## CLI Interface

### Primary Command

```bash
npm run verify
# or
akalynth-verify
```

**Runs all verifiers in dependency order. Exits 0 if all pass, 1 if any fail.**

---

### Flags

```bash
# Skip TypeScript build (faster for iterative runs)
npm run verify -- --skip-build

# Verbose output (show all logs from verifiers)
npm run verify -- --verbose

# Run specific verifier only
npm run verify -- --only guarantees

# Run up to specific phase
npm run verify -- --phase 2

# Continue on failure (don't stop at first fail)
npm run verify -- --no-fail-fast

# Output as JSON
npm run verify -- --json

# Dry run (show what would run, don't execute)
npm run verify -- --dry-run
```

---

### Examples

**Quick local check:**
```bash
npm run verify -- --skip-build --phase 1
# Runs only Phase 0 (prereqs) + Phase 1 (core guarantees)
# Skips build step for speed
```

**Full CI check:**
```bash
npm run verify -- --json > verification-report.json
# Runs all phases, outputs JSON for CI parsing
```

**Debug specific verifier:**
```bash
npm run verify -- --only chronicle-chain --verbose
# Runs only chronicle-chain verifier with full logs
```

---

## Integration with Existing Tools

### Migration Strategy

**Phase 1: Wrap Existing Tools**
- Keep existing `verify-*.ts` files as-is
- Create adapters in `packages/verification-spine/src/adapters/`
- Each adapter calls existing tool via `execSync()` and parses output

**Phase 2: Refactor to Library**
- Extract core logic from `verify-*.ts` into library functions
- Call library functions directly (no subprocess overhead)

**Phase 3: Delete Old Tools**
- Once all logic is in spine, delete `verify-*.ts` files
- Update npm scripts to use spine

**Timeline:**
- Phase 1: 1 session (this branch)
- Phase 2: 2-3 sessions (future PR)
- Phase 3: 1 session (cleanup PR)

---

### Backward Compatibility

**Existing npm scripts still work:**

```json
// package.json
{
  "scripts": {
    "verify": "akalynth-verify",
    "verify:verbose": "akalynth-verify --verbose",
    "verify:quick": "akalynth-verify --skip-build --phase 1",
    "verify:guarantees": "akalynth-verify --only guarantees",
    "verify:treasury": "akalynth-verify --only treasury",
    // ... existing scripts delegate to spine
  }
}
```

**CI still works:**

```yaml
# .github/workflows/ci.yml
- name: Run Verification Spine
  run: |
    cd apps/server
    npm run verify -- --json > ../../verification-report.json

- name: Upload Report
  uses: actions/upload-artifact@v3
  with:
    name: verification-report
    path: verification-report.json
```

---

## Verifier Catalog (18 Tools)

### Phase 0: Prerequisites (3 verifiers)

| ID | Name | What It Checks |
|----|------|----------------|
| `build` | TypeScript Build | No compilation errors |
| `db-exists` | Database Exists | SQLite DB file present |
| `receipts-exist` | Receipt Chain Exists | JSONL file present |

### Phase 1: Core Guarantees (4 verifiers)

| ID | Name | What It Checks |
|----|------|----------------|
| `guarantees` | Civil Guarantees (G1-G15) | All constitutional guarantees hold |
| `protocol` | Protocol Sync | protocol.ts ↔ PROTOCOL.md match |
| `doctrine` | Doctrine Consistency | No conflicting constitutional rules |
| `identity` | Identity System | Sovereign/caps/roles integrity |

### Phase 2: Domain Checks (9 verifiers)

| ID | Name | What It Checks |
|----|------|----------------|
| `treasury` | Treasury Integrity | Gold/item accounting consistent |
| `heat` | Heat System | Deterministic heat computation |
| `chronicle` | Chronicle Events | Event schema validation |
| `chronicle-chain` | Chronicle Chain | Hash chain integrity |
| `protected` | Protected Slots | Item drop policy enforcement |
| `evidence` | Evidence System | Forensic data completeness |
| `lifecycle` | Player Lifecycle | Session/death/respawn receipts |
| `monetization` | Monetization Rules | Pay-to-win violations |
| `work-contracts` | Work Contracts | Payout ordering |

### Phase 3: Integration Tests (2 verifiers)

| ID | Name | What It Checks |
|----|------|----------------|
| `mvp` | MVP Verification | Full scenario harness (verify_mvp.sh) |
| `ops` | Operational Readiness | Deployment prerequisites |

---

## Metrics & Success Criteria

### Before Spine

**Pain Points:**
- 18 scattered tools
- No central entry point
- Inconsistent output
- Unclear which verifiers to run
- Easy to skip verification

**Metrics:**
- Verification coverage: ~60% (some tools run in CI, some manual)
- Developer confusion: High ("which verifier checks X?")
- False positives: Medium (each tool has different error handling)

---

### After Spine

**Improvements:**
- 1 unified entry point (`npm run verify`)
- Standardized output (JSON + text)
- Dependency-aware execution
- Fail-closed (can't skip verification)

**Metrics:**
- Verification coverage: 100% (all tools run via spine)
- Developer confusion: Low ("just run `npm run verify`")
- False positives: Low (consistent error handling)

**Success Criteria:**
1. All 18 verifiers callable via spine
2. CI uses spine exclusively (no direct tool calls)
3. New features include verifiers automatically (force multiplier)
4. Zero "I didn't know to run verifier X" incidents

---

## Implementation Plan

### Step 1: Create Package (This Branch)

```bash
mkdir -p packages/verification-spine
cd packages/verification-spine
npm init -y
# ... set up TypeScript, dependencies
```

**Files:**
```
packages/verification-spine/
├── package.json
├── tsconfig.json
├── src/
│   ├── index.ts                  # Main entry point
│   ├── types.ts                  # Verifier interface
│   ├── registry.ts               # Verifier catalog
│   ├── orchestrator.ts           # Execution engine
│   ├── reporter.ts               # Output formatting
│   ├── cli.ts                    # CLI argument parsing
│   └── adapters/
│       ├── guarantees.ts         # Wraps verify-guarantees.ts
│       ├── chronicle-chain.ts    # Wraps verify-chronicle-chain.ts
│       └── ... (18 adapters)
├── bin/
│   └── akalynth-verify           # Executable script
└── README.md
```

---

### Step 2: Adapt Existing Tools (Incremental)

**For each of 18 tools:**

1. Create adapter in `src/adapters/`
2. Implement `Verifier` interface
3. Call existing tool via `execSync()` or extract logic
4. Register in `registry.ts`

**Example Adapter:**

```typescript
// packages/verification-spine/src/adapters/guarantees.ts
import { Verifier, VerifierResult, VerificationPhase } from '../types.js';
import { execSync } from 'node:child_process';

export const guaranteesVerifier: Verifier = {
  id: 'guarantees',
  name: 'Civil Guarantees (G1-G15)',
  description: 'Enforces constitutional guarantees mechanically',
  phase: VerificationPhase.CORE,
  dependencies: ['build', 'db-exists'],

  async canRun(): Promise<boolean> {
    // Check if DB exists (could delegate to db-exists verifier result)
    return true;
  },

  skip(reason: string): VerifierResult {
    return {
      verifier: 'guarantees',
      status: 'skip',
      message: reason,
      exitCode: 2,
      durationMs: 0,
    };
  },

  async run(opts): Promise<VerifierResult> {
    const args = ['npx', 'tsx', 'tools/verify-guarantees.ts'];
    if (opts.skipBuild) args.push('--skip-build');
    if (opts.verbose) args.push('--verbose');

    try {
      const output = execSync(args.join(' '), {
        cwd: opts.serverDir,
        encoding: 'utf-8',
        stdio: opts.verbose ? 'inherit' : 'pipe',
      });

      return {
        verifier: 'guarantees',
        status: 'pass',
        message: 'All guarantees preserved',
        exitCode: 0,
        durationMs: 0, // filled by orchestrator
      };
    } catch (err) {
      return {
        verifier: 'guarantees',
        status: 'fail',
        message: err.message,
        exitCode: 1,
        durationMs: 0,
      };
    }
  },
};
```

---

### Step 3: Wire Up CLI

```typescript
// packages/verification-spine/src/cli.ts
import { runAllVerifiers } from './orchestrator.js';
import { formatTextReport, formatJsonReport } from './reporter.js';

async function main() {
  const args = process.argv.slice(2);
  const opts = parseArgs(args);

  const report = await runAllVerifiers(opts);

  if (opts.json) {
    console.log(formatJsonReport(report));
  } else {
    console.log(formatTextReport(report));
  }

  process.exit(report.passed ? 0 : 1);
}

main();
```

---

### Step 4: Update CI (Next PR)

```yaml
# .github/workflows/ci.yml
- name: Run Verification Spine
  run: |
    npm install
    npm run verify -- --json > verification-report.json
```

---

### Step 5: Deprecate Old Tools (Future)

Once spine is stable:
1. Move `verify-*.ts` to `tools/legacy/`
2. Add deprecation warnings
3. Update docs to point to spine
4. Eventually delete legacy tools

---

## Extension Points

### Adding New Verifiers

**Example: Add "combat determinism" verifier**

```typescript
// packages/verification-spine/src/adapters/combat.ts
export const combatVerifier: Verifier = {
  id: 'combat',
  name: 'Combat Determinism',
  description: 'Verifies all combat outcomes are reproducible',
  phase: VerificationPhase.DOMAIN,
  dependencies: ['receipts-exist'],

  async run(opts): Promise<VerifierResult> {
    // ... custom logic
  },
};

// Register in registry.ts
import { combatVerifier } from './adapters/combat.js';
VERIFIERS.push(combatVerifier);
```

**That's it.** No changes to orchestrator, CLI, or CI.

---

## FAQ

### Q: Why not just run all verify-*.ts files directly?

**A:** Several reasons:
1. No dependency ordering (chronicle-chain needs receipts-exist first)
2. No standardized output (each tool formats differently)
3. No fail-fast (keep running even if early checks fail)
4. No discoverability (developers don't know what exists)

The spine fixes all of these.

---

### Q: Can I still run individual verifiers?

**A:** Yes, two ways:

1. Via spine: `npm run verify -- --only guarantees`
2. Directly: `npx tsx tools/verify-guarantees.ts` (legacy, works but discouraged)

---

### Q: What if a verifier is slow?

**A:** Use phases + `--skip-build`:

```bash
# Fast check (skip build + integration tests)
npm run verify -- --skip-build --phase 1
```

Or run specific verifier:
```bash
npm run verify -- --only guarantees --skip-build
```

---

### Q: How do I add a new verifier?

**A:** Three steps:

1. Implement `Verifier` interface in `src/adapters/your-verifier.ts`
2. Register in `src/registry.ts`
3. Run `npm run verify` to test

No other changes needed.

---

## Next Steps (This Branch)

1. ✅ Design Verification Spine API (this doc)
2. Create `packages/verification-spine/` package structure
3. Implement core types (`types.ts`)
4. Implement registry (`registry.ts`)
5. Implement orchestrator (`orchestrator.ts`)
6. Implement reporter (`reporter.ts`)
7. Create 3 adapters as proof-of-concept:
   - `guarantees` (most complex)
   - `chronicle-chain` (hash verification)
   - `build` (simple prerequisite)
8. Wire up CLI (`cli.ts`)
9. Test end-to-end
10. Commit + push

**Future PR:** Adapt remaining 15 verifiers, deprecate old tools, update CI.

---

## Changelog

| Version | Date | Changes |
|---------|------|---------|
| v1 | 2026-01-22 | Initial Verification Spine design |

---

## See Also

- [HIGH_LEVERAGE_DECISION_CHECKLIST.md](HIGH_LEVERAGE_DECISION_CHECKLIST.md) - Decision engine (scored this 9/9)
- [LEVERAGE_TIER_MAPPING.md](LEVERAGE_TIER_MAPPING.md) - Current state audit
- [CIVIL_GUARANTEES.md](apps/server/docs/CIVIL_GUARANTEES.md) - Constitutional law
- [V1_SCOPE.md](V1_SCOPE.md) - Release boundaries
