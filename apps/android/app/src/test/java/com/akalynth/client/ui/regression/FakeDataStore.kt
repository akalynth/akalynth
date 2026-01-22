package com.akalynth.client.ui.regression

import androidx.datastore.core.DataStore
import androidx.datastore.preferences.core.Preferences
import androidx.datastore.preferences.core.emptyPreferences
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.sync.Mutex
import kotlinx.coroutines.sync.withLock

/**
 * In-memory fake DataStore for unit testing.
 * Avoids instrumentation tests while maintaining identical behavior.
 *
 * Key semantics preserved:
 * - data Flow replays latest value (StateFlow behavior)
 * - updateData is atomic via Mutex (serializes concurrent writes)
 * - transform lambda can suspend
 */
class FakeDataStore(
    initialPreferences: Preferences = emptyPreferences()
) : DataStore<Preferences> {

    private val _data = MutableStateFlow(initialPreferences)
    private val mutex = Mutex()

    override val data: Flow<Preferences> = _data

    /**
     * Atomically update preferences.
     * Uses Mutex to serialize concurrent updates (matches real DataStore behavior).
     * Suspends until write completes (satisfies U6 requirement).
     */
    override suspend fun updateData(transform: suspend (Preferences) -> Preferences): Preferences {
        return mutex.withLock {
            val current = _data.value
            val newValue = transform(current)
            _data.value = newValue
            newValue
        }
    }

    /**
     * Clear all stored preferences.
     * Useful for resetting state between tests.
     */
    suspend fun clear() {
        mutex.withLock {
            _data.value = emptyPreferences()
        }
    }

    /**
     * Get current preferences synchronously (for test assertions).
     * Note: For race-free assertions, prefer collecting from data Flow.
     */
    fun currentPreferences(): Preferences = _data.value
}
