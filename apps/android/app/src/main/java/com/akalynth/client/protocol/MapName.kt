package com.akalynth.client.protocol

import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable

@Serializable
enum class MapName {
    @SerialName("Rookguard") ROOKGUARD,
    @SerialName("Azura") AZURA,
    @SerialName("HighCity") HIGH_CITY;

    val displayName: String
        get() = when (this) {
            ROOKGUARD -> "Rookguard"
            AZURA, HIGH_CITY -> "High City"
        }

    val isHighCityCompatible: Boolean
        get() = this == AZURA || this == HIGH_CITY
}
