package com.akalynth.client.ui.components

import androidx.compose.ui.test.assertIsDisplayed
import androidx.compose.ui.test.assertTextEquals
import androidx.compose.ui.test.junit4.createComposeRule
import androidx.compose.ui.test.onNodeWithTag
import com.akalynth.client.game.TemContracts
import com.akalynth.client.ui.theme.AkalynthTheme
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner
import org.robolectric.annotation.Config

@RunWith(RobolectricTestRunner::class)
@Config(sdk = [34])
class TemChallengeDialogTest {
    @get:Rule
    val composeTestRule = createComposeRule()

    @Test
    fun temCopyExplainsHumanPlayWithoutDetectionDetails() {
        composeTestRule.setContent {
            AkalynthTheme(darkTheme = true) {
                TemChallengeDialog(
                    message = "Type AKALYNTH to confirm you are playing by hand. You have 15 seconds.",
                    expiresAt = System.currentTimeMillis() + 60_000,
                    onSubmit = {},
                    onDismiss = {}
                )
            }
        }

        composeTestRule.onNodeWithTag("TemChallenge_Title")
            .assertTextEquals("Quick human check")
        composeTestRule.onNodeWithTag("TemChallenge_Explanation").assertIsDisplayed()
        composeTestRule.onNodeWithTag("TemChallenge_AnswerWord")
            .assertTextEquals(TemContracts.CHALLENGE_RESPONSE)
        composeTestRule.onNodeWithTag("TemChallenge_QuickConfirm").assertIsDisplayed()
    }
}