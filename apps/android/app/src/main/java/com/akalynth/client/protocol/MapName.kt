package com.akalynth.client.protocol

import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable

@Serializable
enum class MapName {
    @SerialName("Rookguard") ROOKGUARD,
    @SerialName("Azura") AZURA
}
