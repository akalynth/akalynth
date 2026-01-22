package com.akalynth.client.protocol

import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable

@Serializable
enum class Direction {
    @SerialName("north") NORTH,
    @SerialName("south") SOUTH,
    @SerialName("east") EAST,
    @SerialName("west") WEST,
    @SerialName("northeast") NORTHEAST,
    @SerialName("northwest") NORTHWEST,
    @SerialName("southeast") SOUTHEAST,
    @SerialName("southwest") SOUTHWEST;

    fun offset(): Pair<Int, Int> = when (this) {
        NORTH -> 0 to -1
        SOUTH -> 0 to 1
        EAST -> 1 to 0
        WEST -> -1 to 0
        NORTHEAST -> 1 to -1
        NORTHWEST -> -1 to -1
        SOUTHEAST -> 1 to 1
        SOUTHWEST -> -1 to 1
    }
}
