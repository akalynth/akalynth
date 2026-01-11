package com.akalynth.client.protocol

import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable

@Serializable
enum class WitnessResponse {
    @SerialName("confirm") CONFIRM,
    @SerialName("deny") DENY,
    @SerialName("uncertain") UNCERTAIN
}
