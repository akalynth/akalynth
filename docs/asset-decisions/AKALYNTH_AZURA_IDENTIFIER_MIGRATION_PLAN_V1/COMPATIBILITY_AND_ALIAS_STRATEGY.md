# Compatibility And Alias Strategy

## Contract Touched In This Plan

Completed scoped account-world cleanup touched:

- account `GET /v1/worlds`
- account `POST /v1/characters`

Compatibility result:

- `GET /v1/worlds` now advertises `high_city` / `High City`.
- `POST /v1/characters` requires exact canonical world ids and rejects legacy
  `azura` input with `400 invalid_input`.

Future implementation will touch:

- shared HTTP `MapName`
- WebSocket map-bearing messages
- shared `TileCode`
- map JSON file names and `MapData.name`
- Android `MapName` serialization
- browser map lookup
- server map registry
- receipt/evidence display adapters
- property id parsing

## Compatibility Impact

The completed account-world cleanup is intentionally breaking for old
account-character clients that still submit `azura`. Clients must use the public
catalog and submit `high_city`.

The future runtime switch is protocol-visible because clients currently parse map names such as `Azura`. If the server starts sending `HighCity` before clients support it, Android and other strict clients may fail to deserialize map-bearing messages.

## Alias Model

Use three distinct concepts:

| Concept | Future value | Notes |
| --- | --- | --- |
| World/app/site name | `Akalynth` | public brand and world name |
| Display city name | `High City` | player-facing, may contain spaces |
| Canonical map/city id | `high_city` | internal data id, file-safe |
| Wire map name | `HighCity` | protocol-facing value |

Legacy values:

| Legacy value | Compatibility rule |
| --- | --- |
| `Azura` | accepted for historical receipts and old clients |
| `azura` | rejected by account-character create; may remain only as a map-file alias during migration |
| `azura.json` | replaced by `high_city.json`, but legacy lookup may remain during transition |
| `GateToAzura` | retained as deprecated alias for tile code `8` until a cleanup gate |
| `gate_to_azura` | accepted as legacy landmark name during map migration |
| `Azura:H*` | accepted as legacy property id prefix during state migration |

## Tile Code Strategy

Tile code number `8` must not change.

Future TypeScript shape should preserve compatibility:

```ts
GateToHighCity = 8,
GateToAzura = GateToHighCity, // deprecated alias
```

Android and studio equivalents should do the same where practical. If the target language cannot alias enum values cleanly, keep the old parser path and update display labels only until a safe cleanup gate.

## Map Name Strategy

Future parser behavior:

- `Rookguard` resolves to canonical id `rookguard`
- `HighCity` resolves to canonical id `high_city`
- `Azura` resolves to canonical id `high_city` as a legacy alias

Future display behavior:

- canonical id `high_city` displays as `High City`
- historical `Azura` receipts may display as `High City (formerly Azura)` in proof views when clarity matters

## Property Id Strategy

Future canonical property ids should use:

- `high_city:H1`
- `high_city:H2`
- `high_city:H3`

Legacy ids such as `Azura:H1` must remain resolvable for:

- existing runtime rows
- receipts
- tests
- proof bundles

If runtime DB state contains `Azura:*` property ids, migrate rows in a specific DB/state migration lane with receipt/evidence capture. Do not silently rewrite historical receipts.

## NPC And Place Strategy

Future ids:

- `high_city_herald`
- `high_city_steward`
- `high_city:plaza`
- `high_city:guild_hall`

Legacy ids:

- `azura_herald`
- `azura_steward`
- `azura:plaza`
- `azura:guild_hall`

Future implementation should either:

- keep legacy ids as aliases until old receipts and tests are adapted, or
- keep NPC ids stable and update only display copy in the first runtime pass.

Preferred path:

- update display copy first
- then add aliases
- then rename canonical ids
- then clean old ids only in a later cleanup gate

## Client Action Required

Future clients must:

- parse `HighCity`
- continue parsing `Azura`
- display `High City`
- avoid treating map name strings as authority for movement, collision, or transition

## Protocol Version Recommendation

Do not bump protocol for this docs-only plan.

For the future server-emission switch to `HighCity`, bump `PROTOCOL_VERSION` from `1.1.0` to `1.2.0` unless a prior compatibility lane proves the current contract treats accepted map names as non-versioned data.
