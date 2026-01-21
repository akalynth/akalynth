package com.akalynth.client.network

import android.content.Context

class IdentityStore(context: Context) {
    companion object {
        private const val PREFS_NAME = "akalynth_identity"
        private const val KEY_TOKEN = "auth_token"
        private const val KEY_PLAYER_ID = "player_id"
        private const val KEY_PLAYER_NAME = "player_name"
        private const val KEY_EXPIRES_AT = "expires_at"
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

    fun getToken(): String? = prefs.getString(KEY_TOKEN, null)
    fun getPlayerId(): String? = prefs.getString(KEY_PLAYER_ID, null)
    fun getPlayerName(): String? = prefs.getString(KEY_PLAYER_NAME, null)
    fun getExpiresAt(): Long = prefs.getLong(KEY_EXPIRES_AT, 0L)

    fun isTokenValid(nowMs: Long = System.currentTimeMillis()): Boolean {
        val token = getToken() ?: return false
        val exp = getExpiresAt()
        return token.isNotBlank() && exp > nowMs
    }

    fun clear() {
        prefs.edit().clear().apply()
    }
}
