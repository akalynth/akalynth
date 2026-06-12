package com.akalynth.client.ui.regression

import androidx.compose.ui.test.assertIsDisplayed
import androidx.compose.ui.test.assertIsEnabled
import androidx.compose.ui.test.assertIsNotEnabled
import androidx.compose.ui.test.assertTextEquals
import androidx.compose.ui.test.junit4.createComposeRule
import androidx.compose.ui.test.onNodeWithTag
import androidx.compose.ui.test.onNodeWithText
import androidx.compose.ui.test.performClick
import androidx.compose.ui.test.performTextClearance
import androidx.compose.ui.test.performTextInput
import com.akalynth.client.ui.components.character.CharacterCreateScreen
import com.akalynth.client.ui.components.character.CharacterSex
import com.akalynth.client.ui.components.character.MAX_NAME_LENGTH
import org.junit.Assert.*
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith
import androidx.test.ext.junit.runners.AndroidJUnit4

/**
 * Regression tests for character creation screen.
 * Maps to UI_REGRESSION_MATRIX.md Section 7: Character Creation (N1-N4)
 *
 * Contracts:
 * - N1: Name input field (max 16 chars, non-blank)
 * - N2: World, sex, and outfit selection
 * - N3: Sprite preview swaps on sex/outfit change
 * - N4: Create button enabled only when valid
 */
@RunWith(AndroidJUnit4::class)
class CharacterCreateScreenTest {

    @get:Rule
    val composeTestRule = createComposeRule()

    // =========================================================================
    // N1: Name validation
    // Assertion: Name max 16 chars, non-blank required
    // =========================================================================

    @Test
    fun test_n1_name_input_field_is_displayed() {
        composeTestRule.setContent {
            CharacterCreateScreen(onCreate = { _, _, _, _ -> })
        }

        composeTestRule.waitForIdle()

        composeTestRule.onNodeWithTag("CharacterCreateScreen_NameInput").assertIsDisplayed()
    }

    @Test
    fun test_n1_name_input_accepts_text() {
        var capturedName: String? = null
        var capturedSex: CharacterSex? = null

        composeTestRule.setContent {
            CharacterCreateScreen(onCreate = { name, _, sex, _ ->
                capturedName = name
                capturedSex = sex
            })
        }

        composeTestRule.waitForIdle()

        // Enter name
        composeTestRule.onNodeWithTag("CharacterCreateScreen_NameInput")
            .performTextInput("TestHero")

        // Create should be enabled now
        composeTestRule.onNodeWithTag("CharacterCreateScreen_CreateButton")
            .assertIsEnabled()
            .performClick()

        assertEquals("TestHero", capturedName)
        assertNotNull(capturedSex)
    }

    @Test
    fun test_n1_name_max_length_is_16_characters() {
        composeTestRule.setContent {
            CharacterCreateScreen(onCreate = { _, _, _, _ -> })
        }

        composeTestRule.waitForIdle()

        // Try to enter more than 16 characters
        val longName = "A".repeat(20)
        composeTestRule.onNodeWithTag("CharacterCreateScreen_NameInput")
            .performTextInput(longName)

        // Character count should show 16/16 (capped)
        composeTestRule.onNodeWithTag("CharacterCreateScreen_CharCount")
            .assertTextEquals("16/$MAX_NAME_LENGTH")
    }

    @Test
    fun test_n1_blank_name_keeps_create_button_disabled() {
        composeTestRule.setContent {
            CharacterCreateScreen(onCreate = { _, _, _, _ -> })
        }

        composeTestRule.waitForIdle()

        // Enter whitespace only
        composeTestRule.onNodeWithTag("CharacterCreateScreen_NameInput")
            .performTextInput("   ")

        composeTestRule.onNodeWithTag("CharacterCreateScreen_CreateButton")
            .assertIsNotEnabled()
    }

    @Test
    fun test_n1_empty_name_keeps_create_button_disabled() {
        composeTestRule.setContent {
            CharacterCreateScreen(onCreate = { _, _, _, _ -> })
        }

        composeTestRule.waitForIdle()

        // Don't enter anything
        composeTestRule.onNodeWithTag("CharacterCreateScreen_CreateButton")
            .assertIsNotEnabled()
    }

    @Test
    fun test_n1_character_count_displays_correctly() {
        composeTestRule.setContent {
            CharacterCreateScreen(onCreate = { _, _, _, _ -> })
        }

        composeTestRule.waitForIdle()

        // Initial state
        composeTestRule.onNodeWithTag("CharacterCreateScreen_CharCount")
            .assertTextEquals("0/$MAX_NAME_LENGTH")

        // Enter 5 characters
        composeTestRule.onNodeWithTag("CharacterCreateScreen_NameInput")
            .performTextInput("Hello")

        composeTestRule.onNodeWithTag("CharacterCreateScreen_CharCount")
            .assertTextEquals("5/$MAX_NAME_LENGTH")
    }

    @Test
    fun test_n1_name_is_trimmed_on_create() {
        var capturedName: String? = null

        composeTestRule.setContent {
            CharacterCreateScreen(onCreate = { name, _, _, _ ->
                capturedName = name
            })
        }

        composeTestRule.waitForIdle()

        // Enter name with spaces
        composeTestRule.onNodeWithTag("CharacterCreateScreen_NameInput")
            .performTextInput("  Hero  ")

        composeTestRule.onNodeWithTag("CharacterCreateScreen_CreateButton")
            .performClick()

        assertEquals("Hero", capturedName)
    }

    @Test
    fun test_n1_exactly_16_characters_allowed() {
        var capturedName: String? = null

        composeTestRule.setContent {
            CharacterCreateScreen(onCreate = { name, _, _, _ ->
                capturedName = name
            })
        }

        composeTestRule.waitForIdle()

        // Enter exactly 16 characters
        val name16 = "A".repeat(16)
        composeTestRule.onNodeWithTag("CharacterCreateScreen_NameInput")
            .performTextInput(name16)

        composeTestRule.onNodeWithTag("CharacterCreateScreen_CreateButton")
            .assertIsEnabled()
            .performClick()

        assertEquals(name16, capturedName)
    }

    // =========================================================================
    // N2: Sex selection
    // Assertion: Male/female toggle works
    // =========================================================================

    @Test
    fun test_n2_sex_selector_is_displayed() {
        composeTestRule.setContent {
            CharacterCreateScreen(onCreate = { _, _, _, _ -> })
        }

        composeTestRule.waitForIdle()

        composeTestRule.onNodeWithTag("CharacterCreateScreen_SexSelector").assertIsDisplayed()
        composeTestRule.onNodeWithTag("CharacterCreateScreen_Sex_MALE").assertIsDisplayed()
        composeTestRule.onNodeWithTag("CharacterCreateScreen_Sex_FEMALE").assertIsDisplayed()
    }

    @Test
    fun test_n2_world_and_outfit_selectors_are_displayed() {
        composeTestRule.setContent {
            CharacterCreateScreen(onCreate = { _, _, _, _ -> })
        }

        composeTestRule.waitForIdle()

        composeTestRule.onNodeWithTag("CharacterCreateScreen_WorldSelector").assertIsDisplayed()
        composeTestRule.onNodeWithTag("CharacterCreateScreen_World_rookguard").assertIsDisplayed()
        composeTestRule.onNodeWithTag("CharacterCreateScreen_World_high_city").assertIsDisplayed()
        composeTestRule.onNodeWithTag("CharacterCreateScreen_OutfitSelector").assertIsDisplayed()
        composeTestRule.onNodeWithTag("CharacterCreateScreen_Outfit_male_wanderer").assertIsDisplayed()
    }

    @Test
    fun test_n2_male_is_default_selection() {
        var capturedSex: CharacterSex? = null

        composeTestRule.setContent {
            CharacterCreateScreen(onCreate = { _, _, sex, _ ->
                capturedSex = sex
            })
        }

        composeTestRule.waitForIdle()

        // Enter valid name and create
        composeTestRule.onNodeWithTag("CharacterCreateScreen_NameInput")
            .performTextInput("Hero")

        composeTestRule.onNodeWithTag("CharacterCreateScreen_CreateButton")
            .performClick()

        assertEquals(CharacterSex.MALE, capturedSex)
    }

    @Test
    fun test_n2_default_world_and_outfit_are_emitted() {
        var capturedWorldId: String? = null
        var capturedOutfitId: String? = null

        composeTestRule.setContent {
            CharacterCreateScreen(onCreate = { _, worldId, _, outfitId ->
                capturedWorldId = worldId
                capturedOutfitId = outfitId
            })
        }

        composeTestRule.waitForIdle()

        composeTestRule.onNodeWithTag("CharacterCreateScreen_NameInput")
            .performTextInput("Hero")

        composeTestRule.onNodeWithTag("CharacterCreateScreen_CreateButton")
            .performClick()

        assertEquals("rookguard", capturedWorldId)
        assertEquals("male_wanderer", capturedOutfitId)
    }

    @Test
    fun test_n2_can_select_world_and_outfit() {
        var capturedWorldId: String? = null
        var capturedOutfitId: String? = null

        composeTestRule.setContent {
            CharacterCreateScreen(onCreate = { _, worldId, _, outfitId ->
                capturedWorldId = worldId
                capturedOutfitId = outfitId
            })
        }

        composeTestRule.waitForIdle()

        composeTestRule.onNodeWithTag("CharacterCreateScreen_World_high_city").performClick()
        composeTestRule.onNodeWithTag("CharacterCreateScreen_Outfit_male_guard").performClick()
        composeTestRule.onNodeWithTag("CharacterCreateScreen_NameInput")
            .performTextInput("Guard")

        composeTestRule.onNodeWithTag("CharacterCreateScreen_CreateButton")
            .performClick()

        assertEquals("high_city", capturedWorldId)
        assertEquals("male_guard", capturedOutfitId)
    }

    @Test
    fun test_n2_can_select_female() {
        var capturedSex: CharacterSex? = null

        composeTestRule.setContent {
            CharacterCreateScreen(onCreate = { _, _, sex, _ ->
                capturedSex = sex
            })
        }

        composeTestRule.waitForIdle()

        // Select female
        composeTestRule.onNodeWithTag("CharacterCreateScreen_Sex_FEMALE")
            .performClick()

        // Enter valid name and create
        composeTestRule.onNodeWithTag("CharacterCreateScreen_NameInput")
            .performTextInput("Heroine")

        composeTestRule.onNodeWithTag("CharacterCreateScreen_CreateButton")
            .performClick()

        assertEquals(CharacterSex.FEMALE, capturedSex)
    }

    @Test
    fun test_n2_can_toggle_back_to_male_after_selecting_female() {
        var capturedSex: CharacterSex? = null

        composeTestRule.setContent {
            CharacterCreateScreen(onCreate = { _, _, sex, _ ->
                capturedSex = sex
            })
        }

        composeTestRule.waitForIdle()

        // Select female then male
        composeTestRule.onNodeWithTag("CharacterCreateScreen_Sex_FEMALE").performClick()
        composeTestRule.onNodeWithTag("CharacterCreateScreen_Sex_MALE").performClick()

        // Enter valid name and create
        composeTestRule.onNodeWithTag("CharacterCreateScreen_NameInput")
            .performTextInput("Hero")

        composeTestRule.onNodeWithTag("CharacterCreateScreen_CreateButton")
            .performClick()

        assertEquals(CharacterSex.MALE, capturedSex)
    }

    @Test
    fun test_n2_sex_selection_is_mutually_exclusive() {
        var capturedSex: CharacterSex? = null

        composeTestRule.setContent {
            CharacterCreateScreen(onCreate = { _, _, sex, _ ->
                capturedSex = sex
            })
        }

        composeTestRule.waitForIdle()

        // Select male then female - only last selection should count
        composeTestRule.onNodeWithTag("CharacterCreateScreen_Sex_MALE").performClick()
        composeTestRule.onNodeWithTag("CharacterCreateScreen_Sex_FEMALE").performClick()

        composeTestRule.onNodeWithTag("CharacterCreateScreen_NameInput")
            .performTextInput("Hero")

        composeTestRule.onNodeWithTag("CharacterCreateScreen_CreateButton")
            .performClick()

        assertEquals(CharacterSex.FEMALE, capturedSex)
    }

    // =========================================================================
    // N3: Sprite preview
    // Assertion: Sprite swaps on sex change
    // =========================================================================

    @Test
    fun test_n3_sprite_preview_is_displayed() {
        composeTestRule.setContent {
            CharacterCreateScreen(onCreate = { _, _, _, _ -> })
        }

        composeTestRule.waitForIdle()

        composeTestRule.onNodeWithTag("CharacterCreateScreen_Preview").assertIsDisplayed()
    }

    @Test
    fun test_n3_male_sprite_shown_by_default() {
        composeTestRule.setContent {
            CharacterCreateScreen(onCreate = { _, _, _, _ -> })
        }

        composeTestRule.waitForIdle()

        composeTestRule.onNodeWithTag("CharacterCreateScreen_SpriteId")
            .assertTextEquals("sprite_male_default")
    }

    @Test
    fun test_n3_sprite_swaps_to_female_on_selection() {
        composeTestRule.setContent {
            CharacterCreateScreen(onCreate = { _, _, _, _ -> })
        }

        composeTestRule.waitForIdle()

        // Initially male
        composeTestRule.onNodeWithTag("CharacterCreateScreen_SpriteId")
            .assertTextEquals("sprite_male_default")

        // Select female
        composeTestRule.onNodeWithTag("CharacterCreateScreen_Sex_FEMALE").performClick()

        // Sprite should swap
        composeTestRule.onNodeWithTag("CharacterCreateScreen_SpriteId")
            .assertTextEquals("base_human_female_01")
    }

    @Test
    fun test_n3_sprite_swaps_back_to_male() {
        composeTestRule.setContent {
            CharacterCreateScreen(onCreate = { _, _, _, _ -> })
        }

        composeTestRule.waitForIdle()

        // Select female then male
        composeTestRule.onNodeWithTag("CharacterCreateScreen_Sex_FEMALE").performClick()
        composeTestRule.onNodeWithTag("CharacterCreateScreen_Sex_MALE").performClick()

        // Should be back to male sprite
        composeTestRule.onNodeWithTag("CharacterCreateScreen_SpriteId")
            .assertTextEquals("base_human_male_01")
    }

    @Test
    fun test_n3_sprite_swaps_on_outfit_selection() {
        composeTestRule.setContent {
            CharacterCreateScreen(onCreate = { _, _, _, _ -> })
        }

        composeTestRule.waitForIdle()

        composeTestRule.onNodeWithTag("CharacterCreateScreen_Outfit_male_guard").performClick()

        composeTestRule.onNodeWithTag("CharacterCreateScreen_SpriteId")
            .assertTextEquals("guard_city_01")
    }

    // =========================================================================
    // N4: Create button state
    // Assertion: Enabled only when form is valid
    // =========================================================================

    @Test
    fun test_n4_create_button_disabled_initially() {
        composeTestRule.setContent {
            CharacterCreateScreen(onCreate = { _, _, _, _ -> })
        }

        composeTestRule.waitForIdle()

        composeTestRule.onNodeWithTag("CharacterCreateScreen_CreateButton")
            .assertIsNotEnabled()
    }

    @Test
    fun test_n4_create_button_enabled_with_valid_name() {
        composeTestRule.setContent {
            CharacterCreateScreen(onCreate = { _, _, _, _ -> })
        }

        composeTestRule.waitForIdle()

        composeTestRule.onNodeWithTag("CharacterCreateScreen_NameInput")
            .performTextInput("ValidName")

        composeTestRule.onNodeWithTag("CharacterCreateScreen_CreateButton")
            .assertIsEnabled()
    }

    @Test
    fun test_n4_create_button_disabled_when_name_cleared() {
        composeTestRule.setContent {
            CharacterCreateScreen(onCreate = { _, _, _, _ -> })
        }

        composeTestRule.waitForIdle()

        // Enter name
        composeTestRule.onNodeWithTag("CharacterCreateScreen_NameInput")
            .performTextInput("Hero")

        // Verify enabled
        composeTestRule.onNodeWithTag("CharacterCreateScreen_CreateButton")
            .assertIsEnabled()

        // Clear name
        composeTestRule.onNodeWithTag("CharacterCreateScreen_NameInput")
            .performTextClearance()

        // Verify disabled
        composeTestRule.onNodeWithTag("CharacterCreateScreen_CreateButton")
            .assertIsNotEnabled()
    }

    @Test
    fun test_n4_create_emits_correct_v2_payload() {
        var capturedName: String? = null
        var capturedWorldId: String? = null
        var capturedSex: CharacterSex? = null
        var capturedOutfitId: String? = null
        var callCount = 0

        composeTestRule.setContent {
            CharacterCreateScreen(onCreate = { name, worldId, sex, outfitId ->
                capturedName = name
                capturedWorldId = worldId
                capturedSex = sex
                capturedOutfitId = outfitId
                callCount++
            })
        }

        composeTestRule.waitForIdle()

        // Setup: Female + "Warrior"
        composeTestRule.onNodeWithTag("CharacterCreateScreen_World_high_city").performClick()
        composeTestRule.onNodeWithTag("CharacterCreateScreen_Sex_FEMALE").performClick()
        composeTestRule.onNodeWithTag("CharacterCreateScreen_Outfit_female_mage").performClick()
        composeTestRule.onNodeWithTag("CharacterCreateScreen_NameInput")
            .performTextInput("Warrior")

        composeTestRule.onNodeWithTag("CharacterCreateScreen_CreateButton")
            .performClick()

        assertEquals("Warrior", capturedName)
        assertEquals("high_city", capturedWorldId)
        assertEquals(CharacterSex.FEMALE, capturedSex)
        assertEquals("female_mage", capturedOutfitId)
        assertEquals(1, callCount)
    }

    @Test
    fun test_n4_disabled_create_button_does_not_emit() {
        var callCount = 0

        composeTestRule.setContent {
            CharacterCreateScreen(onCreate = { _, _, _, _ ->
                callCount++
            })
        }

        composeTestRule.waitForIdle()

        // Try clicking disabled button
        composeTestRule.onNodeWithTag("CharacterCreateScreen_CreateButton")
            .performClick()

        assertEquals(0, callCount)
    }

    @Test
    fun test_n4_callback_fires_exactly_once_per_click() {
        var callCount = 0

        composeTestRule.setContent {
            CharacterCreateScreen(onCreate = { _, _, _, _ ->
                callCount++
            })
        }

        composeTestRule.waitForIdle()

        composeTestRule.onNodeWithTag("CharacterCreateScreen_NameInput")
            .performTextInput("Hero")

        composeTestRule.onNodeWithTag("CharacterCreateScreen_CreateButton")
            .performClick()

        assertEquals(1, callCount)
    }

    // =========================================================================
    // Screen structure
    // =========================================================================

    @Test
    fun test_screen_displays_title() {
        composeTestRule.setContent {
            CharacterCreateScreen(onCreate = { _, _, _, _ -> })
        }

        composeTestRule.waitForIdle()

        composeTestRule.onNodeWithTag("CharacterCreateScreen_Title")
            .assertIsDisplayed()

        composeTestRule.onNodeWithText("Create Your Character")
            .assertIsDisplayed()
    }

    @Test
    fun test_screen_has_proper_structure() {
        composeTestRule.setContent {
            CharacterCreateScreen(onCreate = { _, _, _, _ -> })
        }

        composeTestRule.waitForIdle()

        // All major elements present
        composeTestRule.onNodeWithTag("CharacterCreateScreen").assertIsDisplayed()
        composeTestRule.onNodeWithTag("CharacterCreateScreen_Title").assertIsDisplayed()
        composeTestRule.onNodeWithTag("CharacterCreateScreen_Preview").assertIsDisplayed()
        composeTestRule.onNodeWithTag("CharacterCreateScreen_NameInput").assertIsDisplayed()
        composeTestRule.onNodeWithTag("CharacterCreateScreen_WorldSelector").assertIsDisplayed()
        composeTestRule.onNodeWithTag("CharacterCreateScreen_SexSelector").assertIsDisplayed()
        composeTestRule.onNodeWithTag("CharacterCreateScreen_OutfitSelector").assertIsDisplayed()
        composeTestRule.onNodeWithTag("CharacterCreateScreen_CreateButton").assertIsDisplayed()
    }

    @Test
    fun test_create_button_has_correct_text() {
        composeTestRule.setContent {
            CharacterCreateScreen(onCreate = { _, _, _, _ -> })
        }

        composeTestRule.waitForIdle()

        composeTestRule.onNodeWithText("CREATE CHARACTER").assertIsDisplayed()
    }

    // =========================================================================
    // Constants validation
    // =========================================================================

    @Test
    fun test_max_name_length_matches_spec() {
        assertEquals("MAX_NAME_LENGTH should be 16", 16, MAX_NAME_LENGTH)
    }
}
