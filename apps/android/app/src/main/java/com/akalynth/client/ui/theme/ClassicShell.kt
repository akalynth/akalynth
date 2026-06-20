package com.akalynth.client.ui.theme

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.BoxScope
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ColumnScope
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.RowScope
import androidx.compose.foundation.layout.defaultMinSize
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.widthIn
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp

object ClassicShellColors {
    val Void = Color(0xFF090A0A)
    val PanelDeep = Color(0xE6121414)
    val Stone = Color(0xFF3A3D39)
    val StoneLight = Color(0xFF565A52)
    val Iron = Color(0xFF171918)
    val IronBright = Color(0xFF7B8178)
    val Brass = Color(0xFFD6B24C)
    val Rune = Color(0xFF8FD3D6)
    val Good = Color(0xFF42E66B)
    val Warning = Color(0xFFFFD447)
    val Danger = Color(0xFFFF5D4D)
    val Text = Color(0xFFE8E3D5)
    val MutedText = Color(0xFFB8B4A9)
}

fun classicPanelBrush(): Brush = Brush.verticalGradient(
    colors = listOf(
        ClassicShellColors.StoneLight.copy(alpha = 0.82f),
        ClassicShellColors.Stone.copy(alpha = 0.9f),
        ClassicShellColors.Iron.copy(alpha = 0.96f)
    )
)

fun akalynthWallpaperBrush(): Brush = Brush.verticalGradient(
    colors = listOf(
        ClassicShellColors.Void,
        Color(0xFF0E1718),
        Color(0xFF1A1710),
        Color(0xFF231A0B),
        ClassicShellColors.Void
    )
)

@Composable
fun ClassicPanel(
    modifier: Modifier = Modifier,
    corner: Dp = 8.dp,
    contentPadding: PaddingValues = PaddingValues(12.dp),
    verticalArrangement: Arrangement.Vertical = Arrangement.spacedBy(8.dp),
    horizontalAlignment: Alignment.Horizontal = Alignment.Start,
    content: @Composable ColumnScope.() -> Unit
) {
    val textures = rememberUiTextures()
    val shape = RoundedCornerShape(corner)
    if (textures.panelFrame != null) {
        NineSliceBox(
            frame = textures.panelFrame,
            slicePx = textures.panelSlice,
            modifier = modifier,
            contentPadding = contentPadding,
            cornerRadius = corner,
            backgroundAlpha = 0.96f,
        ) {
            Column(
                verticalArrangement = verticalArrangement,
                horizontalAlignment = horizontalAlignment,
                content = content,
            )
        }
    } else {
        Column(
            modifier = modifier
                .clip(shape)
                .background(classicPanelBrush())
                .border(1.dp, ClassicShellColors.IronBright.copy(alpha = 0.66f), shape)
                .border(2.dp, ClassicShellColors.Iron.copy(alpha = 0.5f), shape)
                .padding(contentPadding),
            verticalArrangement = verticalArrangement,
            horizontalAlignment = horizontalAlignment,
            content = content,
        )
    }
}

@Composable
fun ClassicDock(
    modifier: Modifier = Modifier,
    content: @Composable RowScope.() -> Unit
) {
    val dockPadding = PaddingValues(8.dp)
    Row(
        modifier = modifier
            .clip(RoundedCornerShape(9.dp))
            .background(ClassicShellColors.PanelDeep.copy(alpha = 0.92f))
            .border(1.dp, ClassicShellColors.IronBright.copy(alpha = 0.48f), RoundedCornerShape(9.dp))
            .padding(dockPadding),
        horizontalArrangement = Arrangement.spacedBy(8.dp),
        verticalAlignment = Alignment.CenterVertically,
        content = content,
    )
}

/** Vertical action stack chrome for the bottom-right gameplay dock. */
@Composable
fun ClassicActionDock(
    modifier: Modifier = Modifier,
    content: @Composable ColumnScope.() -> Unit,
) {
    val textures = rememberUiTextures()
    val dockPadding = PaddingValues(horizontal = 10.dp, vertical = 10.dp)
    val shape = RoundedCornerShape(10.dp)
    if (textures.dockFrame != null) {
        NineSliceBox(
            frame = textures.dockFrame,
            slicePx = textures.dockSlice,
            modifier = modifier.widthIn(max = 108.dp),
            contentPadding = dockPadding,
            cornerRadius = 10.dp,
            backgroundAlpha = 0.9f,
        ) {
            Column(
                verticalArrangement = Arrangement.spacedBy(6.dp),
                horizontalAlignment = Alignment.CenterHorizontally,
                content = content,
            )
        }
    } else {
        Column(
            modifier = modifier
                .widthIn(max = 108.dp)
                .clip(shape)
                .background(ClassicShellColors.PanelDeep.copy(alpha = 0.92f))
                .border(1.dp, ClassicShellColors.IronBright.copy(alpha = 0.48f), shape)
                .padding(dockPadding),
            verticalArrangement = Arrangement.spacedBy(6.dp),
            horizontalAlignment = Alignment.CenterHorizontally,
            content = content,
        )
    }
}

@Composable
fun ClassicButton(
    text: String,
    onClick: () -> Unit,
    modifier: Modifier = Modifier,
    enabled: Boolean = true,
    compact: Boolean = false
) {
    val textures = rememberUiTextures()
    val shape = RoundedCornerShape(5.dp)
    val alpha = if (enabled) 1f else 0.48f
    val buttonPadding = PaddingValues(
        horizontal = 14.dp,
        vertical = if (compact) 8.dp else 10.dp,
    )
    val boxModifier = modifier
        .defaultMinSize(
            minWidth = if (compact) 76.dp else 132.dp,
            minHeight = if (compact) 42.dp else 48.dp,
        )
        .clickable(enabled = enabled, onClick = onClick)

    if (textures.buttonFrame != null) {
        NineSliceBox(
            frame = textures.buttonFrame,
            slicePx = textures.buttonSlice,
            modifier = boxModifier,
            contentPadding = buttonPadding,
            cornerRadius = 5.dp,
            backgroundAlpha = 0.98f,
        ) {
            Text(
                text = text,
                style = if (compact) MaterialTheme.typography.labelMedium else MaterialTheme.typography.titleSmall,
                fontWeight = FontWeight.Bold,
                color = if (enabled) ClassicShellColors.Text else ClassicShellColors.MutedText.copy(alpha = alpha),
            )
        }
    } else {
        Box(
            modifier = boxModifier
                .clip(shape)
                .background(
                    Brush.verticalGradient(
                        listOf(
                            ClassicShellColors.StoneLight.copy(alpha = 0.9f * alpha),
                            ClassicShellColors.Stone.copy(alpha = 0.94f * alpha),
                            ClassicShellColors.Iron.copy(alpha = 0.98f * alpha),
                        ),
                    ),
                )
                .border(1.dp, ClassicShellColors.IronBright.copy(alpha = 0.68f * alpha), shape)
                .border(2.dp, ClassicShellColors.Iron.copy(alpha = 0.5f), shape)
                .padding(buttonPadding),
            contentAlignment = Alignment.Center,
        ) {
            Text(
                text = text,
                style = if (compact) MaterialTheme.typography.labelMedium else MaterialTheme.typography.titleSmall,
                fontWeight = FontWeight.Bold,
                color = if (enabled) ClassicShellColors.Text else ClassicShellColors.MutedText,
            )
        }
    }
}

@Composable
fun ClassicActionRingButton(
    onClick: () -> Unit,
    modifier: Modifier = Modifier,
    danger: Boolean = false,
    content: @Composable BoxScope.() -> Unit,
) {
    val textures = rememberUiTextures()
    val texture = when {
        danger && textures.actionRingDanger != null -> textures.actionRingDanger
        textures.actionRing != null -> textures.actionRing
        else -> null
    }
    val clickModifier = modifier.clickable(onClick = onClick)
    if (texture != null) {
        TextureCircleBox(texture = texture, modifier = clickModifier, content = content)
    } else {
        Box(
            modifier = clickModifier
                .clip(CircleShape)
                .background(
                    if (danger) ClassicShellColors.Danger.copy(alpha = 0.92f)
                    else ClassicShellColors.Stone.copy(alpha = 0.92f),
                )
                .border(
                    1.dp,
                    if (danger) ClassicShellColors.Brass.copy(alpha = 0.85f)
                    else ClassicShellColors.IronBright.copy(alpha = 0.75f),
                    CircleShape,
                ),
            contentAlignment = Alignment.Center,
            content = content,
        )
    }
}

@Composable
fun ClassicStatusDot(color: Color, modifier: Modifier = Modifier) {
    Box(
        modifier = modifier
            .clip(CircleShape)
            .background(color)
            .border(1.dp, Color.White.copy(alpha = 0.35f), CircleShape)
    )
}
