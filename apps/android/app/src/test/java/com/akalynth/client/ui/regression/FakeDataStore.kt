package com.akalynth.client.ui.regression

import androidx.datastore.core.DataStore
import androidx.datastore.preferences.core.MutablePreferences
import androidx.datastore.preferences.core.Preferences
import androidx.datastore.preferences.core.emptyPreferences
import androidx.datastore.preferences.core.preferencesOf
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.updateAndGet

/**
 * In-memory fake DataStore for unit testing.
 * Avoids instrumentation tests while maintaining identical behavior.
 */
class FakeDataStore(
    initialPreferences: Preferences = emptyPreferences()
) : DataStore<Preferences> {

    private val _data = MutableStateFlow(initialPreferences)

    override val data: Flow<Preferences> = _data

    override suspend fun updateData(transform: suspend (Preferences) -> Preferences): Preferences {
        return _data.updateAndGet { current ->
            transform(current)
        }
    }

    /**
     * Clear all stored preferences.
     * Useful for resetting state between tests.
     */
    fun clear() {
        _data.value = emptyPreferences()
    }

    /**
     * Get current preferences synchronously (for test assertions).
     */
    fun currentPreferences(): Preferences = _data.value
}
