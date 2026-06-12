# Verification

Lane: `AKALYNTH_HIGH_CITY_PLAYER_FACING_LANDMARK_COPY_PASS_V1`

## Commands And Results

```bash
npm -w apps/debug-client run build
```

Result: PASS

Evidence summary:

- TypeScript compile completed.
- Vite production build completed.
- Output included `✓ built`.

```bash
npm run verify:quick
```

Result: PASS

Evidence summary:

- Akalynth Verification Spine v1 completed.
- Result: `PASSED (9/9 verifiers passed)`.

Passed verifier groups:

- `build`
- `assets`
- `db-exists`
- `doctrine`
- `guarantees`
- `mapgen`
- `receipts-exist`
- `identity`
- `receipts-chain`

```bash
git diff --check -- docs/WORLD_HIGH_CITY.md apps/debug-client/src/data/lore.ts
```

Result: PASS

## Conditional Verification

`apps/server/src/world/npcs.ts` was not changed, so these conditional commands
were not required for this lane:

```bash
npm -w apps/server run verify:npc-recognition
npm -w apps/server run verify:evidence-loop
```

## Caveat

The repo had unrelated dirty server files before this lane. Verification above
covers this copy-only lane and does not classify or clean those unrelated files.
