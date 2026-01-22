package com.akalynth.client.ui.components.topbar

import androidx.compose.animation.AnimatedVisibility
import androidx.compose.animation.fadeIn
import androidx.compose.animation.fadeOut
import androidx.compose.animation.scaleIn
import androidx.compose.animation.scaleOut
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp

/**
 * Top bar with stage-gated visibility for HUD elements.
 *
 * Stage visibility:
 * - Stage 0: HP only (+ Chat if included)
 * - Stage >= 1: Menu button visible
 * - Stage >= 2: Why button visible
 * - Stage >= 3: Rep + Gold + Nearby visible
 *
 * Layout:
 * - Fixed height (TOP_BAR_HEIGHT) for stability across stages
 * - All touch targets >= 44dp
 * - Reserved slots prevent layout jumps
 *
 * @param stage Current unlock stage (0-3)
 * @param hp Current HP value
 * @param maxHp Maximum HP value
 * @param gold Current gold amount (shown at stage >= 3)
 * @param rep Current reputation (shown at stage >= 3)
 * @param nearbyCount Number of nearby players (shown at stage >= 3)
 * @param onMenuClick Called when menu button is clicked
 * @param onWhyClick Called when why button is clicked
 * @param onChatClick Called when chat button is clicked
 * @param onNearbyClick Called when nearby chip is clicked
 * @param modifier Optional modifier
 */
@Composable
fun TopBar(
    stage: Int,
    hp: Int,
    maxHp: Int,
    gold: Int = 0,
    rep: Int = 0,
    nearbyCount: Int = 0,
    onMenuClick: () -> Unit = {},
    onWhyClick: () -> Unit = {},
    onChatClick: () -> Unit = {},
    onNearbyClick: () -> Unit = {},
    modifier: Modifier = Modifier
) {
    Row(
        modifier = modifier
            .fillMaxWidth()
            .height(TOP_BAR_HEIGHT)
            .background(Color(0xFF0B1020).copy(alpha = 0.8f))
            .padding(horizontal = 16.dp, vertical = 8.dp)
            .testTag("TopBar"),
        horizontalArrangement = Arrangement.SpaceBetween,
        verticalAlignment = Alignment.CenterVertically
    ) {
        // Left section: HP + Rep/Gold (stage >= 3)
        Row(
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(12.dp),
            modifier = Modifier.testTag("TopBar_LeftSection")
        ) {
            // HP Bar (always visible)
            HPBar(
                hp = hp,
                maxHp = maxHp,
                modifier = Modifier.testTag("TopBar_HP")
            )

            // Rep display (stage >= 3)
            AnimatedVisibility(
                visible = stage >= 3,
                enter = fadeIn() + scaleIn(initialScale = 0.9f),
                exit = fadeOut() + scaleOut(targetScale = 0.9f)
            ) {
                TokenDisplay(
                    icon = "\u2B50",  // Star
                    value = rep,
                    color = Color(0xFFFFD700),
                    modifier = Modifier.testTag("TopBar_Rep")
                )
            }

            // Gold display (stage >= 3)
            AnimatedVisibility(
                visible = stage >= 3,
                enter = fadeIn() + scaleIn(initialScale = 0.9f),
                exit = fadeOut() + scaleOut(targetScale = 0.9f)
            ) {
                TokenDisplay(
                    icon = "\uD83D\uDCB0",  // Money bag
                    value = gold,
                    color = Color(0xFFE2B714),
                    modifier = Modifier.testTag("TopBar_Gold")
                )
            }
        }

        // Center section: Nearby players (stage >= 3)
        AnimatedVisibility(
            visible = stage >= 3 && nearbyCount > 0,
            enter = fadeIn() + scaleIn(initialScale = 0.9f),
            exit = fadeOut() + scaleOut(targetScale = 0.9f)
        ) {
            NearbyChip(
                count = nearbyCount,
                onClick = onNearbyClick,
                modifier = Modifier.testTag("TopBar_Nearby")
            )
        }

        // Right section: Menu + Why + Chat
        Row(
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(8.dp),
            modifier = Modifier.testTag("TopBar_RightSection")
        ) {
            // Why button (stage >= 2)
            Box {
                // Reserved slot for layout stability
                Spacer(
                    modifier = Modifier
                        .size(MIN_TOUCH_TARGET)
                        .testTag("TopBar_Why_Reserved")
                )
                androidx.compose.animation.AnimatedVisibility(
                    visible = stage >= 2,
                    enter = fadeIn() + scaleIn(initialScale = 0.8f),
                    exit = fadeOut() + scaleOut(targetScale = 0.8f)
                ) {
                    TopBarButton(
                        text = "?",
                        onClick = onWhyClick,
                        color = Color(0xFF4CAF50),
                        modifier = Modifier.testTag("TopBar_Why")
                    )
                }
            }

            // Menu button (stage >= 1)
            Box {
                // Reserved slot for layout stability
                Spacer(
                    modifier = Modifier
                        .size(MIN_TOUCH_TARGET)
                        .testTag("TopBar_Menu_Reserved")
                )
                androidx.compose.animation.AnimatedVisibility(
                    visible = stage >= 1,
                    enter = fadeIn() + scaleIn(initialScale = 0.8f),
                    exit = fadeOut() + scaleOut(targetScale = 0.8f)
                ) {
                    TopBarButton(
                        text = "\u2630",  // Hamburger menu
                        onClick = onMenuClick,
                        color = Color(0xFF424242),
                        modifier = Modifier.testTag("TopBar_Menu")
                    )
                }
            }

            // Chat button (always visible)
            TopBarButton(
                text = "\uD83D\uDCAC",  // Speech bubble
                onClick = onChatClick,
                color = Color(0xFF2196F3),
                modifier = Modifier.testTag("TopBar_Chat")
            )
        }
    }
}

/**
 * HP bar display.
 */
@Composable
private fun HPBar(
    hp: Int,
    maxHp: Int,
    modifier: Modifier = Modifier
) {
    val hpPercent = if (maxHp > 0) hp.toFloat() / maxHp else 0f
    val hpColor = when {
        hpPercent > 0.5f -> Color(0xFF4CAF50)  // Green
        hpPercent > 0.25f -> Color(0xFFFF9800) // Orange
        else -> Color(0xFFF44336)               // Red
    }

    Box(
        modifier = modifier
            .width(HP_BAR_WIDTH)
            .height(HP_BAR_HEIGHT)
            .clip(RoundedCornerShape(4.dp))
            .background(Color(0xFF1A1A2E))
    ) {
        // HP fill
        Box(
            modifier = Modifier
                .fillMaxWidth(hpPercent)
                .height(HP_BAR_HEIGHT)
                .background(hpColor)
                .testTag("TopBar_HP_Fill")
        )

        // HP text
        Text(
            text = "$hp/$maxHp",
            fontSize = 10.sp,
            fontWeight = FontWeight.Bold,
            color = Color.White,
            modifier = Modifier
                .align(Alignment.Center)
                .testTag("TopBar_HP_Text")
        )
    }
}

/**
 * Token display (Rep/Gold).
 */
@Composable
private fun TokenDisplay(
    icon: String,
    value: Int,
    color: Color,
    modifier: Modifier = Modifier
) {
    Row(
        modifier = modifier
            .background(Color(0xFF1A1A2E), RoundedCornerShape(4.dp))
            .padding(horizontal = 8.dp, vertical = 4.dp),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(4.dp)
    ) {
        Text(
            text = icon,
            fontSize = 12.sp
        )
        Text(
            text = formatNumber(value),
            fontSize = 12.sp,
            fontWeight = FontWeight.Bold,
            color = color
        )
    }
}

/**
 * Nearby players chip.
 */
@Composable
private fun NearbyChip(
    count: Int,
    onClick: () -> Unit,
    modifier: Modifier = Modifier
) {
    Row(
        modifier = modifier
            .clip(RoundedCornerShape(16.dp))
            .background(Color(0xFF1A1A2E))
            .clickable(onClick = onClick)
            .padding(horizontal = 12.dp, vertical = 6.dp),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(4.dp)
    ) {
        Text(
            text = "\uD83D\uDC65",  // People
            fontSize = 12.sp
        )
        Text(
            text = "$count nearby",
            fontSize = 12.sp,
            color = Color.White
        )
    }
}

/**
 * Top bar button.
 */
@Composable
private fun TopBarButton(
    text: String,
    onClick: () -> Unit,
    color: Color,
    modifier: Modifier = Modifier
) {
    Box(
        modifier = modifier
            .size(MIN_TOUCH_TARGET)
            .clip(RoundedCornerShape(8.dp))
            .background(color)
            .clickable(onClick = onClick),
        contentAlignment = Alignment.Center
    ) {
        Text(
            text = text,
            fontSize = 18.sp,
            color = Color.White
        )
    }
}

/**
 * Format large numbers with K/M suffixes.
 */
private fun formatNumber(value: Int): String {
    return when {
        value >= 1_000_000 -> "${value / 1_000_000}M"
        value >= 1_000 -> "${value / 1_000}K"
        else -> value.toString()
    }
}

/**
 * Top bar height (fixed for layout stability).
 */
val TOP_BAR_HEIGHT = 56.dp

/**
 * HP bar dimensions.
 */
val HP_BAR_WIDTH = 100.dp
val HP_BAR_HEIGHT = 20.dp

/**
 * Minimum touch target size per accessibility guidelines.
 */
val MIN_TOUCH_TARGET = 44.dp
