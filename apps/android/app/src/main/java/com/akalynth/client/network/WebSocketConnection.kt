package com.akalynth.client.network

import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.MutableSharedFlow
import kotlinx.coroutines.flow.asSharedFlow

/**
 * Abstraction over WebSocket connection.
 *
 * This interface allows different WebSocket implementations
 * (OkHttp, Ktor, etc.) to be used interchangeably.
 */
interface WebSocketConnection {
    /**
     * Flow of incoming messages (raw JSON strings).
     */
    fun incoming(): Flow<String>

    /**
     * Send a message over the WebSocket.
     */
    suspend fun send(message: String)

    /**
     * Connect to the server.
     */
    suspend fun connect()

    /**
     * Disconnect from the server.
     */
    suspend fun disconnect()

    /**
     * Check if connected.
     */
    fun isConnected(): Boolean
}

/**
 * Fake WebSocket connection for tests.
 */
class FakeWebSocketConnection : WebSocketConnection {

    private val _incoming = MutableSharedFlow<String>(
        replay = 0,
        extraBufferCapacity = 64
    )

    private val _sent = mutableListOf<String>()
    private var _connected = false

    /** All messages sent through this connection */
    val sent: List<String> get() = _sent.toList()

    /** Most recent message sent */
    val lastSent: String? get() = _sent.lastOrNull()

    /** Count of messages sent */
    val sentCount: Int get() = _sent.size

    override fun incoming(): Flow<String> = _incoming.asSharedFlow()

    override suspend fun send(message: String) {
        if (!_connected) throw IllegalStateException("Not connected")
        _sent.add(message)
    }

    override suspend fun connect() {
        _connected = true
    }

    override suspend fun disconnect() {
        _connected = false
    }

    override fun isConnected(): Boolean = _connected

    /**
     * Simulate receiving a message from server.
     */
    suspend fun receiveFromServer(message: String) {
        _incoming.emit(message)
    }

    /**
     * Clear sent messages (for test isolation).
     */
    fun clear() {
        _sent.clear()
    }
}
