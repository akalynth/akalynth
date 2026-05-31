package com.akalynth.client.protocol

import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable

// 8-way direction used by the UI (DPad). The server protocol only accepts the
// 4 cardinals (packages/shared/types.ts `Direction`). Diagonals are valid for
// UI input but MUST be mapped to a cardinal before encoding on the wire — see
// MessageSerializer.encodeClient / MoveIntentMessage handling: diagonals are
// split into the horizontal or vertical component and sent as two sequential
// intents, or the primary axis cardinal is sent.
@Serializable
enum class Direction {
    @SerialName("north") NORTH,
    @SerialName("south") SOUTH,
    @SerialName("east") EAST,
    @SerialName("west") WEST,
    // UI-only diagonals — never sent directly on the wire. MessageSerializer
    // maps these: NW→NORTH (then WEST), NE→NORTH (then EAST), etc.
    @SerialName("northwest") NORTHWEST,
    @SerialName("northeast") NORTHEAST,
    @SerialName("southwest") SOUTHWEST,
    @SerialName("southeast") SOUTHEAST;

    fun offset(): Pair<Int, Int> = when (this) {
        NORTH -> 0 to -1
        SOUTH -> 0 to 1
        EAST -> 1 to 0
        WEST -> -1 to 0
        NORTHWEST -> -1 to -1
        NORTHEAST -> 1 to -1
        SOUTHWEST -> -1 to 1
        SOUTHEAST -> 1 to 1
    }

    /** Returns the two cardinal directions this diagonal decomposes to, or just [this] for cardinals. */
    fun toCardinals(): List<Direction> = when (this) {
        NORTHWEST -> listOf(NORTH, WEST)
        NORTHEAST -> listOf(NORTH, EAST)
        SOUTHWEST -> listOf(SOUTH, WEST)
        SOUTHEAST -> listOf(SOUTH, EAST)
        else -> listOf(this)
    }

    val isCardinal: Boolean get() = this in setOf(NORTH, SOUTH, EAST, WEST)
}
