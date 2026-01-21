package com.akalynth.client

import android.app.Activity
import android.os.Bundle
import android.os.Handler
import android.os.Looper
import android.widget.Button
import android.widget.LinearLayout
import android.widget.ScrollView
import android.widget.TextView
import com.akalynth.client.network.AkalynthClient
import com.akalynth.client.network.HealthApi
import org.json.JSONObject
import java.io.File
import java.text.SimpleDateFormat
import java.util.*

/**
 * Wire Tracer - Debug tool for capturing raw WebSocket traffic
 * No UI polish - just logs first 10 messages to screen + file
 */
class WireTracerActivity : Activity() {

    private lateinit var logView: TextView
    private lateinit var statusView: TextView
    private lateinit var connectBtn: Button
    private lateinit var moveNorthBtn: Button
    private lateinit var client: AkalynthClient

    private val mainHandler = Handler(Looper.getMainLooper())
    private val messages = mutableListOf<String>()
    private var logFile: File? = null

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)

        // Programmatic layout (no XML needed for debug tool)
        val layout = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            setPadding(16, 16, 16, 16)
        }

        statusView = TextView(this).apply {
            text = "State: DISCONNECTED"
            textSize = 14f
        }
        layout.addView(statusView)

        val btnRow = LinearLayout(this).apply {
            orientation = LinearLayout.HORIZONTAL
        }

        connectBtn = Button(this).apply {
            text = "Connect"
            setOnClickListener { connect() }
        }
        btnRow.addView(connectBtn)

        moveNorthBtn = Button(this).apply {
            text = "Move North"
            isEnabled = false
            setOnClickListener { client.move("north") }
        }
        btnRow.addView(moveNorthBtn)

        layout.addView(btnRow)

        val scroll = ScrollView(this)
        logView = TextView(this).apply {
            text = "=== Wire Tracer ===\n"
            textSize = 10f
            setTypeface(android.graphics.Typeface.MONOSPACE)
        }
        scroll.addView(logView)
        layout.addView(scroll, LinearLayout.LayoutParams(
            LinearLayout.LayoutParams.MATCH_PARENT,
            LinearLayout.LayoutParams.MATCH_PARENT
        ))

        setContentView(layout)

        // Setup log file
        logFile = File(filesDir, "wire_trace_${System.currentTimeMillis()}.log")

        // Health check first
        checkHealth()

        // Setup client
        client = AkalynthClient(listener = object : AkalynthClient.AkalynthListener {
            override fun onMessage(type: String, json: JSONObject) {
                val entry = formatMessage("RX", type, json)
                appendLog(entry)
            }

            override fun onStateChange(state: AkalynthClient.State) {
                mainHandler.post {
                    statusView.text = "State: ${state.name}"
                    moveNorthBtn.isEnabled = state == AkalynthClient.State.IN_WORLD
                    connectBtn.isEnabled = state == AkalynthClient.State.DISCONNECTED
                }
            }

            override fun onError(error: String) {
                appendLog("ERR: $error")
            }
        })
    }

    private fun checkHealth() {
        appendLog("Checking health...")
        HealthApi().check(object : HealthApi.HealthCallback {
            override fun onSuccess(health: HealthApi.HealthResponse) {
                appendLog("Health OK: v${health.version} tick=${health.tickMs}ms")
            }
            override fun onFailure(error: String) {
                appendLog("Health FAIL: $error")
            }
        })
    }

    private fun connect() {
        appendLog("Connecting to ${BuildConfig.WS_BASE_URL}...")
        client.connect()
    }

    private fun formatMessage(dir: String, type: String, json: JSONObject): String {
        val ts = SimpleDateFormat("HH:mm:ss.SSS", Locale.US).format(Date())
        val compact = json.toString().take(200)
        return "[$ts] $dir $type: $compact"
    }

    private fun appendLog(line: String) {
        messages.add(line)

        // Write to file
        logFile?.appendText("$line\n")

        // Update UI (keep last 50 lines)
        mainHandler.post {
            val display = messages.takeLast(50).joinToString("\n")
            logView.text = display
        }
    }

    override fun onDestroy() {
        super.onDestroy()
        client.disconnect()
    }
}
