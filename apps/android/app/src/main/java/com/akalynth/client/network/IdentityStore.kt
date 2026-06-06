package com.akalynth.client.network

import android.content.Context

class IdentityStore(context: Context) {
    companion object {
        private const val PREFS_NAME = "akalynth_identity"
        private const val KEY_TOKEN = "auth_token"
        private const val KEY_PLAYER_ID = "player_id"
        private const val KEY_PLAYER_NAME = "player_name"
        private const val KEY_EXPIRES_AT = "expires_at"
        private const val KEY_PRINCIPAL_ID = "principal_id"
        private const val KEY_PRINCIPAL_HANDLE = "principal_handle"
        private const val KEY_PRINCIPAL_SESSION_TOKEN = "principal_session_token"
        private const val KEY_PRINCIPAL_SESSION_EXPIRES_AT = "principal_session_expires_at"
    }

    private val prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)

    fun save(playerId: String, name: String, token: String, expiresAt: Long) {
        prefs.edit()
            .putString(KEY_PLAYER_ID, playerId)
            .putString(KEY_PLAYER_NAME, name)
            .putString(KEY_TOKEN, token)
            .putLong(KEY_EXPIRES_AT, expiresAt)
            .apply()
    }

    fun saveIfNewer(
        playerId: String,
        name: String,
        token: String,
        expiresAt: Long,
        nowMs: Long = System.currentTimeMillis()
    ): Boolean {
        if (token.isBlank() || expiresAt <= 0L) return false

        val currentToken = getToken()
        val currentExpiresAt = getExpiresAt()
        val shouldUpdate = expiresAt > currentExpiresAt || (token != currentToken && expiresAt > nowMs)
        if (!shouldUpdate) return false

        val resolvedPlayerId = playerId.ifBlank { getPlayerId().orEmpty() }
        val resolvedName = name.ifBlank { getPlayerName().orEmpty() }
        if (resolvedPlayerId.isBlank() || resolvedName.isBlank()) return false

        save(resolvedPlayerId, resolvedName, token, expiresAt)
        return true
    }

    fun getToken(): String? = prefs.getString(KEY_TOKEN, null)
    fun getPlayerId(): String? = prefs.getString(KEY_PLAYER_ID, null)
    fun getPlayerName(): String? = prefs.getString(KEY_PLAYER_NAME, null)
    fun getExpiresAt(): Long = prefs.getLong(KEY_EXPIRES_AT, 0L)

    fun savePrincipal(
        principalId: String,
        handle: String,
        sessionToken: String,
        expiresAtIso: String
    ) {
        prefs.edit()
            .putString(KEY_PRINCIPAL_ID, principalId)
            .putString(KEY_PRINCIPAL_HANDLE, handle)
            .putString(KEY_PRINCIPAL_SESSION_TOKEN, sessionToken)
            .putString(KEY_PRINCIPAL_SESSION_EXPIRES_AT, expiresAtIso)
            .apply()
    }

    fun getPrincipalId(): String? = prefs.getString(KEY_PRINCIPAL_ID, null)
    fun getPrincipalHandle(): String? = prefs.getString(KEY_PRINCIPAL_HANDLE, null)
    fun getPrincipalSessionToken(): String? = prefs.getString(KEY_PRINCIPAL_SESSION_TOKEN, null)
    fun getPrincipalSessionExpiresAt(): String? = prefs.getString(KEY_PRINCIPAL_SESSION_EXPIRES_AT, null)

    fun isTokenValid(nowMs: Long = System.currentTimeMillis()): Boolean {
        val token = getToken() ?: return false
        val exp = getExpiresAt()
        return token.isNotBlank() && exp > nowMs
    }

    fun clear() {
        prefs.edit().clear().apply()
    }

    fun clearPrincipal() {
        prefs.edit()
            .remove(KEY_PRINCIPAL_ID)
            .remove(KEY_PRINCIPAL_HANDLE)
            .remove(KEY_PRINCIPAL_SESSION_TOKEN)
            .remove(KEY_PRINCIPAL_SESSION_EXPIRES_AT)
            .apply()
    }
}
