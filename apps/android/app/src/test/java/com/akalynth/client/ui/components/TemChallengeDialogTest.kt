package com.akalynth.client.ui.components

import androidx.compose.ui.test.assertTextEquals
import androidx.compose.ui.test.junit4.createComposeRule
import androidx.compose.ui.test.onNodeWithTag
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
                    message = "Type the shown word",
                    expiresAt = System.currentTimeMillis() + 60_000,
                    onSubmit = {},
                    onDismiss = {}
                )
            }
        }

        composeTestRule.onNodeWithTag("TemChallenge_Title")
            .assertTextEquals("TEM HUMAN CHECK")
        composeTestRule.onNodeWithTag("TemChallenge_Explanation")
            .assertTextEquals("Tem keeps High City for human play. Answer the prompt to continue.")
        composeTestRule.onNodeWithTag("TemChallenge_Message")
            .assertTextEquals("Type the shown word")
    }
}
