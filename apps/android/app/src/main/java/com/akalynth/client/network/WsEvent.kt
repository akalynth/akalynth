package com.akalynth.client.network

import com.akalynth.client.protocol.ServerMessage

sealed class WsEvent {
    data object Connected : WsEvent()
    data class MessageReceived(val message: ServerMessage) : WsEvent()
    data class Disconnected(val code: Int, val reason: String) : WsEvent()
    data class Error(val throwable: Throwable) : WsEvent()
}
