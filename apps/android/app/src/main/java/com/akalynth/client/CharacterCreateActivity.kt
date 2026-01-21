package com.akalynth.client

import android.app.Activity
import android.content.Intent
import android.os.Bundle
import android.os.Handler
import android.os.Looper
import android.text.InputFilter
import android.view.Gravity
import android.view.View
import android.widget.Button
import android.widget.EditText
import android.widget.LinearLayout
import android.widget.ProgressBar
import android.widget.TextView
import com.akalynth.client.network.IdentityApi
import com.akalynth.client.network.IdentityStore
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.Response
import okhttp3.WebSocket
import okhttp3.WebSocketListener
import org.json.JSONObject
import java.util.concurrent.TimeUnit

class CharacterCreateActivity : Activity() {
    private lateinit var nameInput: EditText
    private lateinit var statusText: TextView
    private lateinit var createButton: Button
    private lateinit var progress: ProgressBar

    private val mainHandler = Handler(Looper.getMainLooper())
    private val identityApi = IdentityApi()
    private lateinit var store: IdentityStore

    private var ws: WebSocket? = null
    private val wsClient = OkHttpClient.Builder()
        .readTimeout(0, TimeUnit.MILLISECONDS)
        .build()

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)

        store = IdentityStore(this)

        val root = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            gravity = Gravity.CENTER_HORIZONTAL
            setPadding(40, 60, 40, 40)
        }

        val title = TextView(this).apply {
            text = "Create Character"
            textSize = 22f
        }

        nameInput = EditText(this).apply {
            hint = "Name (3-20, A-Z 0-9 _ -)"
            filters = arrayOf(InputFilter.LengthFilter(20))
        }

        createButton = Button(this).apply {
            text = "Create"
            setOnClickListener { onCreateTapped() }
        }

        progress = ProgressBar(this).apply {
            visibility = View.GONE
        }

        statusText = TextView(this).apply {
            textSize = 14f
            setPadding(0, 20, 0, 0)
        }

        root.addView(title, LinearLayout.LayoutParams.MATCH_PARENT, LinearLayout.LayoutParams.WRAP_CONTENT)
        root.addView(nameInput, LinearLayout.LayoutParams.MATCH_PARENT, LinearLayout.LayoutParams.WRAP_CONTENT)
        root.addView(createButton, LinearLayout.LayoutParams.MATCH_PARENT, LinearLayout.LayoutParams.WRAP_CONTENT)
        root.addView(progress, LinearLayout.LayoutParams.WRAP_CONTENT, LinearLayout.LayoutParams.WRAP_CONTENT)
        root.addView(statusText, LinearLayout.LayoutParams.MATCH_PARENT, LinearLayout.LayoutParams.WRAP_CONTENT)

        setContentView(root)

        maybeAutoLogin()
    }

    override fun onDestroy() {
        ws?.close(1000, "bye")
        ws = null
        super.onDestroy()
    }

    private fun onCreateTapped() {
        val name = nameInput.text?.toString()?.trim().orEmpty()
        if (name.isBlank()) {
            setStatus("Enter a name.")
            return
        }

        setLoading(true)
        setStatus("Creating...")
        identityApi.createCharacter(name, object : IdentityApi.CreateCallback {
            override fun onResult(result: IdentityApi.CharacterCreateResult) {
                mainHandler.post {
                    when (result) {
                        is IdentityApi.CharacterCreateResult.Success -> {
                            store.save(
                                playerId = result.playerId,
                                name = result.name,
                                token = result.token,
                                expiresAt = result.expiresAt
                            )
                            setStatus("Created: ${result.name}. Connecting...")
                            connectWsAndLogin(result.token)
                        }
                        is IdentityApi.CharacterCreateResult.Error -> {
                            setLoading(false)
                            setStatus(mapError(result.code, result.message))
                        }
                    }
                }
            }
        })
    }

    private fun maybeAutoLogin() {
        if (!store.isTokenValid()) return
        val token = store.getToken() ?: return
        val name = store.getPlayerName() ?: "Adventurer"
        setLoading(true)
        setStatus("Reconnecting as $name...")
        connectWsAndLogin(token)
    }

    private fun connectWsAndLogin(token: String) {
        ws?.close(1000, "reconnect")
        val request = Request.Builder()
            .url(BuildConfig.WS_BASE_URL)
            .build()

        ws = wsClient.newWebSocket(request, object : WebSocketListener() {
            override fun onOpen(webSocket: WebSocket, response: Response) {
                // wait for welcome
            }

            override fun onMessage(webSocket: WebSocket, text: String) {
                val obj = runCatching { JSONObject(text) }.getOrNull() ?: return
                when (obj.optString("type")) {
                    "welcome" -> {
                        val login = JSONObject().apply {
                            put("type", "login")
                            put("token", token)
                            put("guest_token", JSONObject.NULL)
                        }
                        webSocket.send(login.toString())
                        mainHandler.post { setStatus("Logging in...") }
                    }
                    "login_ack" -> {
                        if (obj.optBoolean("ok", false)) {
                            val name = obj.optString("name")
                            val newToken = obj.optString("token").takeIf { it.isNotBlank() }
                            val expiresAt = obj.optLong("expires_at", store.getExpiresAt())
                            val playerId = obj.optString("player_id")

                            if (newToken != null && playerId.isNotBlank()) {
                                store.save(playerId, name, newToken, expiresAt)
                            }

                            mainHandler.post {
                                setLoading(false)
                                setStatus("Welcome, $name!")
                                mainHandler.postDelayed({
                                    startActivity(Intent(this@CharacterCreateActivity, WireTracerActivity::class.java))
                                }, 2000)
                            }
                        } else {
                            val reason = obj.optString("reason", "login failed")
                            mainHandler.post {
                                setLoading(false)
                                setStatus("Login failed: $reason")
                            }
                        }
                    }
                    "error" -> {
                        val code = obj.optString("code")
                        val msg = obj.optString("message")
                        mainHandler.post {
                            setLoading(false)
                            if (code == "token_invalid" || code == "token_expired") {
                                store.clear()
                                setStatus("Session expired. Please create a character again.")
                            } else {
                                setStatus("Error: $code - $msg")
                            }
                        }
                    }
                }
            }

            override fun onFailure(webSocket: WebSocket, t: Throwable, response: Response?) {
                mainHandler.post {
                    setLoading(false)
                    setStatus("WS failed: ${t.message ?: "unknown error"}")
                }
            }
        })
    }

    private fun setLoading(on: Boolean) {
        progress.visibility = if (on) View.VISIBLE else View.GONE
        createButton.isEnabled = !on
        nameInput.isEnabled = !on
    }

    private fun setStatus(msg: String) {
        statusText.text = msg
    }

    private fun mapError(code: String, message: String): String {
        return when (code) {
            "invalid_name" -> "Name must be 3-20 chars, start with a letter, and use only letters/numbers/-/_"
            "name_taken" -> "That name is already taken."
            "rate_limited" -> "Too many attempts. Try again later."
            "banned" -> "Account banned."
            "network_error" -> "Network error: $message"
            else -> "Error ($code): $message"
        }
    }
}
