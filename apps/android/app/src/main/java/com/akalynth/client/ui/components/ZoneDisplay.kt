package com.akalynth.client.ui.components

/**
 * Player-facing zone labels.
 *
 * Raw server receipts and protocol payloads may still carry the legacy Azura
 * runtime id. UI surfaces render that compatibility id as High City without
 * mutating stored evidence.
 */
fun displayZoneName(zone: String): String = when (zone) {
    "Azura", "HighCity" -> "High City"
    else -> zone
}

fun displayOptionalZoneName(zone: String?): String? = zone?.let(::displayZoneName)
