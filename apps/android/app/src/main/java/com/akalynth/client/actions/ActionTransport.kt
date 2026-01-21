package com.akalynth.client.actions

/**
 * Transport interface for sending action intents to the server.
 *
 * This is the seam so PR 5A-3 can plug in real networking
 * without rewriting bus logic.
 */
interface ActionTransport {
    /**
     * Send an action intent to the server.
     *
     * @param intent The stamped action intent
     */
    suspend fun send(intent: ActionIntent)
}

/**
 * No-op transport for tests.
 * Records all sent intents for verification.
 */
class NoopTransport : ActionTransport {
    private val _sent = mutableListOf<ActionIntent>()

    /** All intents sent through this transport */
    val sent: List<ActionIntent> get() = _sent.toList()

    /** Most recent intent sent */
    val lastSent: ActionIntent? get() = _sent.lastOrNull()

    /** Count of intents sent */
    val sentCount: Int get() = _sent.size

    override suspend fun send(intent: ActionIntent) {
        _sent.add(intent)
    }

    /** Clear recorded intents (for test isolation) */
    fun clear() {
        _sent.clear()
    }
}
