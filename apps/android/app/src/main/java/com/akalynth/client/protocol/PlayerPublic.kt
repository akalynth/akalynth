package com.akalynth.client.protocol

import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable

@Serializable
data class OutfitColors(
    val head: Int,
    val body: Int,
    val legs: Int,
    val feet: Int,
) {
    fun cacheKey(): String = "$head:$body:$legs:$feet"

    fun isDefault(): Boolean = head == 5 && body == 24 && legs == 36 && feet == 38
}

@Serializable
data class PlayerPublic(
    val id: String,
    val name: String,
    val x: Int,
    val y: Int,
    val status: PlayerStatus = PlayerStatus.ALIVE,
    @SerialName("dead_until_ms") val deadUntilMs: Long? = null,
    val reputation: Int? = null,
    @SerialName("sprite_id") val spriteId: String? = null,
    @SerialName("outfit_colors") val outfitColors: OutfitColors? = null,
    val loop: PlayLoopProgress? = null,
    val title: String? = null,
    val badges: List<String>? = null,
    val mark: String? = null
)

@Serializable
enum class PlayerStatus {
    @SerialName("alive") ALIVE,
    @SerialName("dead") DEAD
}
