# Validation And Rollout Plan

## Lane Boundary

This plan has one completed scoped account-world cleanup. It does not run the
runtime map identifier migration. It defines validation required for future
implementation lanes.

## Completed Account-World Catalog Validation

Commands already used for the scoped account-world cleanup:

- `npm -w apps/server run test:character-v2`
- `npm -w apps/server run build`
- `./scripts/verify_protocol_sync.sh`
- `npm run verify`

Covered checks:

- `GET /v1/worlds` advertises `high_city` / `High City`
- legacy `azura` create input remains accepted
- account character rows persist `high_city`
- new character lifecycle receipts emit `high_city`, not `azura`
- full verification spine passed after the change

## Required Validation For Future Compatibility Prep

Commands:

- `npm run verify:quick`
- `npm -w apps/debug-client run build`
- `npm -w apps/server run build`
- `./scripts/verify_protocol_sync.sh`
- Android `./gradlew assembleDebug`

Expected checks:

- old `Azura` payloads still parse
- new `HighCity` payloads parse in clients
- server still emits `Azura` until switch lane
- no production map promotion
- no runtime state migration yet

## Required Validation For Future Runtime Switch

Commands:

- `npm run verify:quick`
- `npm -w apps/debug-client run build`
- `npm -w apps/server run build`
- `./scripts/verify_protocol_sync.sh`
- Android `./gradlew assembleDebug`
- focused protocol parity tests
- focused Rookguard gate transfer test
- focused property id compatibility test
- focused chronicle/proof historical receipt test

Runtime checks:

- Rookguard still loads
- Rookguard tutorial still completes
- gate transfers to High City spawn
- map dimensions and spawn unchanged unless a separate map lane changes them
- tile code `8` still represents the gate
- old `Azura` receipts remain verifiable
- old property ids remain resolvable or explicitly migrated with evidence
- Android connects and renders the new map/city name
- browser connects and renders the new map/city name

## Beta Rollout

Future beta promotion should require:

- beta API health green
- beta WebSocket protocol updated if protocol bump occurs
- beta browser `/play/` reaches Rookguard and transfers to High City
- beta APK connects and renders High City
- old receipt proof sample still renders
- rollback path recorded

## Production Rollout

Do not promote production until:

- beta has passed the above checks
- identifier migration evidence bundle exists
- rollback plan is named
- old production protocol/name state is recorded
- public copy is aligned but does not overclaim

## Rollback Strategy

Rollback must preserve:

- old `Azura` aliases
- old receipts
- old property ids
- old map file or lookup alias if needed

Never rollback by rewriting receipt history.

## Negative Checks

Future implementation must fail or flag:

- server emits `HighCity` before clients parse it
- Android parser rejects old `Azura` receipts
- browser map lookup has no alias for old `Azura`
- property ids silently lose ownership rows
- historical `death_in_azura` actions stop verifying
- public copy claims migration before beta verifies it
