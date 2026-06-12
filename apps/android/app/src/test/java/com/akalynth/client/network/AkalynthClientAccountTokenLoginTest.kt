package com.akalynth.client.network

import android.content.Context
import androidx.test.core.app.ApplicationProvider
import okhttp3.Request
import okhttp3.WebSocket
import okio.ByteString
import org.json.JSONObject
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Before
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner
import org.robolectric.annotation.Config

@RunWith(RobolectricTestRunner::class)
@Config(sdk = [34])
class AkalynthClientAccountTokenLoginTest {
    private lateinit var identityStore: IdentityStore
    private lateinit var socket: FakeWebSocket
    private lateinit var client: AkalynthClient

    @Before
    fun setup() {
        val context = ApplicationProvider.getApplicationContext<Context>()
        identityStore = IdentityStore(context)
        identityStore.clear()
        socket = FakeWebSocket()
        client = AkalynthClient(
            wsUrl = "ws://example.test",
            listener = object : AkalynthClient.AkalynthListener {
                override fun onMessage(type: String, json: JSONObject) = Unit
                override fun onStateChange(state: AkalynthClient.State) = Unit
                override fun onError(error: String) = Unit
            },
            identityStore = identityStore
        )
        AkalynthClient::class.java.getDeclaredField("webSocket").apply {
            isAccessible = true
            set(client, socket)
        }
    }

    @Test
    fun `stored account character token is preferred over guest login`() {
        identityStore.save(
            playerId = "char_android",
            name = "AndroidProof",
            token = "play-token-from-selected-character",
            expiresAt = System.currentTimeMillis() + 60_000
        )

        client.login(guestToken = "legacy-guest-token")

        val frame = JSONObject(socket.sent.single())
        assertEquals("login", frame.getString("type"))
        assertEquals("play-token-from-selected-character", frame.getString("token"))
        assertEquals(JSONObject.NULL, frame.get("guest_token"))
        assertFalse(frame.has("character_id"))
        assertFalse(frame.has("player_id"))
    }

    @Test
    fun `guest token is only sent when no account character token exists`() {
        client.login(guestToken = "legacy-guest-token")

        val frame = JSONObject(socket.sent.single())
        assertEquals("login", frame.getString("type"))
        assertFalse(frame.has("token"))
        assertEquals("legacy-guest-token", frame.getString("guest_token"))
        assertFalse(frame.has("character_id"))
        assertFalse(frame.has("player_id"))
    }

    private class FakeWebSocket : WebSocket {
        val sent = mutableListOf<String>()

        override fun request(): Request = Request.Builder().url("ws://example.test").build()
        override fun queueSize(): Long = 0L
        override fun send(text: String): Boolean {
            sent += text
            return true
        }
        override fun send(bytes: ByteString): Boolean = true
        override fun close(code: Int, reason: String?): Boolean = true
        override fun cancel() = Unit
    }
}
