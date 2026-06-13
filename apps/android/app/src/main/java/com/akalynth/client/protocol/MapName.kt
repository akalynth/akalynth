package com.akalynth.client.protocol

import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable

@Serializable
enum class MapName {
    @SerialName("Rookguard") ROOKGUARD,
    @SerialName("Azura") AZURA,
    @SerialName("HighCity") HIGH_CITY,

    // Client/debug-only: a local tile showcase for art verification. Never sent by the server;
    // selected only via the in-app debug toggle.
    @SerialName("__TileShowcase") TILE_SHOWCASE;

    val displayName: String
        get() = when (this) {
            ROOKGUARD -> "Rookguard"
            AZURA, HIGH_CITY -> "High City"
            TILE_SHOWCASE -> "Tile Showcase"
        }

    val isHighCityCompatible: Boolean
        get() = this == AZURA || this == HIGH_CITY
}
