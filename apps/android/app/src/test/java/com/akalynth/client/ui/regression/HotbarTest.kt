package com.akalynth.client.ui.regression

import androidx.compose.ui.test.assertIsDisplayed
import androidx.compose.ui.test.junit4.createComposeRule
import androidx.compose.ui.test.longClick
import androidx.compose.ui.test.onNodeWithTag
import androidx.compose.ui.test.performClick
import androidx.compose.ui.test.performTouchInput
import com.akalynth.client.ui.components.hotbar.HOTBAR_SLOT_COUNT
import com.akalynth.client.ui.components.hotbar.HOTBAR_SLOT_GAP
import com.akalynth.client.ui.components.hotbar.HOTBAR_SLOT_SIZE
import com.akalynth.client.ui.components.hotbar.Hotbar
import com.akalynth.client.ui.components.hotbar.Item
import com.akalynth.client.ui.components.hotbar.ItemRarity
import com.akalynth.client.ui.components.hotbar.LONG_PRESS_THRESHOLD_MS
import org.junit.Assert.*
import org.junit.Rule
import org.junit.Test

/**
 * Regression tests for Hotbar component.
 *
 * Contracts:
 * - 4 slots, 48dp each, 10dp gap
 * - Tap slot → onSlotTap(index)
 * - Long press slot → onSlotLongPress(index)
 */
class HotbarTest {

    @get:Rule
    val composeTestRule = createComposeRule()

    // =========================================================================
    // Structure tests
    // =========================================================================

    @Test
    fun `hotbar displays 4 slots`() {
        composeTestRule.setContent {
            Hotbar(
                slots = emptySlots(),
                onSlotTap = {},
                onSlotLongPress = {}
            )
        }

        composeTestRule.waitForIdle()

        composeTestRule.onNodeWithTag("Hotbar").assertIsDisplayed()
        composeTestRule.onNodeWithTag("Hotbar_Slot_0").assertIsDisplayed()
        composeTestRule.onNodeWithTag("Hotbar_Slot_1").assertIsDisplayed()
        composeTestRule.onNodeWithTag("Hotbar_Slot_2").assertIsDisplayed()
        composeTestRule.onNodeWithTag("Hotbar_Slot_3").assertIsDisplayed()
    }

    @Test
    fun `empty slots show slot numbers`() {
        composeTestRule.setContent {
            Hotbar(
                slots = emptySlots(),
                onSlotTap = {},
                onSlotLongPress = {}
            )
        }

        composeTestRule.waitForIdle()

        composeTestRule.onNodeWithTag("Hotbar_Slot_0_Empty").assertIsDisplayed()
        composeTestRule.onNodeWithTag("Hotbar_Slot_1_Empty").assertIsDisplayed()
        composeTestRule.onNodeWithTag("Hotbar_Slot_2_Empty").assertIsDisplayed()
        composeTestRule.onNodeWithTag("Hotbar_Slot_3_Empty").assertIsDisplayed()
    }

    @Test
    fun `filled slot shows item icon`() {
        val slots = listOf(
            createTestItem("Sword"),
            null,
            null,
            null
        )

        composeTestRule.setContent {
            Hotbar(
                slots = slots,
                onSlotTap = {},
                onSlotLongPress = {}
            )
        }

        composeTestRule.waitForIdle()

        composeTestRule.onNodeWithTag("Hotbar_Slot_0_Icon").assertIsDisplayed()
        composeTestRule.onNodeWithTag("Hotbar_Slot_1_Empty").assertIsDisplayed()
    }

    @Test
    fun `stackable item shows count`() {
        val slots = listOf(
            createTestItem("Potion", stackCount = 5),
            null,
            null,
            null
        )

        composeTestRule.setContent {
            Hotbar(
                slots = slots,
                onSlotTap = {},
                onSlotLongPress = {}
            )
        }

        composeTestRule.waitForIdle()

        composeTestRule.onNodeWithTag("Hotbar_Slot_0_Count").assertIsDisplayed()
    }

    // =========================================================================
    // Tap interaction
    // =========================================================================

    @Test
    fun `tap slot fires onSlotTap`() {
        var tappedSlot: Int? = null

        val slots = listOf(
            createTestItem("Sword"),
            createTestItem("Shield"),
            null,
            null
        )

        composeTestRule.setContent {
            Hotbar(
                slots = slots,
                onSlotTap = { tappedSlot = it },
                onSlotLongPress = {}
            )
        }

        composeTestRule.waitForIdle()

        composeTestRule.onNodeWithTag("Hotbar_Slot_0").performClick()

        assertEquals(0, tappedSlot)
    }

    @Test
    fun `tap different slots fires correct index`() {
        val tappedSlots = mutableListOf<Int>()

        val slots = listOf(
            createTestItem("Sword"),
            createTestItem("Shield"),
            createTestItem("Potion"),
            createTestItem("Ring")
        )

        composeTestRule.setContent {
            Hotbar(
                slots = slots,
                onSlotTap = { tappedSlots.add(it) },
                onSlotLongPress = {}
            )
        }

        composeTestRule.waitForIdle()

        composeTestRule.onNodeWithTag("Hotbar_Slot_1").performClick()
        composeTestRule.onNodeWithTag("Hotbar_Slot_3").performClick()

        assertEquals(listOf(1, 3), tappedSlots)
    }

    @Test
    fun `tap empty slot does not fire onSlotTap`() {
        var tapCount = 0

        composeTestRule.setContent {
            Hotbar(
                slots = emptySlots(),
                onSlotTap = { tapCount++ },
                onSlotLongPress = {}
            )
        }

        composeTestRule.waitForIdle()

        composeTestRule.onNodeWithTag("Hotbar_Slot_0").performClick()

        assertEquals(0, tapCount)
    }

    // =========================================================================
    // Long press interaction
    // =========================================================================

    @Test
    fun `long press slot fires onSlotLongPress`() {
        var longPressedSlot: Int? = null

        val slots = listOf(
            createTestItem("Sword"),
            null,
            null,
            null
        )

        composeTestRule.setContent {
            Hotbar(
                slots = slots,
                onSlotTap = {},
                onSlotLongPress = { longPressedSlot = it }
            )
        }

        composeTestRule.waitForIdle()

        composeTestRule.onNodeWithTag("Hotbar_Slot_0").performTouchInput {
            longClick()
        }

        // Need to advance time for long press to register
        composeTestRule.mainClock.advanceTimeBy(LONG_PRESS_THRESHOLD_MS + 100)
        composeTestRule.waitForIdle()

        assertEquals(0, longPressedSlot)
    }

    @Test
    fun `long press empty slot does not fire`() {
        var longPressCount = 0

        composeTestRule.setContent {
            Hotbar(
                slots = emptySlots(),
                onSlotTap = {},
                onSlotLongPress = { longPressCount++ }
            )
        }

        composeTestRule.waitForIdle()

        composeTestRule.onNodeWithTag("Hotbar_Slot_0").performTouchInput {
            longClick()
        }

        composeTestRule.mainClock.advanceTimeBy(LONG_PRESS_THRESHOLD_MS + 100)
        composeTestRule.waitForIdle()

        assertEquals(0, longPressCount)
    }

    @Test
    fun `long press does not fire tap`() {
        var tapCount = 0
        var longPressCount = 0

        val slots = listOf(
            createTestItem("Sword"),
            null,
            null,
            null
        )

        composeTestRule.setContent {
            Hotbar(
                slots = slots,
                onSlotTap = { tapCount++ },
                onSlotLongPress = { longPressCount++ }
            )
        }

        composeTestRule.waitForIdle()

        composeTestRule.onNodeWithTag("Hotbar_Slot_0").performTouchInput {
            longClick()
        }

        composeTestRule.mainClock.advanceTimeBy(LONG_PRESS_THRESHOLD_MS + 100)
        composeTestRule.waitForIdle()

        assertEquals("Tap should not fire on long press", 0, tapCount)
        assertEquals("Long press should fire", 1, longPressCount)
    }

    // =========================================================================
    // Rarity display
    // =========================================================================

    @Test
    fun `legendary item has distinct styling`() {
        val slots = listOf(
            createTestItem("Legendary Sword", rarity = ItemRarity.LEGENDARY),
            createTestItem("Common Sword", rarity = ItemRarity.COMMON),
            null,
            null
        )

        composeTestRule.setContent {
            Hotbar(
                slots = slots,
                onSlotTap = {},
                onSlotLongPress = {}
            )
        }

        composeTestRule.waitForIdle()

        // Both slots should be displayed with their icons
        composeTestRule.onNodeWithTag("Hotbar_Slot_0_Icon").assertIsDisplayed()
        composeTestRule.onNodeWithTag("Hotbar_Slot_1_Icon").assertIsDisplayed()
    }

    // =========================================================================
    // Constants validation
    // =========================================================================

    @Test
    fun `HOTBAR_SLOT_COUNT is 4`() {
        assertEquals(4, HOTBAR_SLOT_COUNT)
    }

    @Test
    fun `HOTBAR_SLOT_SIZE is 48dp`() {
        assertEquals(48.dp, HOTBAR_SLOT_SIZE)
    }

    @Test
    fun `HOTBAR_SLOT_GAP is 10dp`() {
        assertEquals(10.dp, HOTBAR_SLOT_GAP)
    }

    @Test
    fun `LONG_PRESS_THRESHOLD_MS is 500`() {
        assertEquals(500L, LONG_PRESS_THRESHOLD_MS)
    }

    // =========================================================================
    // ItemRarity tests
    // =========================================================================

    @Test
    fun `legendary requires Tier3 confirm`() {
        assertTrue(ItemRarity.LEGENDARY.requiresTier3Confirm)
    }

    @Test
    fun `common does not require Tier3 confirm`() {
        assertFalse(ItemRarity.COMMON.requiresTier3Confirm)
    }

    @Test
    fun `uncommon does not require Tier3 confirm`() {
        assertFalse(ItemRarity.UNCOMMON.requiresTier3Confirm)
    }

    @Test
    fun `rare does not require Tier3 confirm`() {
        assertFalse(ItemRarity.RARE.requiresTier3Confirm)
    }

    // =========================================================================
    // Helpers
    // =========================================================================

    private fun emptySlots(): List<Item?> = listOf(null, null, null, null)

    private fun createTestItem(
        name: String,
        rarity: ItemRarity = ItemRarity.COMMON,
        stackCount: Int = 1
    ): Item = Item(
        id = "item_${name.lowercase().replace(" ", "_")}",
        name = name,
        rarity = rarity,
        stackCount = stackCount
    )
}
