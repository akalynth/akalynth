package com.akalynth.client.protocol

import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable

/**
 * Shared protocol enums + string-constant tables.
 *
 * Values mirror `packages/shared/protocol.ts` / `types.ts` (PROTOCOL_VERSION 1.1.0). The TS contract
 * is authoritative; do not diverge. Reason/status fields that are open-ended on the server are kept
 * as plain [String] on the message classes (with the known values catalogued here) so an
 * unrecognised future value never crashes decode.
 */

// types.ts: Element
@Serializable
enum class Element {
    @SerialName("fire") FIRE,
    @SerialName("water") WATER,
    @SerialName("earth") EARTH,
    @SerialName("air") AIR,
    @SerialName("light") LIGHT,
    @SerialName("shadow") SHADOW
}

// types.ts: SovereignVocation
@Serializable
enum class SovereignVocation {
    @SerialName("warden") WARDEN,
    @SerialName("cantor") CANTOR,
    @SerialName("hexer") HEXER,
    @SerialName("reaver") REAVER
}

// protocol.ts: ModerationResolution
@Serializable
enum class ModerationResolution {
    @SerialName("no_action") NO_ACTION,
    @SerialName("warning") WARNING,
    @SerialName("temp_mute") TEMP_MUTE
}

// protocol.ts: GetModReportsMessage.status
@Serializable
enum class ModReportStatus {
    @SerialName("open") OPEN,
    @SerialName("resolved") RESOLVED,
    @SerialName("all") ALL
}

/** Work-contract type strings (protocol.ts: 'temple_sweep'). */
object WorkContractType {
    const val TEMPLE_SWEEP = "temple_sweep"
}

/** Known reason/status string values from protocol.ts. Decode keeps the raw String for forward-compat. */
object RunestoneDenialReason {
    const val COOLDOWN = "cooldown"
    const val NOT_NEAR_TABLE = "not_near_table"
    const val NOT_AUTHORIZED = "not_authorized"
    const val RATE_LIMITED = "rate_limited"
}

object CombatRejectionReason {
    const val COOLDOWN = "cooldown"
    const val NOT_ADJACENT = "not_adjacent"
    const val PVP_DISABLED = "pvp_disabled"
    const val ATTACKER_DEAD = "attacker_dead"
    const val DEFENDER_DEAD = "defender_dead"
    const val DIFFERENT_MAPS = "different_maps"
    const val ATTACKER_NOT_FOUND = "attacker_not_found"
    const val DEFENDER_NOT_FOUND = "defender_not_found"
}

object PropertyStatus {
    const val UNOWNED = "unowned"
    const val OWNED = "owned"
    const val LISTED = "listed"
}

object PropertyDenialReason {
    const val UNKNOWN_PLOT = "unknown_plot"
    const val NOT_FOR_SALE = "not_for_sale"
    const val ALREADY_OWNED = "already_owned"
    const val CANNOT_BUY_OWN = "cannot_buy_own"
    const val INSUFFICIENT_GOLD = "insufficient_gold"
    const val NOT_OWNER = "not_owner"
    const val INVALID_PRICE = "invalid_price"
}

object PropertyAction {
    const val BUY_HOUSE = "buy_house"
    const val LIST_HOUSE = "list_house"
    const val UNLIST_HOUSE = "unlist_house"
}

object NpcRecognitionTier {
    const val STRANGER = "stranger"
    const val SEEN = "seen"
    const val RECOGNIZED = "recognized"
}

/** protocol.ts: ErrorCode union. Kept as String on ErrorMessage; constants for readability. */
object ErrorCode {
    const val INVALID_MESSAGE = "invalid_message"
    const val NOT_AUTHENTICATED = "not_authenticated"
    const val NOT_IN_WORLD = "not_in_world"
    const val RATE_LIMITED = "rate_limited"
    const val KICKED = "kicked"
    const val INSUFFICIENT_GOLD = "insufficient_gold"
    const val TOKEN_INVALID = "token_invalid"
    const val TOKEN_EXPIRED = "token_expired"
    const val NAME_TAKEN = "name_taken"
    const val INVALID_NAME = "invalid_name"
    const val BANNED = "banned"
}
