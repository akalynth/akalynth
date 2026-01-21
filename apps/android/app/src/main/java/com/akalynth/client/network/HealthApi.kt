package com.akalynth.client.network

import com.akalynth.client.BuildConfig
import okhttp3.*
import org.json.JSONObject
import java.io.IOException

/**
 * Akalynth Health API
 * GET /v1/health
 */
class HealthApi(
    private val baseUrl: String = BuildConfig.HTTP_BASE_URL
) {
    private val client = OkHttpClient()

    data class HealthResponse(
        val ok: Boolean,
        val version: String,
        val tickMs: Int,
        val nowIso: String
    )

    interface HealthCallback {
        fun onSuccess(health: HealthResponse)
        fun onFailure(error: String)
    }

    fun check(callback: HealthCallback) {
        val request = Request.Builder()
            .url("$baseUrl/v1/health")
            .build()

        client.newCall(request).enqueue(object : Callback {
            override fun onFailure(call: Call, e: IOException) {
                callback.onFailure("Network error: ${e.message}")
            }

            override fun onResponse(call: Call, response: Response) {
                if (!response.isSuccessful) {
                    callback.onFailure("HTTP ${response.code}")
                    return
                }

                val body = response.body?.string() ?: "{}"
                val json = JSONObject(body)

                callback.onSuccess(HealthResponse(
                    ok = json.getBoolean("ok"),
                    version = json.getString("version"),
                    tickMs = json.getInt("tick_ms"),
                    nowIso = json.getString("now_iso")
                ))
            }
        })
    }

    fun checkSync(): HealthResponse? {
        val request = Request.Builder()
            .url("$baseUrl/v1/health")
            .build()

        return try {
            val response = client.newCall(request).execute()
            if (!response.isSuccessful) return null

            val json = JSONObject(response.body?.string() ?: "{}")
            HealthResponse(
                ok = json.getBoolean("ok"),
                version = json.getString("version"),
                tickMs = json.getInt("tick_ms"),
                nowIso = json.getString("now_iso")
            )
        } catch (e: Exception) {
            null
        }
    }
}
