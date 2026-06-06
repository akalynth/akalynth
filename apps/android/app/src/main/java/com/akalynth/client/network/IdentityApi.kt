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

    sealed class PrincipalResult {
        data class Registered(
            val principalId: String,
            val handle: String,
            val keyFingerprint: String,
            val lossWarning: String
        ) : PrincipalResult()

        data class Challenge(
            val challengeId: String,
            val canonicalPayload: String
        ) : PrincipalResult()

        data class Session(
            val principalId: String,
            val handle: String,
            val sessionToken: String,
            val expiresAt: String
        ) : PrincipalResult()

        data class Ok(val message: String) : PrincipalResult()

        data class Error(
            val code: String,
            val message: String
        ) : PrincipalResult()
    }

    interface PrincipalCallback {
        fun onResult(result: PrincipalResult)
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

    fun registerPrincipal(
        handle: String,
        publicKeySpkiPem: String,
        callback: PrincipalCallback
    ) {
        val json = JSONObject().apply {
            put("handle", handle)
            put("display_name", handle)
            put("public_key_spki_pem", publicKeySpkiPem)
            put("accepted_terms", true)
            put("client", "android")
        }
        postPrincipal("/v1/principals/register", json, null, callback) { obj ->
            val principal = obj.getJSONObject("principal")
            PrincipalResult.Registered(
                principalId = principal.optString("principal_id"),
                handle = principal.optString("handle"),
                keyFingerprint = obj.optString("key_fingerprint"),
                lossWarning = obj.optString("loss_warning")
            )
        }
    }

    fun requestPrincipalChallenge(
        principalId: String,
        purpose: String,
        callback: PrincipalCallback
    ) {
        val json = JSONObject().apply {
            put("principal_id", principalId)
            put("purpose", purpose)
            put("domain", "akalynth.com")
            put("client", "android")
        }
        postPrincipal("/v1/principals/challenge", json, null, callback) { obj ->
            PrincipalResult.Challenge(
                challengeId = obj.optString("challenge_id"),
                canonicalPayload = obj.optString("canonical_payload")
            )
        }
    }

    fun verifyPrincipalChallenge(
        principalId: String,
        challengeId: String,
        signatureBase64url: String,
        callback: PrincipalCallback
    ) {
        val json = JSONObject().apply {
            put("principal_id", principalId)
            put("challenge_id", challengeId)
            put("signature_base64url", signatureBase64url)
        }
        postPrincipal("/v1/principals/verify", json, null, callback) { obj ->
            val principal = obj.getJSONObject("principal")
            PrincipalResult.Session(
                principalId = principal.optString("principal_id"),
                handle = principal.optString("handle"),
                sessionToken = obj.optString("session_token"),
                expiresAt = obj.optString("expires_at")
            )
        }
    }

    fun blockPrincipal(
        sessionToken: String,
        targetPrincipalId: String,
        reason: String,
        callback: PrincipalCallback
    ) {
        val json = JSONObject().apply {
            put("target_principal_id", targetPrincipalId)
            put("reason", reason)
        }
        postPrincipal("/v1/principals/block", json, sessionToken, callback) {
            PrincipalResult.Ok("Principal blocked.")
        }
    }

    fun reportPrincipal(
        sessionToken: String,
        targetPrincipalId: String,
        reason: String,
        detail: String,
        callback: PrincipalCallback
    ) {
        val json = JSONObject().apply {
            put("target_principal_id", targetPrincipalId)
            put("reason", reason)
            put("detail", detail)
        }
        postPrincipal("/v1/principals/report", json, sessionToken, callback) { obj ->
            PrincipalResult.Ok("Report submitted: ${obj.optString("report_id")}")
        }
    }

    fun retirePrincipal(
        sessionToken: String,
        challengeId: String,
        signatureBase64url: String,
        callback: PrincipalCallback
    ) {
        signedPrincipalAction(
            path = "/v1/principals/retire",
            sessionToken = sessionToken,
            challengeId = challengeId,
            signatureBase64url = signatureBase64url,
            message = "Adventurer Seal retired.",
            callback = callback
        )
    }

    fun deletePrincipal(
        sessionToken: String,
        challengeId: String,
        signatureBase64url: String,
        callback: PrincipalCallback
    ) {
        signedPrincipalAction(
            path = "/v1/principals/delete-request",
            sessionToken = sessionToken,
            challengeId = challengeId,
            signatureBase64url = signatureBase64url,
            message = "Deletion request accepted.",
            callback = callback
        )
    }

    private fun signedPrincipalAction(
        path: String,
        sessionToken: String,
        challengeId: String,
        signatureBase64url: String,
        message: String,
        callback: PrincipalCallback
    ) {
        val json = JSONObject().apply {
            put("challenge_id", challengeId)
            put("signature_base64url", signatureBase64url)
        }
        postPrincipal(path, json, sessionToken, callback) {
            PrincipalResult.Ok(message)
        }
    }

    private fun postPrincipal(
        path: String,
        json: JSONObject,
        sessionToken: String?,
        callback: PrincipalCallback,
        success: (JSONObject) -> PrincipalResult
    ) {
        val requestBuilder = Request.Builder()
            .url("${baseUrl.trimEnd('/')}$path")
            .post(json.toString().toRequestBody("application/json; charset=utf-8".toMediaType()))
        if (!sessionToken.isNullOrBlank()) {
            requestBuilder.header("Authorization", "Bearer $sessionToken")
        }
        client.newCall(requestBuilder.build()).enqueue(object : Callback {
            override fun onFailure(call: Call, e: IOException) {
                callback.onResult(
                    PrincipalResult.Error(
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
                        callback.onResult(success(obj))
                        return
                    }
                    callback.onResult(
                        PrincipalResult.Error(
                            code = obj?.optString("error")?.takeIf { s -> s.isNotBlank() }
                                ?: "http_${it.code}",
                            message = obj?.optString("message")?.takeIf { s -> s.isNotBlank() }
                                ?: "Request failed"
                        )
                    )
                }
            }
        })
    }
}
