# @receipt-verify

Purpose: Verify receipt chain integrity deterministically (0/1/2 exits preserved).

Run:
- npm run verify:chronicle-chain
- npm run verify:lifecycle (if present)
- Any additional receipt integrity tools already in the repo

Rules:
- Do not invent new verification logic here.
- Report exact commands + exit codes.
