package com.akalynth.client.network

import com.akalynth.client.BuildConfig
import okhttp3.OkHttpClient
import okhttp3.Request
import org.json.JSONObject

/**
 * GET /v1/client/android-update?lane=beta
 */
class ClientUpdateApi(
    private val baseUrl: String = BuildConfig.HTTP_BASE_URL,
    private val lane: String = BuildConfig.BUILD_TYPE,
    private val client: OkHttpClient = OkHttpClient()
) {
    data class UpdateManifest(
        val lane: String,
        val versionCode: Int,
        val versionName: String,
        val apkUrl: String,
        val apkSha256: String,
        val sizeBytes: Long,
        val required: Boolean,
        val publishedAt: String,
        // Extended per AKALYNTH_ANDROID_SIGNING_POLICY_V1 metadata contract
        val releaseNotes: String? = null,
        val compatibleServerCommit: String? = null,
        val minServerCommit: String? = null,
        val signingCertificateSha256: String? = null,
        val channel: String? = null
    )

    fun fetchManifest(): UpdateManifest? {
        if (lane != "beta" && lane != "staging") return null

        val request = Request.Builder()
            .url("$baseUrl/v1/client/android-update?lane=$lane")
            .build()

        return try {
            client.newCall(request).execute().use { response ->
                if (!response.isSuccessful) return null
                val json = JSONObject(response.body?.string() ?: return null)
                UpdateManifest(
                    lane = json.getString("lane"),
                    versionCode = json.getInt("version_code"),
                    versionName = json.getString("version_name"),
                    apkUrl = json.getString("apk_url"),
                    apkSha256 = json.getString("apk_sha256"),
                    sizeBytes = json.getLong("size_bytes"),
                    required = json.optBoolean("required", false),
                    publishedAt = json.getString("published_at"),
                    // Parse extended fields (flexible key names) per policy metadata contract.
                    // These are optional and not required for the direct download path.
                    releaseNotes = listOf("releaseNotes", "release_notes").firstNotNullOfOrNull { k ->
                        if (json.has(k)) json.optString(k).takeIf { it.isNotBlank() } else null
                    },
                    compatibleServerCommit = listOf("compatible_server_commit", "compatibleServerCommit").firstNotNullOfOrNull { k ->
                        if (json.has(k)) json.optString(k).takeIf { it.isNotBlank() } else null
                    },
                    minServerCommit = listOf("min_server_commit", "minServerCommit").firstNotNullOfOrNull { k ->
                        if (json.has(k)) json.optString(k).takeIf { it.isNotBlank() } else null
                    },
                    signingCertificateSha256 = listOf("signingCertificateSha256", "signing_certificate_sha256").firstNotNullOfOrNull { k ->
                        if (json.has(k)) json.optString(k).takeIf { it.isNotBlank() } else null
                    },
                    channel = listOf("channel", "lane").firstNotNullOfOrNull { k ->
                        if (json.has(k)) json.optString(k).takeIf { it.isNotBlank() } else null
                    }
                )
            }
        } catch (_: Exception) {
            null
        }
    }
}