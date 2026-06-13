package com.akalynth.client.ui.render

import android.content.Context
import android.os.Build
import android.os.PowerManager
import androidx.compose.runtime.Composable
import androidx.compose.runtime.DisposableEffect
import androidx.compose.runtime.State
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.platform.LocalView

/**
 * A thermal-aware render frame-rate target. Starts at [baseFps] and steps down as the device's
 * thermal status rises, shedding CPU/GPU work to protect battery and pre-empt throttling. The
 * value drives [RenderClock]'s pacing, so a hot device simply recomposes the world less often.
 *
 * Falls back to a constant [baseFps] below API 29 (thermal status unavailable).
 */
@Composable
fun rememberThermalTargetFps(baseFps: Int = 30): State<Int> {
    val context = LocalContext.current
    val target = remember { mutableStateOf(baseFps) }
    DisposableEffect(context, baseFps) {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.Q) {
            target.value = baseFps
            return@DisposableEffect onDispose { }
        }
        val pm = context.getSystemService(Context.POWER_SERVICE) as PowerManager
        val listener = PowerManager.OnThermalStatusChangedListener { status ->
            target.value = fpsForThermalStatus(status, baseFps)
        }
        target.value = fpsForThermalStatus(pm.currentThermalStatus, baseFps)
        pm.addThermalStatusListener(context.mainExecutor, listener)
        onDispose { pm.removeThermalStatusListener(listener) }
    }
    return target
}

private fun fpsForThermalStatus(status: Int, baseFps: Int): Int = when {
    status >= PowerManager.THERMAL_STATUS_SEVERE -> 15
    status == PowerManager.THERMAL_STATUS_MODERATE -> 20
    else -> baseFps
}

/**
 * Hint the platform that this surface only needs [fps] frames per second, so it can lower the
 * display refresh rate (and power draw) accordingly. Uses the Android 15 (API 35)
 * `View.setRequestedFrameRate` API; a no-op on older platforms, where the [RenderClock] throttle
 * still caps how often we actually draw.
 */
@Composable
fun ApplyRequestedFrameRate(fps: Int) {
    val view = LocalView.current
    DisposableEffect(view, fps) {
        if (Build.VERSION.SDK_INT >= 35) {
            val original = view.requestedFrameRate
            view.requestedFrameRate = fps.toFloat()
            onDispose { view.requestedFrameRate = original }
        } else {
            onDispose { }
        }
    }
}
