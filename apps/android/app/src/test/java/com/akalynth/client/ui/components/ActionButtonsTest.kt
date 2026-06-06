package com.akalynth.client.ui.components

import androidx.compose.ui.test.assertIsDisplayed
import androidx.compose.ui.test.junit4.createComposeRule
import androidx.compose.ui.test.onNodeWithTag
import androidx.compose.ui.test.performClick
import com.akalynth.client.actions.WorldEventSkillIds
import com.akalynth.client.ui.theme.AkalynthTheme
import org.junit.Assert.assertEquals
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner
import org.robolectric.annotation.Config

@RunWith(RobolectricTestRunner::class)
@Config(sdk = [34])
class ActionButtonsTest {
    @get:Rule
    val composeTestRule = createComposeRule()

    @Test
    fun witnessMothControlsAreOptionalByDefault() {
        composeTestRule.setContent {
            AkalynthTheme(darkTheme = true) {
                ActionButtons(onChat = {})
            }
        }
    }

    @Test
    fun witnessMothControlsEmitContributionIntentIds() {
        val contributions = mutableListOf<String>()

        composeTestRule.setContent {
            AkalynthTheme(darkTheme = true) {
                ActionButtons(
                    onChat = {},
                    showWitnessMothBloom = true,
                    onWorldEventContribution = { contributions.add(it) }
                )
            }
        }

        composeTestRule.onNodeWithTag("ActionButtons_WitnessMothBloom").assertIsDisplayed()
        composeTestRule.onNodeWithTag("ActionButtons_WitnessMoth_Verify").performClick()
        composeTestRule.onNodeWithTag("ActionButtons_WitnessMoth_Frame").performClick()
        composeTestRule.onNodeWithTag("ActionButtons_WitnessMoth_Guard").performClick()

        assertEquals(
            listOf(
                WorldEventSkillIds.VERIFY_TESTIMONY,
                WorldEventSkillIds.CRAFT_LANTERN_FRAME,
                WorldEventSkillIds.DEFEND_SCRIBES
            ),
            contributions
        )
    }
}
