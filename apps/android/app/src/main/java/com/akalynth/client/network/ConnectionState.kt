package com.akalynth.client.network

sealed class ConnectionState {
    data object Idle : ConnectionState()
    data object Connecting : ConnectionState()
    data object Connected : ConnectionState()
    data object Authenticating : ConnectionState()
    data object InWorld : ConnectionState()
    data class Disconnected(val reason: String) : ConnectionState()
    data class Error(val message: String) : ConnectionState()
}
