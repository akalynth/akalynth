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

/**
 * Regression tests for character creation screen.
 * Maps to UI_REGRESSION_MATRIX.md Section 7: Character Creation (N1-N4)
 *
 * Contracts:
 * - N1: Name input field (max 16 chars, non-blank)
 * - N2: Sex selection (male/female toggle)
 * - N3: Sprite preview swaps on sex change
 * - N4: Create button enabled only when valid
 */
class CharacterCreateScreenTest {

    @get:Rule
    val composeTestRule = createComposeRule()

    // =========================================================================
    // N1: Name validation
    // Assertion: Name max 16 chars, non-blank required
    // =========================================================================

    @Test
    fun `N1 - name input field is displayed`() {
        composeTestRule.setContent {
            CharacterCreateScreen(onCreate = { _, _ -> })
        }

        composeTestRule.waitForIdle()

        composeTestRule.onNodeWithTag("CharacterCreateScreen_NameInput").assertIsDisplayed()
    }

    @Test
    fun `N1 - name input accepts text`() {
        var capturedName: String? = null
        var capturedSex: CharacterSex? = null

        composeTestRule.setContent {
            CharacterCreateScreen(onCreate = { name, sex ->
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
    fun `N1 - name max length is 16 characters`() {
        composeTestRule.setContent {
            CharacterCreateScreen(onCreate = { _, _ -> })
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
    fun `N1 - blank name keeps create button disabled`() {
        composeTestRule.setContent {
            CharacterCreateScreen(onCreate = { _, _ -> })
        }

        composeTestRule.waitForIdle()

        // Enter whitespace only
        composeTestRule.onNodeWithTag("CharacterCreateScreen_NameInput")
            .performTextInput("   ")

        composeTestRule.onNodeWithTag("CharacterCreateScreen_CreateButton")
            .assertIsNotEnabled()
    }

    @Test
    fun `N1 - empty name keeps create button disabled`() {
        composeTestRule.setContent {
            CharacterCreateScreen(onCreate = { _, _ -> })
        }

        composeTestRule.waitForIdle()

        // Don't enter anything
        composeTestRule.onNodeWithTag("CharacterCreateScreen_CreateButton")
            .assertIsNotEnabled()
    }

    @Test
    fun `N1 - character count displays correctly`() {
        composeTestRule.setContent {
            CharacterCreateScreen(onCreate = { _, _ -> })
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
    fun `N1 - name is trimmed on create`() {
        var capturedName: String? = null

        composeTestRule.setContent {
            CharacterCreateScreen(onCreate = { name, _ ->
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
    fun `N1 - exactly 16 characters allowed`() {
        var capturedName: String? = null

        composeTestRule.setContent {
            CharacterCreateScreen(onCreate = { name, _ ->
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
    fun `N2 - sex selector is displayed`() {
        composeTestRule.setContent {
            CharacterCreateScreen(onCreate = { _, _ -> })
        }

        composeTestRule.waitForIdle()

        composeTestRule.onNodeWithTag("CharacterCreateScreen_SexSelector").assertIsDisplayed()
        composeTestRule.onNodeWithTag("CharacterCreateScreen_Sex_MALE").assertIsDisplayed()
        composeTestRule.onNodeWithTag("CharacterCreateScreen_Sex_FEMALE").assertIsDisplayed()
    }

    @Test
    fun `N2 - male is default selection`() {
        var capturedSex: CharacterSex? = null

        composeTestRule.setContent {
            CharacterCreateScreen(onCreate = { _, sex ->
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
    fun `N2 - can select female`() {
        var capturedSex: CharacterSex? = null

        composeTestRule.setContent {
            CharacterCreateScreen(onCreate = { _, sex ->
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
    fun `N2 - can toggle back to male after selecting female`() {
        var capturedSex: CharacterSex? = null

        composeTestRule.setContent {
            CharacterCreateScreen(onCreate = { _, sex ->
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
    fun `N2 - sex selection is mutually exclusive`() {
        var capturedSex: CharacterSex? = null

        composeTestRule.setContent {
            CharacterCreateScreen(onCreate = { _, sex ->
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
    fun `N3 - sprite preview is displayed`() {
        composeTestRule.setContent {
            CharacterCreateScreen(onCreate = { _, _ -> })
        }

        composeTestRule.waitForIdle()

        composeTestRule.onNodeWithTag("CharacterCreateScreen_Preview").assertIsDisplayed()
    }

    @Test
    fun `N3 - male sprite shown by default`() {
        composeTestRule.setContent {
            CharacterCreateScreen(onCreate = { _, _ -> })
        }

        composeTestRule.waitForIdle()

        composeTestRule.onNodeWithTag("CharacterCreateScreen_SpriteId")
            .assertTextEquals("sprite_male_default")
    }

    @Test
    fun `N3 - sprite swaps to female on selection`() {
        composeTestRule.setContent {
            CharacterCreateScreen(onCreate = { _, _ -> })
        }

        composeTestRule.waitForIdle()

        // Initially male
        composeTestRule.onNodeWithTag("CharacterCreateScreen_SpriteId")
            .assertTextEquals("sprite_male_default")

        // Select female
        composeTestRule.onNodeWithTag("CharacterCreateScreen_Sex_FEMALE").performClick()

        // Sprite should swap
        composeTestRule.onNodeWithTag("CharacterCreateScreen_SpriteId")
            .assertTextEquals("sprite_female_default")
    }

    @Test
    fun `N3 - sprite swaps back to male`() {
        composeTestRule.setContent {
            CharacterCreateScreen(onCreate = { _, _ -> })
        }

        composeTestRule.waitForIdle()

        // Select female then male
        composeTestRule.onNodeWithTag("CharacterCreateScreen_Sex_FEMALE").performClick()
        composeTestRule.onNodeWithTag("CharacterCreateScreen_Sex_MALE").performClick()

        // Should be back to male sprite
        composeTestRule.onNodeWithTag("CharacterCreateScreen_SpriteId")
            .assertTextEquals("sprite_male_default")
    }

    // =========================================================================
    // N4: Create button state
    // Assertion: Enabled only when form is valid
    // =========================================================================

    @Test
    fun `N4 - create button disabled initially`() {
        composeTestRule.setContent {
            CharacterCreateScreen(onCreate = { _, _ -> })
        }

        composeTestRule.waitForIdle()

        composeTestRule.onNodeWithTag("CharacterCreateScreen_CreateButton")
            .assertIsNotEnabled()
    }

    @Test
    fun `N4 - create button enabled with valid name`() {
        composeTestRule.setContent {
            CharacterCreateScreen(onCreate = { _, _ -> })
        }

        composeTestRule.waitForIdle()

        composeTestRule.onNodeWithTag("CharacterCreateScreen_NameInput")
            .performTextInput("ValidName")

        composeTestRule.onNodeWithTag("CharacterCreateScreen_CreateButton")
            .assertIsEnabled()
    }

    @Test
    fun `N4 - create button disabled when name cleared`() {
        composeTestRule.setContent {
            CharacterCreateScreen(onCreate = { _, _ -> })
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
    fun `N4 - create emits correct name and sex`() {
        var capturedName: String? = null
        var capturedSex: CharacterSex? = null
        var callCount = 0

        composeTestRule.setContent {
            CharacterCreateScreen(onCreate = { name, sex ->
                capturedName = name
                capturedSex = sex
                callCount++
            })
        }

        composeTestRule.waitForIdle()

        // Setup: Female + "Warrior"
        composeTestRule.onNodeWithTag("CharacterCreateScreen_Sex_FEMALE").performClick()
        composeTestRule.onNodeWithTag("CharacterCreateScreen_NameInput")
            .performTextInput("Warrior")

        composeTestRule.onNodeWithTag("CharacterCreateScreen_CreateButton")
            .performClick()

        assertEquals("Warrior", capturedName)
        assertEquals(CharacterSex.FEMALE, capturedSex)
        assertEquals(1, callCount)
    }

    @Test
    fun `N4 - disabled create button does not emit`() {
        var callCount = 0

        composeTestRule.setContent {
            CharacterCreateScreen(onCreate = { _, _ ->
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
    fun `N4 - callback fires exactly once per click`() {
        var callCount = 0

        composeTestRule.setContent {
            CharacterCreateScreen(onCreate = { _, _ ->
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
    fun `screen displays title`() {
        composeTestRule.setContent {
            CharacterCreateScreen(onCreate = { _, _ -> })
        }

        composeTestRule.waitForIdle()

        composeTestRule.onNodeWithTag("CharacterCreateScreen_Title")
            .assertIsDisplayed()

        composeTestRule.onNodeWithText("Create Your Character")
            .assertIsDisplayed()
    }

    @Test
    fun `screen has proper structure`() {
        composeTestRule.setContent {
            CharacterCreateScreen(onCreate = { _, _ -> })
        }

        composeTestRule.waitForIdle()

        // All major elements present
        composeTestRule.onNodeWithTag("CharacterCreateScreen").assertIsDisplayed()
        composeTestRule.onNodeWithTag("CharacterCreateScreen_Title").assertIsDisplayed()
        composeTestRule.onNodeWithTag("CharacterCreateScreen_Preview").assertIsDisplayed()
        composeTestRule.onNodeWithTag("CharacterCreateScreen_NameInput").assertIsDisplayed()
        composeTestRule.onNodeWithTag("CharacterCreateScreen_SexSelector").assertIsDisplayed()
        composeTestRule.onNodeWithTag("CharacterCreateScreen_CreateButton").assertIsDisplayed()
    }

    @Test
    fun `create button has correct text`() {
        composeTestRule.setContent {
            CharacterCreateScreen(onCreate = { _, _ -> })
        }

        composeTestRule.waitForIdle()

        composeTestRule.onNodeWithText("CREATE CHARACTER").assertIsDisplayed()
    }

    // =========================================================================
    // Constants validation
    // =========================================================================

    @Test
    fun `MAX_NAME_LENGTH matches spec`() {
        assertEquals("MAX_NAME_LENGTH should be 16", 16, MAX_NAME_LENGTH)
    }
}
