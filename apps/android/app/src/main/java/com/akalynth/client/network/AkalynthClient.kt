package com.akalynth.client.network

import com.akalynth.client.BuildConfig
import okhttp3.*
import org.json.JSONObject
import java.util.concurrent.TimeUnit

/**
 * Akalynth WebSocket Client
 * Implements CLIENT_CONTRACT_V0 handshake
 */
class AkalynthClient(
    private val wsUrl: String = BuildConfig.WS_BASE_URL,
    private val listener: AkalynthListener,
    private val identityStore: IdentityStore? = null
) {
    private val client = OkHttpClient.Builder()
        .readTimeout(0, TimeUnit.MILLISECONDS)  // No timeout for WS
        .build()

    private var webSocket: WebSocket? = null
    private var guestToken: String? = null
    private var authToken: String? = null
    private var playerId: String? = null
    private var playerName: String? = null

    // State machine
    enum class State { DISCONNECTED, CONNECTED, LOGGED_IN, IN_WORLD }
    private var state = State.DISCONNECTED

    interface AkalynthListener {
        fun onMessage(type: String, json: JSONObject)
        fun onStateChange(state: State)
        fun onError(error: String)
    }

    fun connect() {
        val request = Request.Builder()
            .url(wsUrl)
            .build()

        webSocket = client.newWebSocket(request, object : WebSocketListener() {
            override fun onOpen(ws: WebSocket, response: Response) {
                state = State.CONNECTED
                listener.onStateChange(state)
            }

            override fun onMessage(ws: WebSocket, text: String) {
                handleMessage(text)
            }

            override fun onFailure(ws: WebSocket, t: Throwable, response: Response?) {
                listener.onError("Connection failed: ${t.message}")
                state = State.DISCONNECTED
                listener.onStateChange(state)
            }

            override fun onClosed(ws: WebSocket, code: Int, reason: String) {
                state = State.DISCONNECTED
                listener.onStateChange(state)
            }
        })
    }

    private fun handleMessage(text: String) {
        val json = JSONObject(text)
        val type = json.getString("type")

        listener.onMessage(type, json)

        when (type) {
            "welcome" -> {
                // Auto-login after welcome
                login()
            }
            "login_ack" -> {
                if (json.optBoolean("ok", false)) {
                    playerId = json.getString("player_id")
                    playerName = json.getString("name")

                    val newToken = json.optString("token").takeIf { it.isNotBlank() }
                    val expiresAt = json.optLong("expires_at", -1).takeIf { it > 0 }
                    if (newToken != null && expiresAt != null) {
                        identityStore?.saveIfNewer(playerId.orEmpty(), playerName.orEmpty(), newToken, expiresAt)
                        authToken = newToken
                        guestToken = null
                    } else {
                        guestToken = json.optString("guest_token").takeIf { it.isNotBlank() }
                    }

                    state = State.LOGGED_IN
                    listener.onStateChange(state)
                    // Auto-enter world
                    enterWorld()
                } else {
                    listener.onError("Login failed: ${json.optString("reason", "unknown")}")
                }
            }
            "world_state" -> {
                state = State.IN_WORLD
                listener.onStateChange(state)
            }
            "error" -> {
                val code = json.optString("code")
                if (code == "token_invalid" || code == "token_expired") {
                    identityStore?.clear()
                    authToken = null
                    guestToken = null
                }
                listener.onError("${json.getString("code")}: ${json.getString("message")}")
            }
        }
    }

    private fun send(json: JSONObject) {
        webSocket?.send(json.toString())
    }

    fun login(authToken: String? = null, guestToken: String? = null) {
        val storedToken = identityStore?.getToken()
        val resolvedToken = listOf(authToken, this.authToken, storedToken)
            .firstOrNull { !it.isNullOrBlank() }
        val resolvedGuest = guestToken ?: this.guestToken

        send(JSONObject().apply {
            put("type", "login")
            if (!resolvedToken.isNullOrBlank()) {
                put("token", resolvedToken)
                put("guest_token", JSONObject.NULL)
            } else {
                if (resolvedGuest != null) {
                    put("guest_token", resolvedGuest)
                } else {
                    put("guest_token", JSONObject.NULL)
                }
            }
        })
    }

    fun enterWorld() {
        send(JSONObject().apply {
            put("type", "enter_world")
        })
    }

    fun move(direction: String) {
        require(direction in listOf("north", "south", "east", "west"))
        send(JSONObject().apply {
            put("type", "move_intent")
            put("direction", direction)
        })
    }

    fun chat(message: String) {
        send(JSONObject().apply {
            put("type", "chat")
            put("message", message)
        })
    }

    fun disconnect() {
        webSocket?.close(1000, "Client disconnect")
    }

    // Accessors
    fun getState() = state
    fun getPlayerId() = playerId
    fun getPlayerName() = playerName
    fun getGuestToken() = guestToken
}
