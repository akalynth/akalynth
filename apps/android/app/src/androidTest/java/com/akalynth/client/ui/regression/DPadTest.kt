package com.akalynth.client.ui.regression

import androidx.compose.ui.test.junit4.createComposeRule
import androidx.compose.ui.test.onNodeWithTag
import androidx.compose.ui.test.performTouchInput
import androidx.compose.ui.test.getBoundsInRoot
import androidx.compose.ui.unit.dp
import com.akalynth.client.protocol.Direction
import com.akalynth.client.ui.components.movement.DPad
import com.akalynth.client.ui.components.movement.MIN_HITBOX_DP
import org.junit.Rule
import org.junit.Test
import org.junit.Assert.*

/**
 * Regression tests for D-pad component.
 * Maps to UI_REGRESSION_MATRIX.md Section 1: Movement & Thumb Zones (M1-M3)
 *
 * Tests verify:
 * - M1: All 8 directions map correctly; press emits once
 * - M2: Release emits once; no stuck movement
 * - M3: Hitbox >= 44dp for all buttons
 */
class DPadTest {

    @get:Rule
    val composeTestRule = createComposeRule()

    // =========================================================================
    // M1: D-pad press (all 8 directions)
    // Assertion: Direction maps correctly incl diagonals; continuous while held
    // =========================================================================

    @Test
    fun test_m1_all_eight_directions_map_correctly() {
        val directions = mutableListOf<Direction>()

        composeTestRule.setContent {
            DPad(
                onDirection = { directions.add(it) },
                onRelease = {}
            )
        }

        // Press each direction and verify correct Direction emitted
        val allDirections = listOf(
            "DPad_NORTH" to Direction.NORTH,
            "DPad_NORTHEAST" to Direction.NORTHEAST,
            "DPad_EAST" to Direction.EAST,
            "DPad_SOUTHEAST" to Direction.SOUTHEAST,
            "DPad_SOUTH" to Direction.SOUTH,
            "DPad_SOUTHWEST" to Direction.SOUTHWEST,
            "DPad_WEST" to Direction.WEST,
            "DPad_NORTHWEST" to Direction.NORTHWEST
        )

        allDirections.forEach { (tag, expectedDirection) ->
            directions.clear()
            composeTestRule.onNodeWithTag(tag).performTouchInput {
                down(center)
                up()
            }
            composeTestRule.waitForIdle()

            assertEquals(
                "Direction $expectedDirection should be emitted for $tag",
                expectedDirection,
                directions.firstOrNull()
            )
        }
    }

    @Test
    fun test_m1_north_direction_maps_correctly() {
        var receivedDirection: Direction? = null

        composeTestRule.setContent {
            DPad(
                onDirection = { receivedDirection = it },
                onRelease = {}
            )
        }

        composeTestRule.onNodeWithTag("DPad_NORTH").performTouchInput {
            down(center)
            up()
        }

        composeTestRule.waitForIdle()

        assertEquals("North should emit Direction.NORTH", Direction.NORTH, receivedDirection)
    }

    @Test
    fun test_m1_northeast_diagonal_maps_correctly() {
        var receivedDirection: Direction? = null

        composeTestRule.setContent {
            DPad(
                onDirection = { receivedDirection = it },
                onRelease = {}
            )
        }

        composeTestRule.onNodeWithTag("DPad_NORTHEAST").performTouchInput {
            down(center)
            up()
        }

        composeTestRule.waitForIdle()

        assertEquals("NE should emit Direction.NORTHEAST", Direction.NORTHEAST, receivedDirection)
    }

    @Test
    fun test_m1_holding_direction_maintains_movement() {
        var startCalled = false
        var endCalled = false

        composeTestRule.setContent {
            DPad(
                onDirection = { startCalled = true },
                onRelease = { endCalled = true }
            )
        }

        // Press and hold (don't release)
        composeTestRule.onNodeWithTag("DPad_NORTH").performTouchInput {
            down(center)
            // Don't call up() - keep holding
        }

        composeTestRule.waitForIdle()

        assertTrue("onDirection should be called on press", startCalled)
        assertFalse("onRelease should NOT be called while held", endCalled)
    }

    @Test
    fun test_m1_press_emits_exactly_once() {
        var pressCount = 0

        composeTestRule.setContent {
            DPad(
                onDirection = { pressCount++ },
                onRelease = {}
            )
        }

        composeTestRule.onNodeWithTag("DPad_NORTH").performTouchInput {
            down(center)
            up()
        }

        composeTestRule.waitForIdle()

        assertEquals("Press should emit exactly once", 1, pressCount)
    }

    // =========================================================================
    // M2: D-pad release
    // Assertion: Releasing stops movement; no "stuck" movement
    // =========================================================================

    @Test
    fun test_m2_releasing_stops_movement() {
        var endCalled = false

        composeTestRule.setContent {
            DPad(
                onDirection = {},
                onRelease = { endCalled = true }
            )
        }

        composeTestRule.onNodeWithTag("DPad_NORTH").performTouchInput {
            down(center)
            up()
        }

        composeTestRule.waitForIdle()

        assertTrue("onRelease should be called on release", endCalled)
    }

    @Test
    fun test_m2_no_stuck_movement_after_release() {
        var startCount = 0
        var endCount = 0

        composeTestRule.setContent {
            DPad(
                onDirection = { startCount++ },
                onRelease = { endCount++ }
            )
        }

        composeTestRule.onNodeWithTag("DPad_EAST").performTouchInput {
            down(center)
            up()
        }

        composeTestRule.waitForIdle()

        assertEquals("startCount == endCount (balanced callbacks)", startCount, endCount)
        assertEquals("Start should be called once", 1, startCount)
        assertEquals("End should be called once", 1, endCount)
    }

    @Test
    fun test_m2_drag_off_button_triggers_release() {
        var endCalled = false

        composeTestRule.setContent {
            DPad(
                onDirection = {},
                onRelease = { endCalled = true }
            )
        }

        // Press, then drag off (cancellation)
        composeTestRule.onNodeWithTag("DPad_WEST").performTouchInput {
            down(center)
            // Move far outside the button to trigger cancellation
            moveTo(center.copy(x = center.x + 500f, y = center.y + 500f))
            up()
        }

        composeTestRule.waitForIdle()

        assertTrue("onRelease should be called on drag-off (cancel)", endCalled)
    }

    @Test
    fun test_m2_release_emits_exactly_once() {
        var releaseCount = 0

        composeTestRule.setContent {
            DPad(
                onDirection = {},
                onRelease = { releaseCount++ }
            )
        }

        composeTestRule.onNodeWithTag("DPad_SOUTH").performTouchInput {
            down(center)
            up()
        }

        composeTestRule.waitForIdle()

        assertEquals("Release should emit exactly once", 1, releaseCount)
    }

    // =========================================================================
    // M3: D-pad hitbox
    // Assertion: Each direction button hitbox >= 44dp
    // =========================================================================

    @Test
    fun test_m3_all_buttons_have_minimum_44dp_hitbox() {
        composeTestRule.setContent {
            DPad(
                onDirection = {},
                onRelease = {}
            )
        }

        val allDirectionTags = listOf(
            "DPad_NORTH", "DPad_NORTHEAST", "DPad_EAST", "DPad_SOUTHEAST",
            "DPad_SOUTH", "DPad_SOUTHWEST", "DPad_WEST", "DPad_NORTHWEST"
        )

        allDirectionTags.forEach { tag ->
            val node = composeTestRule.onNodeWithTag(tag)
            node.assertExists()

            val bounds = node.getBoundsInRoot()
            val width = bounds.right - bounds.left
            val height = bounds.bottom - bounds.top

            // Convert 44dp to pixels for comparison
            // Note: In tests, default density is usually 1.0, so 44dp ≈ 44px
            // We compare against the dp value which should be >= MIN_HITBOX_DP
            assertTrue(
                "Button $tag width ($width) should be >= ${MIN_HITBOX_DP.value}dp",
                width >= MIN_HITBOX_DP
            )
            assertTrue(
                "Button $tag height ($height) should be >= ${MIN_HITBOX_DP.value}dp",
                height >= MIN_HITBOX_DP
            )
        }
    }

    @Test
    fun test_m3_center_spacer_does_not_capture_input() {
        var anyDirectionCalled = false

        composeTestRule.setContent {
            DPad(
                onDirection = { anyDirectionCalled = true },
                onRelease = {}
            )
        }

        // Verify center spacer exists
        composeTestRule.onNodeWithTag("DPad_Center").assertExists()

        // Tap center area - should not trigger any direction
        composeTestRule.onNodeWithTag("DPad_Center").performTouchInput {
            down(center)
            up()
        }

        composeTestRule.waitForIdle()

        assertFalse("Center spacer should not capture input", anyDirectionCalled)
    }

    @Test
    fun test_m3_center_is_a_plain_spacer() {
        composeTestRule.setContent {
            DPad(
                onDirection = {},
                onRelease = {}
            )
        }

        // Center should exist and be non-interactive
        composeTestRule.onNodeWithTag("DPad_Center").assertExists()
    }

    // =========================================================================
    // All 8 directions individual tests
    // =========================================================================

    @Test
    fun test_south_direction_maps_correctly() {
        var receivedDirection: Direction? = null

        composeTestRule.setContent {
            DPad(
                onDirection = { receivedDirection = it },
                onRelease = {}
            )
        }

        composeTestRule.onNodeWithTag("DPad_SOUTH").performTouchInput {
            down(center)
            up()
        }

        assertEquals(Direction.SOUTH, receivedDirection)
    }

    @Test
    fun test_east_direction_maps_correctly() {
        var receivedDirection: Direction? = null

        composeTestRule.setContent {
            DPad(
                onDirection = { receivedDirection = it },
                onRelease = {}
            )
        }

        composeTestRule.onNodeWithTag("DPad_EAST").performTouchInput {
            down(center)
            up()
        }

        assertEquals(Direction.EAST, receivedDirection)
    }

    @Test
    fun test_west_direction_maps_correctly() {
        var receivedDirection: Direction? = null

        composeTestRule.setContent {
            DPad(
                onDirection = { receivedDirection = it },
                onRelease = {}
            )
        }

        composeTestRule.onNodeWithTag("DPad_WEST").performTouchInput {
            down(center)
            up()
        }

        assertEquals(Direction.WEST, receivedDirection)
    }

    @Test
    fun test_southeast_direction_maps_correctly() {
        var receivedDirection: Direction? = null

        composeTestRule.setContent {
            DPad(
                onDirection = { receivedDirection = it },
                onRelease = {}
            )
        }

        composeTestRule.onNodeWithTag("DPad_SOUTHEAST").performTouchInput {
            down(center)
            up()
        }

        assertEquals(Direction.SOUTHEAST, receivedDirection)
    }

    @Test
    fun test_southwest_direction_maps_correctly() {
        var receivedDirection: Direction? = null

        composeTestRule.setContent {
            DPad(
                onDirection = { receivedDirection = it },
                onRelease = {}
            )
        }

        composeTestRule.onNodeWithTag("DPad_SOUTHWEST").performTouchInput {
            down(center)
            up()
        }

        assertEquals(Direction.SOUTHWEST, receivedDirection)
    }

    @Test
    fun test_northwest_direction_maps_correctly() {
        var receivedDirection: Direction? = null

        composeTestRule.setContent {
            DPad(
                onDirection = { receivedDirection = it },
                onRelease = {}
            )
        }

        composeTestRule.onNodeWithTag("DPad_NORTHWEST").performTouchInput {
            down(center)
            up()
        }

        assertEquals(Direction.NORTHWEST, receivedDirection)
    }

    // =========================================================================
    // Constants validation
    // =========================================================================

    @Test
    fun test_min_hitbox_dp_matches_spec() {
        assertEquals("MIN_HITBOX_DP should be 44dp", 44.dp, MIN_HITBOX_DP)
    }
}
