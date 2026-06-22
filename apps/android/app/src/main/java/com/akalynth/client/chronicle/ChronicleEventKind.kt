package com.akalynth.client.chronicle

import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable

/**
 * Chronicle event kinds matching server receipt types.
 * Closed enum — no stringly-typed kinds allowed.
 *
 * Canonical definition (PR-022): single source shared by domain and UI layers.
 */
@Serializable
enum class ChronicleEventKind {
    @SerialName("death") DEATH,
    @SerialName("zone_enter") ZONE_ENTER,
    @SerialName("item_pickup") ITEM_PICKUP,
    @SerialName("item_drop") ITEM_DROP,
    @SerialName("combat_kill") COMBAT_KILL,
    @SerialName("tutorial_complete") TUTORIAL_COMPLETE,
    @SerialName("character_created") CHARACTER_CREATED,
    @SerialName("world_event") WORLD_EVENT,
    @SerialName("unknown") UNKNOWN,
}