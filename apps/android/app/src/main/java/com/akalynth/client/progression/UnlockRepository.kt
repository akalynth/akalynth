package com.akalynth.client.progression

import androidx.datastore.core.DataStore
import androidx.datastore.preferences.core.Preferences
import androidx.datastore.preferences.core.booleanPreferencesKey
import androidx.datastore.preferences.core.edit
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.catch
import kotlinx.coroutines.flow.map
import java.io.IOException

/**
 * Repository for persistent unlock state.
 * Maps to UI_REGRESSION_MATRIX.md Section 4: U6 (DataStore persistence).
 *
 * Design decisions:
 * - Injectable DataStore for testability (can use fake in tests)
 * - Suspend functions ensure write completes before returning
 * - Flow-based reads for reactive UI updates
 * - IOException handling for corrupted DataStore
 */
class UnlockRepository(
    private val dataStore: DataStore<Preferences>
) {
    private object Keys {
        val HAS_ENGAGED_COMBAT = booleanPreferencesKey("has_engaged_combat")
        val HAS_PICKED_UP_ITEM = booleanPreferencesKey("has_picked_up_item")
        val HAS_DIED = booleanPreferencesKey("has_died")
    }

    /**
     * Flow of current unlock state.
     * Emits new value whenever any flag changes.
     * Returns DEFAULT on read errors (fail-safe for corrupted store).
     */
    val unlockState: Flow<UnlockState> = dataStore.data
        .catch { exception ->
            if (exception is IOException) {
                // Corrupted DataStore - return default
                emit(androidx.datastore.preferences.core.emptyPreferences())
            } else {
                throw exception
            }
        }
        .map { preferences ->
            UnlockState(
                hasEngagedCombat = preferences[Keys.HAS_ENGAGED_COMBAT] ?: false,
                hasPickedUpItem = preferences[Keys.HAS_PICKED_UP_ITEM] ?: false,
                hasDied = preferences[Keys.HAS_DIED] ?: false
            )
        }

    /**
     * Record that player engaged in combat.
     * Suspends until write is confirmed (U6 requirement).
     * Idempotent: safe to call multiple times.
     */
    suspend fun recordCombat() {
        dataStore.edit { preferences ->
            preferences[Keys.HAS_ENGAGED_COMBAT] = true
        }
    }

    /**
     * Record that player picked up an item.
     * Suspends until write is confirmed (U6 requirement).
     * Idempotent: safe to call multiple times.
     */
    suspend fun recordItemPickup() {
        dataStore.edit { preferences ->
            preferences[Keys.HAS_PICKED_UP_ITEM] = true
        }
    }

    /**
     * Record that player died.
     * Suspends until write is confirmed (U6 requirement).
     * Idempotent: safe to call multiple times.
     */
    suspend fun recordDeath() {
        dataStore.edit { preferences ->
            preferences[Keys.HAS_DIED] = true
        }
    }
}
