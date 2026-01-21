package com.akalynth.client.network

import com.akalynth.client.chronicle.ChronicleStore
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Job
import kotlinx.coroutines.launch

/**
 * Receipt ingestion service - the "truth pump".
 *
 * Responsibilities:
 * 1. Replay receipts into ChronicleStore (cold start)
 * 2. Subscribe to live receipt stream
 * 3. Upsert idempotently (handled by ChronicleStore)
 *
 * This service runs once in the app container.
 * UI never calls this directly.
 */
class ReceiptIngestionService(
    private val stream: ReceiptStream,
    private val chronicle: ChronicleStore
) {
    private var job: Job? = null

    /**
     * Start the ingestion service.
     *
     * 1. Replays receipts from cold start
     * 2. Starts live subscription
     *
     * @param scope Coroutine scope for the live subscription
     * @return Job for the live subscription
     */
    suspend fun start(scope: CoroutineScope): Job {
        // 1. Replay (cold start rebuild)
        val replayReceipts = stream.replay()
        replayReceipts.forEach { receipt ->
            chronicle.upsertReceipt(receipt)
        }

        // 2. Live subscription
        val liveJob = scope.launch {
            stream.receipts().collect { receipt ->
                chronicle.upsertReceipt(receipt)
            }
        }

        job = liveJob
        return liveJob
    }

    /**
     * Stop the ingestion service.
     */
    fun stop() {
        job?.cancel()
        job = null
    }

    /**
     * Check if the service is running.
     */
    fun isRunning(): Boolean = job?.isActive == true
}
