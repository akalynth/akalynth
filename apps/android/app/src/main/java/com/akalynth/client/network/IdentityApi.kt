package com.akalynth.client.network

import com.akalynth.client.BuildConfig
import okhttp3.Call
import okhttp3.Callback
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.RequestBody.Companion.toRequestBody
import okhttp3.Response
import org.json.JSONObject
import java.io.IOException
import java.util.concurrent.TimeUnit

/**
 * Akalynth Identity API
 * POST /v1/characters/create
 */
class IdentityApi(
    private val baseUrl: String = BuildConfig.HTTP_BASE_URL
) {
    data class CharacterCreateRequest(val name: String)

    sealed class CharacterCreateResult {
        data class Success(
            val playerId: String,
            val name: String,
            val token: String,
            val issuedAt: Long,
            val expiresAt: Long
        ) : CharacterCreateResult()

        data class Error(
            val code: String,
            val message: String
        ) : CharacterCreateResult()
    }

    interface CreateCallback {
        fun onResult(result: CharacterCreateResult)
    }

    private val client = OkHttpClient.Builder()
        .callTimeout(10, TimeUnit.SECONDS)
        .build()

    fun createCharacter(name: String, callback: CreateCallback) {
        val url = "${baseUrl.trimEnd('/')}/v1/characters/create"
        val json = JSONObject().apply {
            put("name", name)
        }
        val body = json.toString()
            .toRequestBody("application/json; charset=utf-8".toMediaType())

        val request = Request.Builder()
            .url(url)
            .post(body)
            .build()

        client.newCall(request).enqueue(object : Callback {
            override fun onFailure(call: Call, e: IOException) {
                callback.onResult(
                    CharacterCreateResult.Error(
                        code = "network_error",
                        message = e.message ?: "Network error"
                    )
                )
            }

            override fun onResponse(call: Call, response: Response) {
                response.use {
                    val raw = it.body?.string() ?: ""
                    val obj = runCatching { JSONObject(raw) }.getOrNull()

                    if (it.isSuccessful && obj != null && obj.optBoolean("ok", false)) {
                        callback.onResult(
                            CharacterCreateResult.Success(
                                playerId = obj.optString("player_id"),
                                name = obj.optString("name"),
                                token = obj.optString("token"),
                                issuedAt = obj.optLong("issued_at"),
                                expiresAt = obj.optLong("expires_at")
                            )
                        )
                        return
                    }

                    val code = obj?.optString("code")?.takeIf { s -> s.isNotBlank() }
                        ?: "http_${it.code}"
                    val message = obj?.optString("message")?.takeIf { s -> s.isNotBlank() }
                        ?: "Request failed"
                    callback.onResult(CharacterCreateResult.Error(code, message))
                }
            }
        })
    }
}
