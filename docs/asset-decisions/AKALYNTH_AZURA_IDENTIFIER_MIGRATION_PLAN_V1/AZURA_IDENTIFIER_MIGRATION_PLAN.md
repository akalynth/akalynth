# Azura Identifier Migration Plan

## Goal

Design the future migration from Azura runtime identifiers to High City without breaking server authority, client protocol compatibility, receipts, replay, Android parsing, browser rendering, property ids, or historical evidence.

This lane started as planning only. Completed scoped sublanes are recorded below
so future runtime migration work does not repeat already-safe cleanup.

## Canonical Naming Decision

Use these future names:

| Concept | Current | Future canonical |
| --- | --- | --- |
| World/app/site name | Akalynth | Akalynth |
| Player-facing first city name | Azura | High City |
| Canon lore city name | Azura | High City |
| Canon map/city id | `azura` | `high_city` |
| New wire map name | `"Azura"` | `"HighCity"` |
| Map file | `azura.json` | `high_city.json` |
| Shared tile name | `GateToAzura` | `GateToHighCity` |
| Rookguard landmark | `gate_to_azura` | `gate_to_high_city` |
| Place id prefix | `azura:` | `high_city:` |
| NPC id prefix | `azura_` | `high_city_` |
| Character world/location id | `azura` | `high_city` |
| Property id prefix | `Azura:` | `high_city:` |

Reasoning:

- Display text may contain spaces: `High City`.
- Runtime ids should not contain spaces.
- Wire values should be compact and serializer-friendly: `HighCity`.
- Historical receipts using `Azura` must remain readable forever.
- `Akalynth` remains the world/app/site name and should not be used as the city id.

## Required Migration Order

### Phase 1: Compatibility Preparation

Future lane:

`AKALYNTH_HIGH_CITY_ALIAS_COMPAT_PREP_V1`

Implement first:

- add shared map alias helpers
- allow server/client parsing of both `Azura` and `HighCity`
- preserve server emission of `Azura` during prep
- add display-name mapping so UI can say `High City` without changing wire names
- add tests proving old `Azura` payloads still parse

Protocol:

- no server wire emission change yet
- no protocol bump required unless the repo policy requires one for accepted values

### Phase 2: Client Dual-Parse Readiness

Future lane:

`AKALYNTH_HIGH_CITY_CLIENT_PARSE_READINESS_V1`

Implement:

- Android `MapName` can parse both `Azura` and `HighCity`
- browser debug client can render both map names
- proof/chronicle screens display `High City` for new events but preserve historical `Azura` where appropriate
- tests cover both names

Protocol:

- still do not make the server emit `HighCity`

### Completed Scoped Account-World Cleanup

Completed before the full runtime map switch:

- Account `GET /v1/worlds` advertises `high_city` / `High City` instead of
  legacy `azura` / `Azura`.
- Account `POST /v1/characters` still accepts legacy `azura` input for old
  clients, but persists and emits new character lifecycle receipts with
  `world_id: 'high_city'`.
- Focused character verifier covers catalog output, legacy alias acceptance,
  normalized persistence, and normalized receipt inputs.

Boundary:

- This does not rename the runtime map file, shared `MapName`, WebSocket map
  values, `GateToAzura`, NPC/place ids, property ids, or historical receipts.

### Phase 3: Runtime Identifier Switch

Future lane:

`AKALYNTH_AZURA_TO_HIGH_CITY_RUNTIME_MIGRATION_V1`

Implement:

- rename shared map file to `high_city.json`
- set map display name to `High City`
- change canonical map/city id to `high_city`
- change new wire map name to `HighCity`
- add or retain deprecated aliases for `Azura`
- rename Rookguard gate tile symbol to `GateToHighCity` while preserving numeric tile code `8`
- rename landmark to `gate_to_high_city`
- migrate server world registry from `worlds.Azura` to `worlds.HighCity`
- migrate new NPC/place ids to `high_city_*` and `high_city:*`
- keep the already-migrated account character catalog on `high_city` and retain
  the legacy `azura` create alias
- migrate new property ids to `high_city:H*`
- add migration logic for existing property rows if runtime state has existing Azura property ids

Protocol:

- server begins emitting `HighCity`
- bump protocol version to a new compatible release, recommended `1.2.0`
- old `Azura` remains accepted as a legacy alias

### Phase 4: Historical Compatibility And Evidence

Future lane:

`AKALYNTH_HIGH_CITY_HISTORY_COMPAT_V1`

Keep forever:

- historical receipts with `Azura`
- historical action ids such as `death_in_azura`
- old proof bundles
- old Android replay fixtures
- old public receipts

Add:

- display adapter from historical `Azura` to `High City (formerly Azura)` where useful
- verifier coverage proving old receipts still validate

### Phase 5: Public Copy And Docs

Future lane:

`AKALYNTH_HIGH_CITY_PUBLIC_COPY_MIGRATION_V1`

Completed docs-only cleanup:

- Retired the old first-city world-doc path in favor of
  `docs/WORLD_HIGH_CITY.md` — completed as a docs-only rename while preserving
  legacy runtime identifiers.
- Updated Rookguard doc gate language.

Completed client display cleanup:

- Browser map selector and lore surfaces render the first city as High City via
  display helpers while retaining legacy `Azura` map keys.
- Android Chronicle, death recap, Why sheet, map display name, and map lore
  render legacy `Azura` / `HighCity` zone values as High City without mutating
  stored receipts, protocol enums, or bundled map assets.

Remaining future public-copy work:

- website copy
- Guardian/codex copy

Boundary:

- public copy must not claim runtime migration until Phase 3 is complete and deployed.

## Do Not Do In One PR

Do not combine all phases into one large rename PR. The Android serializer, protocol-visible map values, server world registry, and historical receipts make that unsafe.

Minimum safe implementation path:

1. compatibility prep
2. client dual-parse readiness
3. runtime switch in beta
4. evidence/replay compatibility
5. public copy migration

## Current Lane Boundary

The account-world id is now migrated. The runtime map identifier migration is
not complete.
