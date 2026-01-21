package com.akalynth.client.ui.components.character

import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable

/**
 * Character sex for creation and display.
 * Maps to server protocol sex field.
 */
@Serializable
enum class CharacterSex {
    @SerialName("male") MALE,
    @SerialName("female") FEMALE;

    /**
     * Display label for UI.
     */
    val displayName: String get() = when (this) {
        MALE -> "Male"
        FEMALE -> "Female"
    }

    /**
     * Sprite resource identifier (placeholder until actual assets).
     */
    val spriteId: String get() = when (this) {
        MALE -> "sprite_male_default"
        FEMALE -> "sprite_female_default"
    }
}
