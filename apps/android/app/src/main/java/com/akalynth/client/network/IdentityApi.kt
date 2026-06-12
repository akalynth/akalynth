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
 * Handles account character flow and auth helpers.
 */
class IdentityApi(
    private val baseUrl: String = BuildConfig.HTTP_BASE_URL
) {
    private val client = OkHttpClient.Builder()
        .callTimeout(10, TimeUnit.SECONDS)
        .build()

    private val sessionCookies = mutableMapOf<String, String>()
    private var csrfToken: String = ""

    private val endpoint = baseUrl.trimEnd('/')

    private companion object {
        private const val SESSION_COOKIE = "akalynth_session"
        private const val CSRF_COOKIE = "akalynth_csrf"
        private const val ACCOUNT_CREATE_PATH = "/v1/characters"
        private const val CHARACTER_SELECT_PATH = "/v1/characters/select"
        private const val LOGIN_PATH = "/v1/accounts/login"
        private const val WORLDS_PATH = "/v1/worlds"
        private const val OUTFITS_PATH = "/v1/outfits"
        private val VALID_WORLD_IDS = setOf("rookguard", "high_city")
        private val VALID_OUTFIT_IDS = setOf(
            "male_wanderer",
            "male_guard",
            "male_mage",
            "female_wanderer",
            "female_guard",
            "female_mage"
        )
        private val VALID_SEXES = setOf("male", "female")
    }

    data class World(
        val worldId: String,
        val name: String
    )

    data class Outfit(
        val outfitId: String,
        val sex: String,
        val name: String
    )

    data class Character(
        val characterId: String,
        val name: String,
        val worldId: String,
        val sex: String,
        val outfitId: String
    )

    data class Account(
        val accountId: String,
        val emailVerified: Boolean
    )

    sealed class LoginResult {
        data class Success(
            val account: Account,
            val csrfToken: String
        ) : LoginResult()

        data class Error(
            val code: String,
            val message: String
        ) : LoginResult()
    }

    interface LoginCallback {
        fun onResult(result: LoginResult)
    }

    interface CatalogCallback<T> {
        fun onSuccess(items: List<T>)
        fun onError(code: String, message: String)
    }

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

    fun createCharacter(name: String, worldId: String, sex: String, outfitId: String, callback: CreateCallback) {
        val sessionError = accountSessionError("creation")
        if (sessionError != null) {
            callback.onResult(sessionError)
            return
        }
        if (!VALID_WORLD_IDS.contains(worldId)) {
            callback.onResult(
                CharacterCreateResult.Error(
                    code = "invalid_input",
                    message = "Select a valid world from the server catalog."
                )
            )
            return
        }
        if (!VALID_SEXES.contains(sex) || !VALID_OUTFIT_IDS.contains(outfitId)) {
            callback.onResult(
                CharacterCreateResult.Error(
                    code = "invalid_input",
                    message = "Select a valid sex and outfit from the server catalog."
                )
            )
            return
        }
        val json = JSONObject().apply {
            put("name", name)
            put("world_id", worldId)
            put("sex", sex)
            put("outfit_id", outfitId)
        }
        postJson(
            path = ACCOUNT_CREATE_PATH,
            json = json,
            callback = callback,
            parser = { obj -> parseAccountCharacterResponse(obj) }
        )
    }

    fun selectCharacter(characterId: String, callback: CreateCallback) {
        val sessionError = accountSessionError("selection")
        if (sessionError != null) {
            callback.onResult(sessionError)
            return
        }
        val json = JSONObject().apply {
            put("character_id", characterId)
        }
        postJson(
            path = CHARACTER_SELECT_PATH,
            json = json,
            callback = callback,
            parser = { obj -> parseAccountCharacterResponse(obj) }
        )
    }

    private fun parseAccountCharacterResponse(obj: JSONObject): CharacterCreateResult {
        if (!obj.optBoolean("ok", false)) {
            return CharacterCreateResult.Error(
                code = obj.optString("error", "invalid_response"),
                message = obj.optString("message", "Character request failed.")
            )
        }
        val character = obj.optJSONObject("character") ?: return CharacterCreateResult.Error(
            code = "invalid_response",
            message = "Character response was missing character details."
        )
        val playerId = character.optString("character_id")
        val name = character.optString("name")
        val worldId = character.optString("world_id")
        val sex = character.optString("sex")
        val outfitId = character.optString("outfit_id")
        val token = obj.optString("token")
        val expiresAt = obj.optLong("expires_at", 0L)
        if (
            playerId.isBlank() ||
            name.isBlank() ||
            token.isBlank() ||
            expiresAt <= 0L ||
            !VALID_WORLD_IDS.contains(worldId) ||
            !VALID_SEXES.contains(sex) ||
            !VALID_OUTFIT_IDS.contains(outfitId)
        ) {
            return CharacterCreateResult.Error(
                code = "invalid_response",
                message = "Character response did not match the account character contract."
            )
        }
        return CharacterCreateResult.Success(
            playerId = playerId,
            name = name,
            token = token,
            issuedAt = obj.optLong("issued_at", 0L),
            expiresAt = expiresAt
        )
    }


    fun login(email: String, password: String, callback: LoginCallback) {
        if (email.isBlank() || password.isBlank()) {
            callback.onResult(LoginResult.Error(code = "invalid_input", message = "Email and password are required."))
            return
        }
        val url = "$endpoint$LOGIN_PATH"
        val json = JSONObject().apply {
            put("email", email)
            put("password", password)
        }
        val body = json.toString()
            .toRequestBody("application/json; charset=utf-8".toMediaType())
        val request = Request.Builder()
            .url(url)
            .post(body)
            .build()
        client.newCall(request).enqueue(object : Callback {
            override fun onFailure(call: Call, e: IOException) {
                callback.onResult(LoginResult.Error(code = "network_error", message = e.message ?: "Network error"))
            }

            override fun onResponse(call: Call, response: Response) {
                response.use {
                    val raw = it.body?.string() ?: ""
                    val obj = runCatching { JSONObject(raw) }.getOrNull()
                    val setCookies = it.headers("Set-Cookie")
                    if (setCookies.isNotEmpty()) {
                        storeCookies(setCookies)
                    }

                    if (it.isSuccessful && obj != null && obj.optBoolean("ok", false)) {
                        val accountObj = obj.optJSONObject("account")
                        val csrf = obj.optString("csrf_token", "").ifBlank { csrfToken }
                        if (csrf.isNotBlank()) {
                            csrfToken = csrf
                        }
                        callback.onResult(
                            LoginResult.Success(
                                account = Account(
                                    accountId = accountObj?.optString("account_id") ?: "",
                                    emailVerified = accountObj?.optBoolean("email_verified", false) == true
                                ),
                                csrfToken = csrf
                            )
                        )
                        return
                    }

                    val code = obj?.optString("error")?.takeIf { s -> s.isNotBlank() }
                        ?: obj?.optString("code")?.takeIf { s -> s.isNotBlank() }
                        ?: "http_${it.code}"
                    val message = obj?.optString("message")?.takeIf { s -> s.isNotBlank() }
                        ?: obj?.optString("error")?.takeIf { s -> s.isNotBlank() }
                        ?: "Request failed"
                    callback.onResult(LoginResult.Error(code, message))
                }
            }
        })
    }

    fun loadWorlds(callback: CatalogCallback<World>) {
        fetchCatalog(
            path = WORLDS_PATH,
            parser = { obj ->
                val arr = obj.optJSONArray("worlds") ?: return@fetchCatalog emptyList<World>()
                val out = ArrayList<World>(arr.length())
                for (i in 0 until arr.length()) {
                    val entry = arr.getJSONObject(i)
                    val worldId = entry.optString("world_id")
                    if (VALID_WORLD_IDS.contains(worldId)) {
                        out.add(World(worldId = worldId, name = entry.optString("name")))
                    }
                }
                out
            },
            callback = callback,
        )
    }

    fun loadOutfits(callback: CatalogCallback<Outfit>) {
        fetchCatalog(
            path = OUTFITS_PATH,
            parser = { obj ->
                val arr = obj.optJSONArray("outfits") ?: return@fetchCatalog emptyList<Outfit>()
                val out = ArrayList<Outfit>(arr.length())
                for (i in 0 until arr.length()) {
                    val entry = arr.getJSONObject(i)
                    val outfitId = entry.optString("outfit_id")
                    val sex = entry.optString("sex")
                    if (VALID_OUTFIT_IDS.contains(outfitId) && VALID_SEXES.contains(sex)) {
                        out.add(
                            Outfit(
                                outfitId = outfitId,
                                sex = sex,
                                name = entry.optString("name")
                            )
                        )
                    }
                }
                out
            },
            callback = callback,
        )
    }

    fun loadCharacters(callback: CatalogCallback<Character>) {
        fetchCatalog(
            path = ACCOUNT_CREATE_PATH,
            parser = { obj ->
                val arr = obj.optJSONArray("characters") ?: return@fetchCatalog emptyList<Character>()
                val out = ArrayList<Character>(arr.length())
                for (i in 0 until arr.length()) {
                    val entry = arr.getJSONObject(i)
                    val worldId = entry.optString("world_id")
                    val sex = entry.optString("sex")
                    val outfitId = entry.optString("outfit_id")
                    if (VALID_WORLD_IDS.contains(worldId) && VALID_SEXES.contains(sex) && VALID_OUTFIT_IDS.contains(outfitId)) {
                        out.add(
                            Character(
                                characterId = entry.optString("character_id"),
                                name = entry.optString("name"),
                                worldId = worldId,
                                sex = sex,
                                outfitId = outfitId
                            )
                        )
                    }
                }
                out
            },
            callback = callback,
        )
    }

    fun hasAccountSession(): Boolean = getSessionCookie().isNotBlank() && csrfToken.isNotBlank()

    private fun accountSessionError(action: String): CharacterCreateResult.Error? {
        if (getSessionCookie().isBlank()) {
            return CharacterCreateResult.Error(
                code = "not_authenticated",
                message = "Sign in required for account character $action."
            )
        }
        if (csrfToken.isBlank()) {
            return CharacterCreateResult.Error(
                code = "csrf_missing",
                message = "Security token missing. Sign in again before account character $action."
            )
        }
        return null
    }

    private fun getSessionCookie(): String = sessionCookies[SESSION_COOKIE]?.trim().orEmpty()
    private fun getCsrfCookie(): String = sessionCookies[CSRF_COOKIE]?.trim().orEmpty()

    private fun storeCookies(headers: List<String>) {
        headers.forEach { header ->
            val first = header.substringBefore(';')
            val idx = first.indexOf('=')
            if (idx <= 0) return@forEach
            val name = first.substring(0, idx).trim()
            val value = first.substring(idx + 1).trim()
            when (name) {
                SESSION_COOKIE -> sessionCookies[name] = value
                CSRF_COOKIE -> {
                    csrfToken = value
                    sessionCookies[name] = value
                }
            }
        }
    }

    private fun buildCookieHeader(): String {
        if (sessionCookies.isEmpty()) return ""
        return sessionCookies.entries.joinToString("; ") { "${it.key}=${it.value}" }
    }

    private fun postJson(
        path: String,
        json: JSONObject,
        callback: CreateCallback,
        parser: (JSONObject) -> CharacterCreateResult,
        onError: (Pair<String, String>) -> Unit = { fallback ->
            callback.onResult(CharacterCreateResult.Error(fallback.first, fallback.second))
        }
    ) {
        val body = json.toString().toRequestBody("application/json; charset=utf-8".toMediaType())
        val requestBuilder = Request.Builder()
            .url("$endpoint$path")
            .post(body)
            .header("Content-Type", "application/json; charset=utf-8")
            .header("Accept", "application/json")
        val cookieHeader = buildCookieHeader()
        if (cookieHeader.isNotEmpty()) requestBuilder.header("Cookie", cookieHeader)
        val csrf = csrfToken.ifBlank { getCsrfCookie() }
        if (csrf.isNotBlank()) requestBuilder.header("x-csrf-token", csrf)

        val request = requestBuilder.build()
        client.newCall(request).enqueue(object : Callback {
            override fun onFailure(call: Call, e: IOException) {
                onError(Pair("network_error", e.message ?: "Network error"))
            }

            override fun onResponse(call: Call, response: Response) {
                response.use {
                    val setCookies = it.headers("Set-Cookie")
                    if (setCookies.isNotEmpty()) {
                        storeCookies(setCookies)
                    }
                    val raw = it.body?.string() ?: ""
                    val obj = runCatching { JSONObject(raw) }.getOrNull()
                    if (it.isSuccessful && obj != null && obj.optBoolean("ok", false)) {
                        callback.onResult(parser(obj))
                        return
                    }

                    val code = obj?.optString("error")?.takeIf { s -> s.isNotBlank() }
                        ?: obj?.optString("code")?.takeIf { s -> s.isNotBlank() }
                        ?: "http_${it.code}"
                    val message = obj?.optString("message")?.takeIf { s -> s.isNotBlank() }
                        ?: obj?.optString("error")?.takeIf { s -> s.isNotBlank() }
                        ?: "Request failed"
                    onError(Pair(code, message))
                }
            }
        })
    }

    private fun <T> fetchCatalog(
        path: String,
        parser: (JSONObject) -> List<T>,
        callback: CatalogCallback<T>
    ) {
        val request = Request.Builder()
            .url("$endpoint$path")
            .get()
            .header("Accept", "application/json")
            .let { builder ->
                val cookieHeader = buildCookieHeader()
                if (cookieHeader.isNotEmpty()) builder.header("Cookie", cookieHeader) else builder
            }
            .build()
        client.newCall(request).enqueue(object : Callback {
            override fun onFailure(call: Call, e: IOException) {
                callback.onError("network_error", e.message ?: "Network error")
            }

            override fun onResponse(call: Call, response: Response) {
                response.use {
                    val raw = it.body?.string() ?: ""
                    val obj = runCatching { JSONObject(raw) }.getOrNull()
                    if (!it.isSuccessful || obj == null) {
                        callback.onError(
                            "http_${it.code}",
                            obj?.optString("error") ?: "Request failed"
                        )
                        return
                    }

                    runCatching { parser(obj) }
                        .onSuccess { callback.onSuccess(it) }
                        .onFailure {
                            callback.onError("parse_error", "Unexpected response from catalog API.")
                        }
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
