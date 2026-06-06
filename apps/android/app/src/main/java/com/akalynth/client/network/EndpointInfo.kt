package com.akalynth.client.network

import com.akalynth.client.BuildConfig

data class EndpointInfo(
    val lane: String,
    val wsUrl: String,
    val httpBaseUrl: String,
    val host: String,
    val appVersion: String = BuildConfig.VERSION_NAME,
    val buildType: String = BuildConfig.BUILD_TYPE
) {
    companion object {
        fun fromWsUrl(wsUrl: String): EndpointInfo {
            val trimmed = wsUrl.trim()
            val host = trimmed
                .removePrefix("wss://")
                .removePrefix("ws://")
                .substringBefore("/")
            val httpBaseUrl = when {
                trimmed.startsWith("wss://") -> "https://${trimmed.removePrefix("wss://").substringBefore("/")}"
                trimmed.startsWith("ws://") -> "http://${trimmed.removePrefix("ws://").substringBefore("/")}"
                else -> BuildConfig.HTTP_BASE_URL
            }

            return EndpointInfo(
                lane = laneFor(host),
                wsUrl = trimmed,
                httpBaseUrl = httpBaseUrl,
                host = host.ifBlank { "unknown" }
            )
        }

        private fun laneFor(host: String): String = when {
            host.contains("beta-api.akalynth.com", ignoreCase = true) -> "Beta"
            host.contains("staging-api.akalynth.com", ignoreCase = true) -> "Staging"
            host == "api.akalynth.com" -> "Prod"
            host.contains("10.0.2.2") || host.contains("localhost") || host.startsWith("127.") -> "Local"
            host.contains("akalynth.com", ignoreCase = true) -> "Akalynth"
            else -> "Custom"
        }
    }
}
