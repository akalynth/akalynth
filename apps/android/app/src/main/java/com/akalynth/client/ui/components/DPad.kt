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
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.input.pointer.pointerInput
import androidx.compose.ui.unit.dp
import com.akalynth.client.protocol.Direction
import com.akalynth.client.ui.theme.ClassicShellColors
import com.akalynth.client.ui.theme.TextureCircleBox
import com.akalynth.client.ui.theme.classicPanelBrush
import com.akalynth.client.ui.theme.NineSliceBox
import com.akalynth.client.ui.theme.rememberUiTextures
import kotlinx.coroutines.delay
import kotlinx.coroutines.isActive

private const val MOVE_REPEAT_MS = 130L

@Composable
fun DPad(
    onMove: (Direction) -> Unit,
    modifier: Modifier = Modifier,
    scrimAlpha: Float = 0.42f,
) {
    val textures = rememberUiTextures()
    val inner: @Composable () -> Unit = {
        Column(
            horizontalAlignment = Alignment.CenterHorizontally,
        ) {
        // North
        DirectionButton(
            icon = Icons.Default.KeyboardArrowUp,
            direction = Direction.NORTH,
            onMove = onMove
        )

        Row(
            horizontalArrangement = Arrangement.spacedBy(44.dp)
        ) {
            // West
            DirectionButton(
                icon = Icons.Default.KeyboardArrowLeft,
                direction = Direction.WEST,
                onMove = onMove
            )

            // East
            DirectionButton(
                icon = Icons.Default.KeyboardArrowRight,
                direction = Direction.EAST,
                onMove = onMove
            )
        }

        // South
        DirectionButton(
            icon = Icons.Default.KeyboardArrowDown,
            direction = Direction.SOUTH,
            onMove = onMove,
        )
        }
    }

    Box(modifier = modifier.wrapContentSize()) {
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
    onMove: (Direction) -> Unit,
) {
    val textures = rememberUiTextures()
    var isPressed by remember { mutableStateOf(false) }

    LaunchedEffect(isPressed) {
        if (isPressed) {
            onMove(direction)
            while (isActive && isPressed) {
                delay(MOVE_REPEAT_MS)
                onMove(direction)
            }
        }
    }

    val texture = when {
        isPressed && textures.dpadButtonPressed != null -> textures.dpadButtonPressed
        textures.dpadButton != null -> textures.dpadButton
        else -> null
    }

    val pressModifier = Modifier
        .size(60.dp)
        .pointerInput(Unit) {
            detectTapGestures(
                onPress = {
                    isPressed = true
                    tryAwaitRelease()
                    isPressed = false
                },
            )
        }

    if (texture != null) {
        TextureCircleBox(texture = texture, modifier = pressModifier) {
            Icon(
                imageVector = icon,
                contentDescription = direction.name,
                tint = if (isPressed) ClassicShellColors.Iron else Color.White,
                modifier = Modifier.size(34.dp),
            )
        }
    } else {
        Box(
            modifier = pressModifier
                .clip(CircleShape)
                .background(
                    if (isPressed) ClassicShellColors.Brass.copy(alpha = 0.72f)
                    else ClassicShellColors.Iron.copy(alpha = 0.72f),
                )
                .border(
                    1.dp,
                    if (isPressed) ClassicShellColors.Warning else ClassicShellColors.IronBright.copy(alpha = 0.72f),
                    CircleShape,
                ),
            contentAlignment = Alignment.Center,
        ) {
            Icon(
                imageVector = icon,
                contentDescription = direction.name,
                tint = if (isPressed) ClassicShellColors.Iron else Color.White,
                modifier = Modifier.size(34.dp),
            )
        }
    }
}
