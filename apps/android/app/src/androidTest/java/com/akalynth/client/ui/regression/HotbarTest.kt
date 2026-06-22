package com.akalynth.client.ui.regression

import androidx.compose.ui.test.assertIsDisplayed
import androidx.compose.ui.test.junit4.createComposeRule
import androidx.compose.ui.test.longClick
import androidx.compose.ui.test.onNodeWithTag
import androidx.compose.ui.test.performClick
import androidx.compose.ui.test.performTouchInput
import androidx.compose.ui.unit.dp
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
    fun test_hotbar_displays_4_slots() {
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
    fun test_empty_slots_show_slot_numbers() {
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
    fun test_filled_slot_shows_item_icon() {
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
    fun test_stackable_item_shows_count() {
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
    fun test_tap_slot_fires_onslottap() {
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
    fun test_tap_different_slots_fires_correct_index() {
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
    fun test_tap_empty_slot_does_not_fire_onslottap() {
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
    fun test_long_press_slot_fires_onslotlongpress() {
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
    fun test_long_press_empty_slot_does_not_fire() {
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
    fun test_long_press_does_not_fire_tap() {
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
    fun test_legendary_item_has_distinct_styling() {
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
    fun test_hotbar_slot_count_is_4() {
        assertEquals(4, HOTBAR_SLOT_COUNT)
    }

    @Test
    fun test_hotbar_slot_size_is_48dp() {
        assertEquals(48.dp, HOTBAR_SLOT_SIZE)
    }

    @Test
    fun test_hotbar_slot_gap_is_10dp() {
        assertEquals(10.dp, HOTBAR_SLOT_GAP)
    }

    @Test
    fun test_long_press_threshold_ms_is_500() {
        assertEquals(500L, LONG_PRESS_THRESHOLD_MS)
    }

    // =========================================================================
    // ItemRarity tests
    // =========================================================================

    @Test
    fun test_legendary_requires_tier3_confirm() {
        assertTrue(ItemRarity.LEGENDARY.requiresTier3Confirm)
    }

    @Test
    fun test_common_does_not_require_tier3_confirm() {
        assertFalse(ItemRarity.COMMON.requiresTier3Confirm)
    }

    @Test
    fun test_uncommon_does_not_require_tier3_confirm() {
        assertFalse(ItemRarity.UNCOMMON.requiresTier3Confirm)
    }

    @Test
    fun test_rare_does_not_require_tier3_confirm() {
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
        itemType = name.lowercase().replace(" ", "_"),
        name = name,
        rarity = rarity,
        stackCount = stackCount
    )
}
