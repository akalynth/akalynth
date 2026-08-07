# AKALYNTH_BUILD_HEALTH_REPAIR_PLAN_V1

**Classification**: BUILD_HEALTH_REPAIR_PLAN | FIRST_REPAIR_LANE

**Date**: 2026-07-09

**Based on**:
- Committed ledger: faeb9f4 (AKALYNTH_TEST_FINDINGS_TRIAGE_AND_LANE_MAP_V1.md)
- GitHub issues: #399 (BUILD-HEALTH-001)
- Previous lanes: test findings, ledger commit, issue triage plan, issue creation

**Status**: PLAN_READY — scoped repair steps defined. Do not begin code edits until next approved implementation lane.

---

## Boundary & Scope

This lane produces a **repair plan** for the P0 build health blockers only.

**In scope**:
- Server build (apps/server tsc)
- Debug client build (apps/debug-client tsc + vite)
- Shared types (packages/shared) that block the above
- TypeScript declaration and import issues

**Out of scope** (per plan rules):
- Runtime behavior changes (agent economy simulation logic)
- Android client
- Assets (except where they block build)
- Deploy, Caddy, systemd
- Full agent economy feature completion
- Protocol message changes beyond type exports

First repair lane after triage (as specified in ledger).

---

## Current Broken State (Evidence)

### Server Build Failures
Command: `npm -w apps/server run build`

Errors in `apps/server/src/simulation/agentEconomySimulation.ts`:
- TS7016: Could not find a declaration file for module '../tools/aiDecider.mjs' (line ~1)
- TS7016: ... for '../tools/pure-logic.mjs'
- TS2339: Property 'aiMode' does not exist on type 'AgentSimulationInput' (line ~192)
- TS2339: Property 'summary' does not exist on type 'AuditReceipt' (line ~297)
- TS2353: Object literal may only specify known properties, and 'leverage' does not exist in type 'AgentTrainingStep' (line ~367)

Many .bak and pre-fix files indicate experimental drift.

### Debug Client Build Failures
Command: `npm run build:client`

- TS2353: 'outfit_colors' does not exist in type 'AccountCharacterCreateRequest' (CharacterBar.tsx:171)
- TS2724: No exported member 'AccountCharacterOutfitColors' / 'AccountCharacterOutfitEngineMeta' from '@shared/http' (multiple files)
- TS2307: Cannot find module '@codex/out/codex-public.graph.json' (useCodexGraph.ts:2)
- Implicit any and symbol-to-string issues in outfit components.

### Root Causes Identified
1. **Experimental simulation code** (agentEconomySimulation.ts + tools/*.mjs) was extended with AI features (aiMode, leverage analysis) without updating local interfaces or providing .d.ts for .mjs.
2. **Incomplete feature port** for outfit recoloring: debug-client code assumes richer types in packages/shared/http.ts that were never added.
3. **Missing build artifact**: The codex graph JSON is expected via tsconfig path alias to sibling `akalynth-codex/out/` but the artifact is not generated (only .sample.html and receipt exist).
4. **Drift between experimental code and shared contracts**.

Packages build (`npm run build:packages`) succeeds because it does not include these.

---

## Proposed Repair Steps (Prioritized, Scoped)

### Phase 1: Unblock Server Build (Minimal Change)
**Goal**: Make `npm -w apps/server run build` pass without removing functionality or changing runtime.

1. Add missing fields to local interfaces in `agentEconomySimulation.ts`:
   - Extend `AgentSimulationInput` with optional `aiMode?: boolean`
   - Add `leverage?: number` or similar to `AgentTrainingStep` (or make the usage conditional)
   - Ensure `AuditReceipt` usage falls back safely (use `any` guard or extend locally if needed; prefer not touching shared yet)

2. Provide TypeScript declarations for the .mjs tools:
   - Create `apps/server/src/tools/aiDecider.d.ts` and `pure-logic.d.ts` (or move tools to .ts)
   - Or change imports to use `import type` and declare modules.

3. Temporarily mark the simulation as `// @ts-nocheck` or isolate it if it is not exercised in core build path. (Last resort; prefer typing fixes.)

**Verification**:
- `npm -w apps/server run build`
- `npm run verify:quick` (if it exercises it)

**Owner**: game-server-steward + package-steward

### Phase 2: Unblock Debug Client (Shared Types + Alias)
1. Add missing outfit types to `packages/shared/http.ts`:
   ```ts
   export interface AccountCharacterOutfitColors { /* ... */ }
   export interface AccountCharacterOutfitEngineMeta { /* ... */ }
   ```
   Update `AccountCharacterCreateRequest` if needed (additive only: `outfit_colors?: AccountCharacterOutfitColors`).

2. Fix codex graph import:
   - Either generate `codex-public.graph.json` in akalynth-codex/out/ (coordinate with codex tools)
   - Or make the import dynamic/optional with fallback in `useCodexGraph.ts`
   - Or update tsconfig path or add a build step that copies/mocks it for debug-client.

3. Fix type errors in Outfit* components (keyof, symbol coercion).

**Verification**:
- `npm run build:client`
- `npm -w apps/debug-client run build`

**Owner**: debug-client + package-steward + protocol-guardian (for shared types)

### Phase 3: Clean Up & Harden
- Remove or properly gate experimental .bak files from source tree.
- Add build guards or conditional compilation for simulation if it remains optional.
- Update `tsconfig` paths and ensure `resolveJsonModule` works for codex.
- Add the new types to any relevant tests or verifiers.
- Run full `npm run build` + `npm run verify:quick`

**Risks**:
- Changing shared types is additive only (no breaking for existing clients).
- Simulation code may have runtime expectations not covered by types.
- Codex graph generation may require separate codex build lane.

---

## Files Likely Affected (Read-Only Analysis)

**High confidence**:
- `apps/server/src/simulation/agentEconomySimulation.ts`
- `apps/server/src/tools/aiDecider.mjs` + `pure-logic.mjs` (and .d.ts or conversion)

**Update (build-with-ai):** aiDecider now supports SpaceXAI (XAI_API_KEY → grok-4.5 at api.x.ai/v1) as the preferred LLM. Local Ollama and pure fallback remain. No change to the experimental typing surface.
- `packages/shared/http.ts`
- `apps/debug-client/src/hooks/useCodexGraph.ts`
- `apps/debug-client/src/components/OutfitColorPicker.tsx` + related (OutfitRecolorPreview, outfitRecolorEngine.ts, types.ts, CharacterBar.tsx)
- `apps/debug-client/tsconfig.json`
- Possibly `apps/server/package.json` scripts

**For codex**:
- Sibling `repos/akalynth-codex/out/` (or tools that generate the graph)

**Do not touch in this plan**:
- Runtime world simulation logic
- Android sources
- Asset PNGs/JSON beyond build impact
- Deploy scripts

---

## Verification Matrix

| Step | Command | Expected |
|------|---------|----------|
| Packages | `npm run build:packages` | Success |
| Server build | `npm -w apps/server run build` | 0 errors |
| Client build | `npm run build:client` | 0 errors |
| Full | `npm run build` | Success |
| Quick verify | `npm run verify:quick` | Passes build phase |
| Protocol | `./scripts/verify_protocol_sync.sh` | (may still fail on Android parity; out of scope) |

Run after each phase.

---

## Dependencies & Sequencing

- This plan is independent of asset hygiene (#401) and workspace hygiene (#402).
- Protocol parity (#400) shares some outfit_id context but is separate (Android literals).
- May surface need for codex build step (potential follow-on lane).
- After this, re-run full test suite per test-runner skill before claiming broader health.

---

## Explicit Non-Claims

- This does **not** make the agent economy simulation "complete" or "production".
- Does **not** claim full repo build health (other issues remain).
- Does **not** touch live beta surfaces.
- Build health repair is a prerequisite for credible release claims.

---

## Recommended Next Lane (after this plan)

- AKALYNTH_BUILD_HEALTH_REPAIR_EXECUTE_V1 (or direct implementation of Phase 1 under package-steward + game-server-steward)
- Or AKALYNTH_TEST_FINDINGS_ISSUE_UPDATE_V1 to link these GitHub issues to the plan.

**Operator call**: Plan complete. Proceed to implementation only with explicit approval for the execute lane. Use narrowest changes first (types + declarations) to unblock builds.

---

**Ledger Reference**: faeb9f4  
**GitHub**: See issue #399 for BUILD-HEALTH-001  
**Skills invoked in planning**: package-steward, debug-client, game-server-steward principles. 

Do not delete — this is the authoritative build health repair plan.