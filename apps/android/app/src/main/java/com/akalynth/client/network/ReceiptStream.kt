package com.akalynth.client.network

import com.akalynth.client.chronicle.Receipt
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.MutableSharedFlow
import kotlinx.coroutines.flow.asSharedFlow

/**
 * Single source of receipts for the client.
 *
 * Implementations can be:
 * - WebSocket (real-time)
 * - HTTP polling with cursor
 * - Local file tail (debug)
 *
 * Key contract:
 * - replay() gives deterministic cold-start rebuild
 * - receipts() gives ongoing live truth
 */
interface ReceiptStream {
    /**
     * Live stream of receipts.
     * Emits as receipts arrive from server.
     */
    fun receipts(): Flow<Receipt>

    /**
     * One-shot backfill/replay for cold start.
     * Returns all receipts since last cursor (or all if no cursor).
     */
    suspend fun replay(): List<Receipt> = emptyList()
}

/**
 * Fake receipt stream for tests.
 *
 * Allows controlled emission of receipts for deterministic testing.
 */
class FakeReceiptStream(
    private val replayReceipts: List<Receipt> = emptyList()
) : ReceiptStream {

    private val _flow = MutableSharedFlow<Receipt>(
        replay = 0,
        extraBufferCapacity = 64
    )

    override fun receipts(): Flow<Receipt> = _flow.asSharedFlow()

    override suspend fun replay(): List<Receipt> = replayReceipts

    /**
     * Emit a receipt to live stream (for tests).
     */
    suspend fun emit(receipt: Receipt) {
        _flow.emit(receipt)
    }

    /**
     * Try to emit without suspending.
     */
    fun tryEmit(receipt: Receipt): Boolean = _flow.tryEmit(receipt)
}
