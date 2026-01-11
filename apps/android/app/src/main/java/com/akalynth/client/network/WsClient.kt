package com.akalynth.client.network

import com.akalynth.client.protocol.ClientMessage
import com.akalynth.client.protocol.MessageSerializer
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Job
import kotlinx.coroutines.channels.Channel
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.receiveAsFlow
import kotlinx.coroutines.launch
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.Response
import okhttp3.WebSocket
import okhttp3.WebSocketListener
import java.util.concurrent.TimeUnit

class WsClient(
    initialUrl: String,
    private val scope: CoroutineScope
) {
    private var currentUrl: String = initialUrl
    private val client = OkHttpClient.Builder()
        .readTimeout(0, TimeUnit.MILLISECONDS)
        .pingInterval(30, TimeUnit.SECONDS)
        .build()

    private var webSocket: WebSocket? = null
    private val _events = Channel<WsEvent>(Channel.BUFFERED)
    val events: Flow<WsEvent> = _events.receiveAsFlow()

    private val _connectionState = MutableStateFlow<ConnectionState>(ConnectionState.Idle)
    val connectionState: StateFlow<ConnectionState> = _connectionState.asStateFlow()

    private val reconnectPolicy = ReconnectPolicy()
    private var reconnectJob: Job? = null
    private var autoReconnect = true

    fun connect() {
        if (_connectionState.value == ConnectionState.Connecting) return

        autoReconnect = true
        _connectionState.value = ConnectionState.Connecting
        val request = Request.Builder().url(currentUrl).build()

        webSocket = client.newWebSocket(request, object : WebSocketListener() {
            override fun onOpen(webSocket: WebSocket, response: Response) {
                reconnectPolicy.reset()
                _connectionState.value = ConnectionState.Connected
                scope.launch { _events.send(WsEvent.Connected) }
            }

            override fun onMessage(webSocket: WebSocket, text: String) {
                val msg = MessageSerializer.decodeServer(text)
                scope.launch { _events.send(WsEvent.MessageReceived(msg)) }
            }

            override fun onClosing(webSocket: WebSocket, code: Int, reason: String) {
                webSocket.close(1000, null)
            }

            override fun onClosed(webSocket: WebSocket, code: Int, reason: String) {
                _connectionState.value = ConnectionState.Disconnected(reason)
                scope.launch { _events.send(WsEvent.Disconnected(code, reason)) }
                if (autoReconnect) {
                    scheduleReconnect()
                }
            }

            override fun onFailure(webSocket: WebSocket, t: Throwable, response: Response?) {
                _connectionState.value = ConnectionState.Error(t.message ?: "Unknown error")
                scope.launch { _events.send(WsEvent.Error(t)) }
                if (autoReconnect) {
                    scheduleReconnect()
                }
            }
        })
    }

    fun send(message: ClientMessage) {
        val json = MessageSerializer.encodeClient(message)
        webSocket?.send(json)
    }

    fun disconnect() {
        autoReconnect = false
        reconnectJob?.cancel()
        webSocket?.close(1000, "User disconnect")
        webSocket = null
        _connectionState.value = ConnectionState.Idle
    }

    private fun scheduleReconnect() {
        reconnectJob?.cancel()
        reconnectJob = scope.launch {
            delay(reconnectPolicy.nextDelay())
            connect()
        }
    }

    fun updateState(state: ConnectionState) {
        _connectionState.value = state
    }

    fun setUrl(url: String) {
        currentUrl = url
    }
}
