package com.akalynth.client.ui.components

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.gestures.detectTapGestures
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.layout.wrapContentSize
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.KeyboardArrowDown
import androidx.compose.material.icons.filled.KeyboardArrowLeft
import androidx.compose.material.icons.filled.KeyboardArrowRight
import androidx.compose.material.icons.filled.KeyboardArrowUp
import androidx.compose.material3.Icon
import androidx.compose.material3.Text
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.input.pointer.pointerInput
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.akalynth.client.protocol.Direction
import com.akalynth.client.ui.theme.ClassicShellColors
import com.akalynth.client.ui.theme.TextureCircleBox
import com.akalynth.client.ui.theme.classicPanelBrush
import com.akalynth.client.ui.theme.NineSliceBox
import com.akalynth.client.ui.theme.rememberUiTextures
import kotlinx.coroutines.delay
import kotlinx.coroutines.isActive

private const val MOVE_REPEAT_MS = 130L

/**
 * 4-direction play HUD D-pad with center stop (parity with web center ■ stop).
 *
 * Hold a direction to repeat move intents. Center stop clears any held direction
 * so movement does not stick when the player lifts off mid-pad.
 */
@Composable
fun DPad(
    onMove: (Direction) -> Unit,
    modifier: Modifier = Modifier,
    scrimAlpha: Float = 0.42f,
    onStop: (() -> Unit)? = null,
) {
    val textures = rememberUiTextures()
    // Single held direction so the center stop can cancel repeat immediately.
    var activeDirection by remember { mutableStateOf<Direction?>(null) }

    LaunchedEffect(activeDirection) {
        val dir = activeDirection ?: return@LaunchedEffect
        onMove(dir)
        while (isActive && activeDirection == dir) {
            delay(MOVE_REPEAT_MS)
            if (activeDirection == dir) onMove(dir)
        }
    }

    val clearHold: () -> Unit = {
        if (activeDirection != null) {
            activeDirection = null
            onStop?.invoke()
        } else {
            onStop?.invoke()
        }
    }

    val inner: @Composable () -> Unit = {
        Column(
            horizontalAlignment = Alignment.CenterHorizontally,
        ) {
            DirectionButton(
                icon = Icons.Default.KeyboardArrowUp,
                direction = Direction.NORTH,
                isActive = activeDirection == Direction.NORTH,
                onPress = { activeDirection = Direction.NORTH },
                onRelease = {
                    if (activeDirection == Direction.NORTH) activeDirection = null
                },
            )

            Row(
                horizontalArrangement = Arrangement.spacedBy(4.dp),
                verticalAlignment = Alignment.CenterVertically,
            ) {
                DirectionButton(
                    icon = Icons.Default.KeyboardArrowLeft,
                    direction = Direction.WEST,
                    isActive = activeDirection == Direction.WEST,
                    onPress = { activeDirection = Direction.WEST },
                    onRelease = {
                        if (activeDirection == Direction.WEST) activeDirection = null
                    },
                )

                StopButton(
                    isActive = activeDirection == null,
                    onStop = clearHold,
                )

                DirectionButton(
                    icon = Icons.Default.KeyboardArrowRight,
                    direction = Direction.EAST,
                    isActive = activeDirection == Direction.EAST,
                    onPress = { activeDirection = Direction.EAST },
                    onRelease = {
                        if (activeDirection == Direction.EAST) activeDirection = null
                    },
                )
            }

            DirectionButton(
                icon = Icons.Default.KeyboardArrowDown,
                direction = Direction.SOUTH,
                isActive = activeDirection == Direction.SOUTH,
                onPress = { activeDirection = Direction.SOUTH },
                onRelease = {
                    if (activeDirection == Direction.SOUTH) activeDirection = null
                },
            )
        }
    }

    Box(modifier = modifier.wrapContentSize().testTag("DPad")) {
        if (scrimAlpha > 0f) {
            Box(
                modifier = Modifier
                    .matchParentSize()
                    .clip(RoundedCornerShape(18.dp))
                    .background(Color.Black.copy(alpha = scrimAlpha.coerceIn(0f, 1f))),
            )
        }
        if (textures.dpadFrame != null) {
            NineSliceBox(
                frame = textures.dpadFrame,
                slicePx = textures.dpadSlice,
                contentPadding = PaddingValues(10.dp),
                cornerRadius = 14.dp,
                backgroundAlpha = 0.88f,
            ) {
                inner()
            }
        } else {
            Column(
                modifier = Modifier
                    .clip(RoundedCornerShape(16.dp))
                    .background(classicPanelBrush())
                    .border(1.dp, ClassicShellColors.IronBright.copy(alpha = 0.5f), RoundedCornerShape(16.dp))
                    .padding(10.dp),
                horizontalAlignment = Alignment.CenterHorizontally,
            ) {
                inner()
            }
        }
    }
}

@Composable
private fun DirectionButton(
    icon: ImageVector,
    direction: Direction,
    isActive: Boolean,
    onPress: () -> Unit,
    onRelease: () -> Unit,
) {
    val textures = rememberUiTextures()

    val texture = when {
        isActive && textures.dpadButtonPressed != null -> textures.dpadButtonPressed
        textures.dpadButton != null -> textures.dpadButton
        else -> null
    }

    val pressModifier = Modifier
        .size(60.dp)
        .semantics { contentDescription = "Move ${direction.name.lowercase()}" }
        .pointerInput(direction) {
            detectTapGestures(
                onPress = {
                    onPress()
                    try {
                        tryAwaitRelease()
                    } finally {
                        onRelease()
                    }
                },
            )
        }

    if (texture != null) {
        TextureCircleBox(texture = texture, modifier = pressModifier) {
            Icon(
                imageVector = icon,
                contentDescription = direction.name,
                tint = if (isActive) ClassicShellColors.Iron else Color.White,
                modifier = Modifier.size(34.dp),
            )
        }
    } else {
        Box(
            modifier = pressModifier
                .clip(CircleShape)
                .background(
                    if (isActive) ClassicShellColors.Brass.copy(alpha = 0.72f)
                    else ClassicShellColors.Iron.copy(alpha = 0.72f),
                )
                .border(
                    1.dp,
                    if (isActive) ClassicShellColors.Warning else ClassicShellColors.IronBright.copy(alpha = 0.72f),
                    CircleShape,
                ),
            contentAlignment = Alignment.Center,
        ) {
            Icon(
                imageVector = icon,
                contentDescription = direction.name,
                tint = if (isActive) ClassicShellColors.Iron else Color.White,
                modifier = Modifier.size(34.dp),
            )
        }
    }
}

@Composable
private fun StopButton(
    isActive: Boolean,
    onStop: () -> Unit,
) {
    val textures = rememberUiTextures()
    var pressed by remember { mutableStateOf(false) }

    val texture = when {
        pressed && textures.dpadButtonPressed != null -> textures.dpadButtonPressed
        textures.dpadButton != null -> textures.dpadButton
        else -> null
    }

    val pressModifier = Modifier
        .size(60.dp)
        .testTag("DPad_Stop")
        .semantics { contentDescription = "Stop movement" }
        .pointerInput(Unit) {
            detectTapGestures(
                onPress = {
                    pressed = true
                    onStop()
                    try {
                        tryAwaitRelease()
                    } finally {
                        pressed = false
                    }
                },
            )
        }

    if (texture != null) {
        TextureCircleBox(texture = texture, modifier = pressModifier) {
            Text(
                text = "■",
                color = if (pressed || !isActive) ClassicShellColors.Warning else Color.White,
                fontSize = 18.sp,
                fontWeight = FontWeight.Bold,
            )
        }
    } else {
        Box(
            modifier = pressModifier
                .clip(CircleShape)
                .background(
                    if (pressed) ClassicShellColors.Warning.copy(alpha = 0.55f)
                    else ClassicShellColors.Iron.copy(alpha = 0.85f),
                )
                .border(
                    1.dp,
                    if (pressed) ClassicShellColors.Warning else ClassicShellColors.IronBright.copy(alpha = 0.72f),
                    CircleShape,
                ),
            contentAlignment = Alignment.Center,
        ) {
            Text(
                text = "■",
                color = if (pressed) ClassicShellColors.Iron else Color.White,
                fontSize = 18.sp,
                fontWeight = FontWeight.Bold,
            )
        }
    }
}
