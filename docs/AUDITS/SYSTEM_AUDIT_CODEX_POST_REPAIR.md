SYSTEM AUDIT CODEX - POST-REPAIR AUDIT PROMPT v1.1

Target: Akalynth (post "NEXT" repair)
Role: Constitutional Systems Auditor (post-repair verification)
Scope: Work contract tick receipts, bootstrap rules, replay determinism, failure modes.
Rule: If any Expected FAIL does not fail, the audit is FAIL.

Output Format Requirement

Produce a report with sections A-E, each marked PASS / WARN / FAIL.
For any FAIL, include:
  - the exact command
  - stdout/stderr
  - exit code
  - first offending file+line OR first offending receipt line (sequence + action)

A) Static/Grep Checks (Mechanical)

Run from repo root.

A1 - Tick receipt action constant exists (exact)

rg -n "WORK_CONTRACT_TICK_RECORDED_ACTION" packages/shared/types.ts

Expected: exactly 1+ matches.
FAIL if: 0 matches.

Also confirm it is exported and equals the canonical string:

rg -n "export const WORK_CONTRACT_TICK_RECORDED_ACTION\\s*=\\s*'work_contract_tick_recorded'" packages/shared/types.ts

Expected: 1+ match.
FAIL if: 0.

Hardening note (strict):
If repository layout changes, this audit prompt MUST be updated explicitly.
Do not replace file-path pins with "search anywhere" fallbacks for constitutional checks.

A2 - recordTick emits a receipt (no "ephemeral tick" gating payouts)

rg -n "recordTick|tick_recorded|WORK_CONTRACT_TICK_RECORDED_ACTION" apps/server/src/world/work_contracts.ts

Expected: 1+ match.
FAIL if: 0.

Also ensure no "ephemeral" tick path remains:

rg -n "ephemeral|no receipt|unreceipted" apps/server/src/world/work_contracts.ts

Expected: 0 matches.
FAIL if: any.

A3 - Server path supplies an audit writer to work contracts

Search for where work contracts are constructed / invoked with audit:

rg -n "workContracts|work_contracts|new Work|createWork|recordTick" apps/server/src/index.ts

Expected: 1+ match showing audit wiring.
FAIL if: 0.

A4 - No wall-clock in reducers (hard ban)

Run these, treat ANY match as FAIL:

rg -n "Date\\.now\\(" apps/server/src/world
rg -n "Math\\.random\\(" apps/server/src/world

Expected: 0 matches.
FAIL if: any.

(If you legitimately use wall-clock only in metrics, it must be outside reducers and outside receipt replay/projection paths. If matches exist, include context and justify.)

A5 - Bootstrap required for missing receipts

rg -n "AKALYNTH_BOOTSTRAP" apps/server/src/index.ts

Expected: 1+ match.
FAIL if: 0.

Also check that missing receipts is fatal unless bootstrap:

rg -n "missing receipts|receipts.*missing|refuse.*start|fatal" apps/server/src/index.ts

Expected: 1+ match.
FAIL if: 0.

A6 - Replay hard-errors on missing receipts AND truncation/empty-with-state

rg -n "throw.*missing.*receipts|fatal.*missing.*receipts|ENOENT" apps/server/src/persist/replay.ts
rg -n "truncat|empty.*state|empty.*with.*state|corrupt|refuse" apps/server/src/persist/replay.ts

Expected: each command finds 1+ match.
FAIL if: any command returns 0 matches.

B) Build / Typecheck / Verifier Gate

B1 - shared types compile

npm -w packages/shared run typecheck

Expected: exit 0. FAIL otherwise.

B2 - shared types build

npm -w packages/shared run build

Expected: exit 0. FAIL otherwise.

B3 - server builds

npm -w apps/server run build

Expected: exit 0. FAIL otherwise.

B4 - work-contract verifier passes

npm -w apps/server run verify:work-contracts

Expected: exit 0. FAIL otherwise.

C) Expected FAIL Checks (Must fail)

Setup: You must not destroy real data. Use temp dirs.

C1 - Missing receipts blocks server start unless bootstrap

Create a temp run dir and ensure receipts path points to a missing file.

tmpdir="$(mktemp -d)"
AKALYNTH_RECEIPTS_PATH="$tmpdir/receipts.jsonl" node dist/server/apps/server/src/index.js; echo "exit=$?"

Expected: exits quickly with exit=2 (ERROR).
FAIL if: it starts, hangs, or exits 0/1.

C2 - Bootstrap refused if "not fresh"

If bootstrap is only allowed on truly fresh state, simulate "has DB marker but no receipts."
Create a dummy DB marker file (or whatever the server checks) in temp dir and run with bootstrap:

tmpdir="$(mktemp -d)"
touch "$tmpdir/akalynth.db"
AKALYNTH_BOOTSTRAP=1 AKALYNTH_DATA_DIR="$tmpdir" AKALYNTH_RECEIPTS_PATH="$tmpdir/receipts.jsonl" node dist/server/apps/server/src/index.js; echo "exit=$?"

Expected: exit=2 with message like "bootstrap refused ... state exists".
FAIL if: it starts, generates receipts, or exits 0/1.

(If the project uses different env vars for DB/data dir, discover them in code and rerun with correct ones. Report what you used.)

C3 - Production forbids lenient replay

If there is a lenient mode, production must disallow it:

AKALYNTH_ENV=production AKALYNTH_REPLAY_MODE=lenient node dist/server/apps/server/src/index.js; echo "exit=$?"

Expected: exit=2 with "lenient forbidden".
FAIL if: it runs.

(If env var names differ, locate via rg -n "lenient|REPLAY_MODE|AKALYNTH_ENV|production" apps/server/src/index.ts and use the actual names.)

D) Deterministic Replay Hash (Same receipts -> same hash)

Precondition: Provide a receipts chain path that contains at least:
  - a work contract start
  - tick receipts
  - completion + WALLET_CREDIT_ACTION payout

Set:

CHAIN="path/to/receipts.jsonl"

Now run twice in fresh node processes (same command twice). Hash must match.

Use ESM-safe Node script (no mixed module imports):

node --input-type=module - <<'NODE'
import fs from "node:fs";
import crypto from "node:crypto";

const chainPath = process.env.CHAIN;
if (!chainPath) { console.error("CHAIN env missing"); process.exit(2); }

const raw = fs.existsSync(chainPath) ? fs.readFileSync(chainPath, "utf8") : "";
const lines = raw.split("\\n").map(l=>l.trim()).filter(Boolean);
const receipts = lines.map(l => JSON.parse(l));

// Minimal deterministic projection: derive tick counts + payout totals by actor+contract_id.
// (This avoids import coupling; we are testing chain determinism, not implementation parity.)
const ticks = new Map(); // key = actor_id|contract_id -> count
const payouts = new Map(); // actor_id -> total
for (const r of receipts) {
  const a = r.actor_id ?? "";
  const action = r.action ?? "";
  const inputs = r.inputs ?? {};
  const contract_id = inputs.contract_id ?? inputs.work_contract_id ?? "";
  if (action === "work_contract_tick_recorded") {
    const k = `${a}|${contract_id}`;
    ticks.set(k, (ticks.get(k) ?? 0) + 1);
  }
  if (action === "wallet_credit" && (inputs.reason === "work_contract" || inputs.credit_reason === "work_contract")) {
    payouts.set(a, (payouts.get(a) ?? 0) + (inputs.amount ?? inputs.gold ?? 0));
  }
}

const payload = JSON.stringify({
  receipts_count: receipts.length,
  ticks: [...ticks.entries()].sort(),
  payouts: [...payouts.entries()].sort(),
});

const h = crypto.createHash("sha256").update(payload).digest("hex");
console.log(h);
NODE

Run it twice:

CHAIN="$CHAIN" node --input-type=module - <<'NODE' ... NODE
CHAIN="$CHAIN" node --input-type=module - <<'NODE' ... NODE

Expected: identical SHA256 both runs.
FAIL if: different.

(If the chain includes non-deterministic fields, that is a constitutional breach unless those fields are explicitly non-impactful and excluded from enforcement. Document any such fields found.)

E) Tick Receipts Enforce Payout Ordering (Chain-local)

This is the critical "no unreceipted gating" proof.

Implement this chain scan (run from repo root):

CHAIN="path/to/receipts.jsonl"

node --input-type=module - <<'NODE'
import fs from "node:fs";

const chainPath = process.env.CHAIN;
if (!chainPath) { console.error("CHAIN env missing"); process.exit(2); }

const raw = fs.existsSync(chainPath) ? fs.readFileSync(chainPath, "utf8") : "";
const lines = raw.split("\\n").map(l=>l.trim()).filter(Boolean);
const receipts = lines.map(l => JSON.parse(l));

const requiredTicksByContract = new Map(); // actor|contract -> required_ticks
const tickCountByContract = new Map();     // actor|contract -> count
const fail = (msg, r) => {
  console.error("FAIL:", msg);
  console.error("OFFENDING:", { sequence: r.sequence, action: r.action, actor_id: r.actor_id, inputs: r.inputs });
  process.exit(1);
};

for (const r of receipts) {
  const a = r.actor_id ?? "";
  const action = r.action ?? "";
  const inputs = r.inputs ?? {};
  const contract_id = inputs.contract_id ?? inputs.work_contract_id ?? "";

  // Capture required tick count if present on start
  if (action === "work_contract_started" && contract_id) {
    const req = inputs.required_ticks ?? inputs.ticks_required ?? null;
    if (req != null) requiredTicksByContract.set(`${a}|${contract_id}`, req);
  }

  if (action === "work_contract_tick_recorded") {
    if (!contract_id) fail("tick missing contract_id", r);
    const k = `${a}|${contract_id}`;
    tickCountByContract.set(k, (tickCountByContract.get(k) ?? 0) + 1);
  }

  // Enforce: any payout with reason work_contract must have enough prior ticks for that same contract
  if (action === "wallet_credit" && (inputs.reason === "work_contract" || inputs.credit_reason === "work_contract")) {
    const payoutContract = inputs.contract_id ?? inputs.work_contract_id ?? contract_id;
    if (!payoutContract) fail("wallet_credit(work_contract) missing contract_id", r);
    const k = `${a}|${payoutContract}`;
    const have = tickCountByContract.get(k) ?? 0;
    const req = requiredTicksByContract.get(k);

    // If required tick count is unknown, still enforce ">=1 tick" minimum (better than nothing).
    if (req == null) {
      if (have < 1) fail("payout without any prior tick receipts (required_ticks unknown)", r);
    } else {
      if (have < req) fail(`payout before required ticks: have=${have}, req=${req}`, r);
    }
  }
}

console.log("PASS: payout ordering enforced by tick receipts (chain-local scan)");
process.exit(0);
NODE

Expected: exit 0 with PASS line.
FAIL if: exit 1, or any offending receipt.
