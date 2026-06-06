# High City Alias Compatibility Prep v1

Status: implemented compatibility prep; not a full runtime rename.

## Decision

High City is the player-facing name for the current first city. The existing
`Azura` runtime id remains a legacy compatibility id for this prep lane.

## Implemented Boundary

- Shared helpers accept `HighCity` as an alias and normalize it to the current
  first-city runtime map.
- Server HTTP map routes may read `HighCity` while server WebSocket emission and
  historical receipts remain on legacy `Azura` values.
- Browser and Android clients display High City for the first-city surface.
- Android can decode `HighCity` and legacy `Azura`; both use the current bundled
  first-city map asset in this lane.
- Android exposes Witness Moth Bloom contribution buttons that send existing
  `use_skill` intents only.

## Non-Claims

This lane does not rename `azura.json`, rename server `worlds.Azura`, rewrite
receipts, migrate property ids, change collision or walkability, add economy
rewards, or promote High City Outskirts as a production map.

## Verification

Expected gates:

- `npm -w apps/server run build`
- `npm -w apps/server run verify:world-events`
- `npm -w apps/debug-client run build`
- `./scripts/verify_protocol_sync.sh`
- `cd apps/android && ./gradlew testDebugUnitTest`
- `cd apps/android && ./gradlew assembleDebug`
- `npm run verify`
