# Protocol

This document describes the WebSocket protocol currently backed by source code.

## Source Authority

The protocol authority is:

- `packages/shared/protocol.ts`
- `packages/shared/types.ts`
- `packages/shared/protocol.golden.json`
- `scripts/verify_protocol_sync.sh`

`packages/shared/protocol.ts` exports `PROTOCOL_VERSION = '2.0.0'`. v2.0.0 accepts the house-auction protocol surface: auction open/bid/cancel client intents, auction state and settlement server broadcasts, and widened `property_result` action/reason values. Clients with exhaustive `property_result.action` or `property_result.reason` handling must tolerate the auction values listed here.

This document is documentation only. It does not change shared types, runtime handlers, generated artifacts, clients, deployment state, or live service behavior.

## Verification Contract

`bash scripts/verify_protocol_sync.sh` mechanically compares message type literals in `packages/shared/protocol.ts` against fourth-level message headings in this file.

The current sync script has one known compatibility wrinkle: its grep also matches the `contract_type: 'temple_sweep'` literal. For that reason this document includes a dedicated `temple_sweep` heading under **Contract Type Literals**, while explicitly stating that `temple_sweep` is not a top-level WebSocket message.

## Runtime Gates

The server remains authoritative. Clients send intent; the server validates state, applies runtime gates, mutates server-owned state, writes receipts where implemented, and returns results.

Important gates:

- authentication is required for gameplay actions after connection/login
- world-entry state gates movement, chat, combat, items, chronicle, evidence, and economy actions
- DEBUG-only messages must not be treated as normal client capabilities
- moderation report and resolution messages are currently gated by authenticated session plus DEBUG mode; this document does not claim a role-based admin policy unless server code adds one
- optional fields are compatibility surfaces, not authority transfers to the client

## Compatibility Notes

`login` and `login_ack` carry both legacy guest-token fields and newer signed-token fields. `token` is preferred where available. `guest_token` remains present for legacy compatibility.

Server messages may include optional fields for UI context. Clients should tolerate unknown additional fields, but they should not treat unknown message types as valid gameplay authority.

## Android Subset Caveat

The Android client may implement only a subset of this protocol at any given time. The shared protocol file remains the contract authority; client support is a separate compatibility question.

## Message Format

All messages are JSON objects over WebSocket and include a `type` field.

```typescript
interface BaseMessage {
  type: string;
}
```

## Client → Server Messages

| Type | Source-backed role |
| --- | --- |
| `connect` | Client requests a WebSocket connection handshake. The server may answer with `welcome`. |
| `login` | Authenticates the session. `token` is preferred where available; `guest_token` remains legacy-compatible. |
| `enter_world` | Requests entry into the active world after authentication. |
| `move_intent` | Requests movement by `direction`. The server validates movement and remains authoritative for position. |
| `chat` | Submits a chat message. Chat can also satisfy an active Tem challenge when the response is correct. |
| `tem_response` | Responds directly to an active Tem challenge. |
| `kill_self` | Test-only death trigger subject to the server test gate. |
| `runestone_cast` | Casts at a runestone table with `table_id` and optional prediction `guess`. Omitted or invalid `guess` is normalized to `null` by parser handling. |
| `tem_witness_response` | Responds to a heat-penalty witness request with `confirm`, `deny`, or `uncertain`. |
| `drop_item` | Requests dropping an inventory item by `item_id`. |
| `pickup_item` | Requests picking up a world item by `item_id`. |
| `attack_intent` | Requests attack against `target_id`. The server validates adjacency, map, status, and PvP gates. |
| `mint_legendary` | DEBUG/dev-only legendary item minting message. It is not a normal client capability. |
| `set_protected_slot` | Requests changing the item protected from death drops. |
| `get_chronicle` | Requests chronicle events for self or another player, with optional pagination. |
| `get_evidence` | Requests evidence by `chronicle_event_id` or `receipt_hash`. |
| `get_pressure_metrics` | Requests pressure metrics over optional `since`/`until` timestamps. |
| `declare_vocation` | Declares the player's vocation from the shared vocation enum. |
| `inspect_player` | Requests profile/identity information for `target_player_id`. |
| `grant_sovereign_prefix` | DEBUG-only grant or revoke of sovereign prefix for `target_player_id`. |
| `inspect_wallet` | Requests the caller's wallet snapshot. |
| `pay_tithe` | Pays a gold tithe by `amount`. |
| `grant_gold` | DEBUG-only gold grant for `target_player_id`. |
| `start_work_contract` | Starts a work contract. The current `contract_type` literal is `temple_sweep`. |
| `work_tick` | Records a presence tick for an active work contract. |
| `talk_to_npc` | Interacts with an NPC by `npc_id`. |
| `use_skill` | Uses a utility/admin skill by `skill_id` and optional `target_id`. |
| `get_mod_reports` | DEBUG-only moderation report listing. Current runtime gate is authenticated session plus DEBUG mode. |
| `mod_resolve` | DEBUG-only moderation resolution. `receipt_hash` is the preferred lookup key; `case_id` is legacy. Current runtime gate is authenticated session plus DEBUG mode. |
| `buy_house` | Buys a house by `property_id` (primary sale if unowned, resale if listed). Price is server-side. |
| `list_house` | Lists an owned house for sale at `price`. |
| `unlist_house` | Removes an owned house from the market. |
| `get_property_ledger` | Requests a property's ownership ledger. |
| `open_house_auction` | Owner opens a resale auction on an owned plot. |
| `place_house_bid` | Places a gold bid on an open auction (escrow + outbid refund). |
| `cancel_house_auction` | Owner cancels a resale auction (only with zero bids). |

## Server → Client Messages

| Type | Source-backed role |
| --- | --- |
| `welcome` | Server accepts the connection and returns a protocol/application version string. |
| `login_ack` | Returns login result, player identity, token fields, and optional failure reason. |
| `world_state` | Initial world snapshot containing `map`, the current player, and nearby players. |
| `move_result` | Result of a move intent. The server returns authoritative coordinates and optional `map`. |
| `player_moved` | Broadcast that another player moved. |
| `player_joined` | Broadcast that another player entered the world. |
| `player_left` | Broadcast that a player left. |
| `chat_broadcast` | Broadcast chat message. |
| `tem_challenge` | Tem anti-bot challenge with challenge id, prompt message, and timeout seconds. |
| `error` | Generic error response using the shared `ErrorCode` union. |
| `death_notice` | Death/respawn notice with respawn time, map, spawn, reason, and optional UI context. |
| `runestone_result` | Broadcast result of a runestone cast. |
| `runestone_denied` | Runestone cast denial with `RunestoneDenialReason`. |
| `tem_witness_request` | Witness request for a heat penalty. |
| `drop_item_result` | Drop request result. |
| `pickup_item_result` | Pickup request result. |
| `inventory_snapshot` | Full inventory snapshot. |
| `world_item_added` | Broadcast that an item appeared in the world. |
| `world_item_removed` | Broadcast that an item was removed from the world. |
| `combat_resolved` | Broadcast resolved combat kill outcome. |
| `combat_rejected` | Combat rejection with a shared rejection reason. |
| `protected_slot_set` | Protected slot change result. |
| `chronicle_snapshot` | Chronicle event response with pagination flag. |
| `evidence_snapshot` | Evidence response with status, anchor echo, and optional drop explanation. |
| `pressure_metrics_snapshot` | Pressure metrics response for the requested interval. |
| `player_inspect` | Player profile/identity response. |
| `wallet_snapshot` | Wallet response for the caller. |
| `tithe_result` | Tithe payment result with `success`, optional `new_balance`, and optional error. |
| `work_contract_started` | Work contract started confirmation. |
| `work_progress` | Work contract progress update. |
| `work_contract_result` | Work contract result with optional credited gold or error. |
| `npc_dialogue` | NPC dialogue response. |
| `npc_dialogue_error` | NPC dialogue error response. |
| `skill_result` | Utility/admin skill result. |
| `mod_reports_snapshot` | Moderation report snapshot. |
| `mod_resolve_result` | Moderation resolution result. |
| `property_snapshot` | Full property/house state (anonymized owners) sent on `enter_world`. |
| `property_state` | A single property's updated public state. |
| `house_sold` | Zone broadcast when a house changes hands (buyer/seller names, price, sale count). |
| `property_result` | Result of a buy/list/unlist intent with optional denial reason. |
| `property_ledger` | Ownership ledger (anonymized history + sale count) for a property. |
| `property_auction_state` | Open-auction state (anonymized) after open/bid/cancel. |
| `house_auction_settled` | Zone broadcast when an auction closes and settles (winner/seller/price). |

## Client → Server Details

#### `connect`

Client requests a WebSocket connection handshake.

#### `login`

Authenticates the session. `token` is preferred. `guest_token` is legacy-compatible and optional.

#### `enter_world`

Requests entry into the active world after authentication.

#### `move_intent`

Requests movement by `direction`.

#### `chat`

Submits a chat message. Chat may satisfy an active Tem challenge when the content is the expected challenge response.

#### `tem_response`

Responds directly to an active Tem challenge. Clients should submit the
player-entered answer and must not hardcode the expected phrase; the server owns
the prompt and validation.

#### `kill_self`

Test-only death trigger subject to server-side test gate handling.

#### `runestone_cast`

Casts at a runestone table. `table_id` identifies the table. `guess` may be an `Element`, `null`, omitted, or invalid input that parser handling normalizes to `null` for compatibility.

#### `tem_witness_response`

Responds to a heat-penalty witness request. Valid responses are `confirm`, `deny`, and `uncertain`.

#### `drop_item`

Requests dropping an inventory item by `item_id`.

#### `pickup_item`

Requests picking up a world item by `item_id`.

#### `attack_intent`

Requests attack against `target_id`.

#### `mint_legendary`

DEBUG/dev-only legendary item minting message.

#### `set_protected_slot`

Requests changing the protected item slot.

#### `get_chronicle`

Requests chronicle events. Optional fields are `player_id`, `limit`, and `before`.

#### `get_evidence`

Requests evidence using `chronicle_event_id` or `receipt_hash`, with optional `kind` sanity guard.

#### `get_pressure_metrics`

Requests pressure metrics over optional `since` and `until` timestamps.

#### `declare_vocation`

Declares the player's vocation.

#### `inspect_player`

Requests player identity/profile view using `target_player_id`.

#### `grant_sovereign_prefix`

DEBUG-only sovereign prefix grant/revoke using `target_player_id` and `grant`.

#### `inspect_wallet`

Requests the caller's wallet snapshot.

#### `pay_tithe`

Pays a gold tithe by `amount`.

#### `grant_gold`

DEBUG-only gold grant using `target_player_id` and `amount`.

#### `start_work_contract`

Starts a work contract. The current supported contract type is `temple_sweep`.

#### `work_tick`

Records a presence tick for an active work contract.

#### `talk_to_npc`

Interacts with an NPC by `npc_id`.

#### `use_skill`

Uses a utility/admin skill by `skill_id` and optional `target_id`.

#### `get_mod_reports`

Lists moderation reports. Current runtime gate is authenticated session plus DEBUG mode. No role-based admin policy is asserted by this document.

#### `mod_resolve`

Resolves a moderation report. Current runtime gate is authenticated session plus DEBUG mode. `receipt_hash` is preferred; `case_id` is legacy.

#### `buy_house`

Buys a house by `property_id`. Primary sale (treasury → buyer, gold sink) if the plot is unowned; resale (seller → buyer, conserved) if it is listed. Price is determined server-side; the client never supplies it.

#### `list_house`

Lists an owned house for sale at `price` (integer gold, 1..MAX). Only the current owner may list.

#### `unlist_house`

Removes an owned house from the market. Only the current owner may unlist.

#### `get_property_ledger`

Requests the ownership ledger (owner history + sale count) for a `property_id`.

### Property auctions

> **Status:** open / bid / cancel handlers are ACTIVE and emit receipts,
> and the world-loop close→settle trigger is ACTIVE for resale auctions. When an
> open auction passes its recorded close, the loop emits `property_auction_settled`
> (and `house_auction_settled` broadcast); for a resale winner it also credits the
> seller. **Wall-clock only decides *when* to emit — settlement truth is the
> receipt; replay never recomputes the winner.** Clients are intent-only;
> accepted amount/winner state is server-derived. Only **resale** auctions can be
> opened today (owner-initiated); **primary/system auction opening is a separate
> later lane**. A durable auction projection/materializer is implemented and
> covered by property-auction verifiers; a production restart proof run is still
> not claimed. `HousePlot.allocation_mode` (`'fixed' | 'auction'`, absent ⇒
> `fixed`) governs how an unowned plot is allocated in future steps.

#### `open_house_auction`

Owner opens a resale auction on an owned plot with `min_bid`, `min_increment_gold`,
and `duration_s` (the requested window; settlement is emitted by the world-loop
close→settle path after the recorded close time).
Only the current owner may open; the plot must be `owned`.

#### `place_house_bid`

Places a gold bid (`amount`) on an open auction. The amount must be ≥ the next
minimum (`current_high + min_increment_gold`, or `min_bid` for the first bid) and
affordable; the seller cannot bid. Accepting a bid escrows the bidder's gold
(`wallet_debit`/`auction_escrow`) and, when it outbids a prior high bidder,
refunds that bidder the exact prior amount (`property_bid_refunded` +
`wallet_credit`/`auction_refund`).

#### `cancel_house_auction`

Owner cancels a resale auction — allowed **only while it has zero bids**.

## Server → Client Details

#### `welcome`

Server accepts the connection and returns a version string.

#### `login_ack`

Returns login result, player identity, token fields, expiry where present, and optional failure reason.

#### `world_state`

Initial world snapshot containing `map`, current player, and nearby players.

#### `move_result`

Move result with authoritative coordinates, reason, and optional map.

#### `player_moved`

Broadcast that another player moved.

#### `player_joined`

Broadcast that another player entered the world.

#### `player_left`

Broadcast that a player left.

#### `chat_broadcast`

Broadcast chat message.

#### `tem_challenge`

Tem challenge with challenge id, prompt, and timeout seconds. Clients should
display the server-provided `message` verbatim.

#### `error`

Error response using `ErrorCode`.

#### `death_notice`

Death/respawn notice with optional UI context.

#### `runestone_result`

Broadcast result of a runestone cast.

#### `runestone_denied`

Runestone denial with shared denial reason.

#### `tem_witness_request`

Witness request for a heat penalty.

#### `drop_item_result`

Drop request result.

#### `pickup_item_result`

Pickup request result.

#### `inventory_snapshot`

Full inventory snapshot.

#### `world_item_added`

Broadcast that an item appeared in the world.

#### `world_item_removed`

Broadcast that an item was removed from the world.

#### `combat_resolved`

Broadcast resolved combat kill outcome.

#### `combat_rejected`

Combat rejection with shared reason.

#### `protected_slot_set`

Protected slot change result.

#### `chronicle_snapshot`

Chronicle event response.

#### `evidence_snapshot`

Evidence response with status, anchor echo, optional receipt hashes, and optional drop explanation.

#### `pressure_metrics_snapshot`

Pressure metrics response for the requested interval.

#### `player_inspect`

Player profile/identity response.

#### `wallet_snapshot`

Wallet response for the caller.

#### `tithe_result`

Tithe payment result with `success`, optional `new_balance`, and optional error.

#### `work_contract_started`

Work contract started confirmation.

#### `work_progress`

Work contract progress update.

#### `work_contract_result`

Work contract result with optional credited gold or error.

#### `npc_dialogue`

NPC dialogue response.

#### `npc_dialogue_error`

NPC dialogue error response.

#### `skill_result`

Utility/admin skill result.

#### `mod_reports_snapshot`

Moderation report snapshot.

#### `mod_resolve_result`

Moderation resolution result.

#### `property_snapshot`

Full property/house state sent on `enter_world`. Owners are exposed as `owner_name` only — never raw player ids.

#### `property_state`

Single property's updated public state, sent to the actor after buy/list/unlist and broadcast to the zone on changes.

#### `house_sold`

Zone broadcast when a house changes hands: `property_id`, `plot_id`, `zone`, `buyer_name`, `seller_name` (null = treasury/primary sale), `price`, and `sale_count`.

#### `property_result`

Result of a `buy_house`/`list_house`/`unlist_house` intent with `success` and optional `reason` (`unknown_plot`, `not_for_sale`, `cannot_buy_own`, `insufficient_gold`, `not_owner`, `invalid_price`).

#### `property_ledger`

Ownership ledger for a property: `owner_history` (names anonymized) and `sale_count`.

#### `property_auction_state`

Carries an open auction's `kind`, `current_high`, anonymized `high_bidder_name`,
`min_next`, and a non-authoritative `scheduled_close` display hint. Emitted after
`open_house_auction` / `place_house_bid` / `cancel_house_auction`.

#### `house_auction_settled`

Zone broadcast when an auction closes and settles: `property_id`, `plot_id`,
`zone`, `winner_name` (null = no bids), `seller_name` (null = primary), `price`,
`sale_count`. Emitted by the world-loop close→settle trigger. Auction truth comes
only from the `property_auction_settled` receipt, never from wall-clock.

## Contract Type Literals

This section exists to preserve the current protocol-sync verifier behavior while avoiding a false WebSocket-message claim.

#### `temple_sweep`

`temple_sweep` is not a top-level WebSocket message. Clients should not send `{ "type": "temple_sweep" }`.

Clients start the temple sweep work contract by sending:

```json
{ "type": "start_work_contract", "contract_type": "temple_sweep" }
```

The current sync script includes this heading because its extraction pattern also matches the `contract_type: 'temple_sweep'` literal. A future verifier patch should distinguish message `type` literals from contract value literals.

## Error Codes

The current shared error code union includes:

- `invalid_message`
- `not_authenticated`
- `not_in_world`
- `rate_limited`
- `kicked`
- `insufficient_gold`
- `token_invalid`
- `token_expired`
- `name_taken`
- `invalid_name`
- `banned`

These are error code values, not message types.

## Non-Claims

This document does not claim:

- all clients implement every message family
- live production deployment equals the current source tree
- DEBUG-only messages are available to normal clients
- moderation has role-based admin enforcement beyond the current DEBUG-mode gate
- generated artifacts or runtime state were rewritten by this documentation lane
- protocol compatibility was proven beyond the named source and verifier mechanisms
