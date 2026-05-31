package com.akalynth.client.protocol

import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable

// Matches packages/shared/types.ts `Direction` union exactly: 4 cardinals only.
// The server's parseClientMessage rejects any direction outside this set.
@Serializable
enum class Direction {
    @SerialName("north") NORTH,
    @SerialName("south") SOUTH,
    @SerialName("east") EAST,
    @SerialName("west") WEST;

    fun offset(): Pair<Int, Int> = when (this) {
        NORTH -> 0 to -1
        SOUTH -> 0 to 1
        EAST -> 1 to 0
        WEST -> -1 to 0
    }
}
