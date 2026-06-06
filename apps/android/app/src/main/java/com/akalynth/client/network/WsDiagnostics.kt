package com.akalynth.client.network

data class WsDiagnostics(
    val lastCloseCode: Int? = null,
    val lastCloseReason: String? = null,
    val reconnectAttempts: Int = 0,
    val nextBackoffMs: Long = 0L,
    val nextReconnectAtMs: Long? = null
)
