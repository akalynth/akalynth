package com.akalynth.client.ui.theme

import android.content.Context
import android.graphics.BitmapFactory
import androidx.compose.foundation.Canvas
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.BoxScope
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.wrapContentSize
import androidx.compose.runtime.Composable
import androidx.compose.runtime.remember
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.alpha
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.FilterQuality
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.ui.graphics.ImageBitmap
import androidx.compose.ui.graphics.asImageBitmap
import androidx.compose.ui.graphics.drawscope.DrawScope
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp

/** Loaded Classic 32 gameplay UI chrome (nine-slice frames + circular action buttons). */
data class UiTextures(
    val panelFrame: ImageBitmap?,
    val panelSlice: Int,
    val buttonFrame: ImageBitmap?,
    val buttonPressedFrame: ImageBitmap?,
    val buttonSlice: Int,
    val dockFrame: ImageBitmap?,
    val dockSlice: Int,
    val dpadFrame: ImageBitmap?,
    val dpadSlice: Int,
    val actionRing: ImageBitmap?,
    val actionRingPressed: ImageBitmap?,
    val actionRingDanger: ImageBitmap?,
    val dpadButton: ImageBitmap?,
    val dpadButtonPressed: ImageBitmap?,
    val hpFill: ImageBitmap?,
    val mpFill: ImageBitmap?,
    val barTrack: ImageBitmap?,
    val barSlice: Int,
)

@Composable
fun rememberUiTextures(): UiTextures {
    val context = LocalContext.current
    return remember(context) { loadUiTextures(context) }
}

private fun loadUiTextures(context: Context): UiTextures = UiTextures(
    panelFrame = loadBitmap(context, "ui/ui_panel_frame.png"),
    panelSlice = 8,
    buttonFrame = loadBitmap(context, "ui/ui_button_frame.png"),
    buttonPressedFrame = loadBitmap(context, "ui/ui_button_pressed_frame.png"),
    buttonSlice = 6,
    dockFrame = loadBitmap(context, "ui/ui_dock_frame.png"),
    dockSlice = 8,
    dpadFrame = loadBitmap(context, "ui/ui_dpad_frame.png"),
    dpadSlice = 10,
    actionRing = loadBitmap(context, "ui/ui_action_ring.png"),
    actionRingPressed = loadBitmap(context, "ui/ui_action_ring_pressed.png"),
    actionRingDanger = loadBitmap(context, "ui/ui_action_ring_danger.png"),
    dpadButton = loadBitmap(context, "ui/ui_dpad_button.png"),
    dpadButtonPressed = loadBitmap(context, "ui/ui_dpad_button_pressed.png"),
    hpFill = loadBitmap(context, "ui/ui_hp_fill.png"),
    mpFill = loadBitmap(context, "ui/ui_mp_fill.png"),
    barTrack = loadBitmap(context, "ui/ui_bar_track.png"),
    barSlice = 2,
)

private fun loadBitmap(context: Context, assetPath: String): ImageBitmap? = try {
    val opts = BitmapFactory.Options().apply { inScaled = false }
    context.assets.open(assetPath).use { BitmapFactory.decodeStream(it, null, opts)?.asImageBitmap() }
} catch (_: Exception) {
    null
}

@Composable
fun NineSliceBox(
    frame: ImageBitmap?,
    slicePx: Int,
    modifier: Modifier = Modifier,
    contentPadding: PaddingValues = PaddingValues(0.dp),
    cornerRadius: Dp = 8.dp,
    backgroundAlpha: Float = 1f,
    content: @Composable BoxScope.() -> Unit,
) {
    val shape = RoundedCornerShape(cornerRadius)
    Box(
        modifier = modifier
            .wrapContentSize()
            .clip(shape),
    ) {
        if (frame != null && slicePx > 0) {
            Canvas(
                Modifier
                    .matchParentSize()
                    .alpha(backgroundAlpha.coerceIn(0f, 1f)),
            ) {
                drawNineSlice(frame, slicePx)
            }
        }
        Box(Modifier.padding(contentPadding), content = content)
    }
}

@Composable
fun TextureCircleBox(
    texture: ImageBitmap?,
    modifier: Modifier = Modifier,
    content: @Composable BoxScope.() -> Unit,
) {
    Box(modifier = modifier.clip(CircleShape)) {
        if (texture != null) {
            Canvas(Modifier.matchParentSize()) {
                drawImage(
                    image = texture,
                    dstOffset = androidx.compose.ui.unit.IntOffset.Zero,
                    dstSize = androidx.compose.ui.unit.IntSize(size.width.toInt(), size.height.toInt()),
                    filterQuality = FilterQuality.None,
                )
            }
        }
        Box(contentAlignment = Alignment.Center, content = content)
    }
}

fun DrawScope.drawNineSlice(image: ImageBitmap, slicePx: Int) {
    val iw = image.width.toFloat()
    val ih = image.height.toFloat()
    val dw = size.width
    val dh = size.height
    val sl = slicePx.toFloat()
    val st = slicePx.toFloat()
    val sr = slicePx.toFloat()
    val sb = slicePx.toFloat()

    val leftW = sl * (dw / iw)
    val rightW = sr * (dw / iw)
    val topH = st * (dh / ih)
    val bottomH = sb * (dh / ih)
    val centerW = (dw - leftW - rightW).coerceAtLeast(0f)
    val centerH = (dh - topH - bottomH).coerceAtLeast(0f)

    val srcCenterW = (iw - sl - sr).coerceAtLeast(1f)
    val srcCenterH = (ih - st - sb).coerceAtLeast(1f)

    fun blit(
        srcX: Float,
        srcY: Float,
        srcW: Float,
        srcH: Float,
        dstX: Float,
        dstY: Float,
        dstW: Float,
        dstH: Float,
    ) {
        if (dstW <= 0f || dstH <= 0f) return
        drawImage(
            image = image,
            srcOffset = androidx.compose.ui.unit.IntOffset(srcX.toInt(), srcY.toInt()),
            srcSize = androidx.compose.ui.unit.IntSize(srcW.toInt().coerceAtLeast(1), srcH.toInt().coerceAtLeast(1)),
            dstOffset = androidx.compose.ui.unit.IntOffset(dstX.toInt(), dstY.toInt()),
            dstSize = androidx.compose.ui.unit.IntSize(dstW.toInt().coerceAtLeast(1), dstH.toInt().coerceAtLeast(1)),
            filterQuality = FilterQuality.None,
        )
    }

    // corners
    blit(0f, 0f, sl, st, 0f, 0f, leftW, topH)
    blit(iw - sr, 0f, sr, st, dw - rightW, 0f, rightW, topH)
    blit(0f, ih - sb, sl, sb, 0f, dh - bottomH, leftW, bottomH)
    blit(iw - sr, ih - sb, sr, sb, dw - rightW, dh - bottomH, rightW, bottomH)
    // edges
    blit(sl, 0f, srcCenterW, st, leftW, 0f, centerW, topH)
    blit(sl, ih - sb, srcCenterW, sb, leftW, dh - bottomH, centerW, bottomH)
    blit(0f, st, sl, srcCenterH, 0f, topH, leftW, centerH)
    blit(iw - sr, st, sr, srcCenterH, dw - rightW, topH, rightW, centerH)
    // center
    blit(sl, st, srcCenterW, srcCenterH, leftW, topH, centerW, centerH)
}

@Composable
fun ClassicResourceBar(
    label: String,
    fraction: Float,
    fill: ImageBitmap?,
    track: ImageBitmap?,
    slicePx: Int,
    modifier: Modifier = Modifier,
    height: Dp = 8.dp,
) {
    val clamped = fraction.coerceIn(0f, 1f)
    Box(modifier = modifier.height(height)) {
        if (track != null) {
            NineSliceBox(
                frame = track,
                slicePx = slicePx,
                modifier = Modifier.matchParentSize(),
                cornerRadius = 3.dp,
            ) {}
        }
        if (fill != null && clamped > 0f) {
            Canvas(
                Modifier
                    .fillMaxSize()
                    .padding(horizontal = 2.dp, vertical = 1.dp),
            ) {
                val barW = size.width * clamped
                drawNineSliceScaled(fill, slicePx, barW, size.height)
            }
        }
    }
}

private fun DrawScope.drawNineSliceScaled(image: ImageBitmap, slicePx: Int, dstW: Float, dstH: Float) {
    val iw = image.width.toFloat()
    val ih = image.height.toFloat()
    val sl = slicePx.toFloat()
    val st = slicePx.toFloat()
    val sr = slicePx.toFloat()
    val sb = slicePx.toFloat()
    val leftW = sl * (dstW / iw)
    val rightW = sr * (dstW / iw)
    val topH = st * (dstH / ih)
    val bottomH = sb * (dstH / ih)
    val centerW = (dstW - leftW - rightW).coerceAtLeast(0f)
    val centerH = (dstH - topH - bottomH).coerceAtLeast(0f)
    val srcCenterW = (iw - sl - sr).coerceAtLeast(1f)
    val srcCenterH = (ih - st - sb).coerceAtLeast(1f)

    fun blit(
        srcX: Float,
        srcY: Float,
        srcW: Float,
        srcH: Float,
        dstX: Float,
        dstY: Float,
        dstBlitW: Float,
        dstBlitH: Float,
    ) {
        if (dstBlitW <= 0f || dstBlitH <= 0f) return
        drawImage(
            image = image,
            srcOffset = androidx.compose.ui.unit.IntOffset(srcX.toInt(), srcY.toInt()),
            srcSize = androidx.compose.ui.unit.IntSize(srcW.toInt().coerceAtLeast(1), srcH.toInt().coerceAtLeast(1)),
            dstOffset = androidx.compose.ui.unit.IntOffset(dstX.toInt(), dstY.toInt()),
            dstSize = androidx.compose.ui.unit.IntSize(dstBlitW.toInt().coerceAtLeast(1), dstBlitH.toInt().coerceAtLeast(1)),
            filterQuality = FilterQuality.None,
        )
    }

    blit(0f, 0f, sl, st, 0f, 0f, leftW, topH)
    blit(iw - sr, 0f, sr, st, dstW - rightW, 0f, rightW, topH)
    blit(0f, ih - sb, sl, sb, 0f, dstH - bottomH, leftW, bottomH)
    blit(iw - sr, ih - sb, sr, sb, dstW - rightW, dstH - bottomH, rightW, bottomH)
    blit(sl, 0f, srcCenterW, st, leftW, 0f, centerW, topH)
    blit(sl, ih - sb, srcCenterW, sb, leftW, dstH - bottomH, centerW, bottomH)
    blit(0f, st, sl, srcCenterH, 0f, topH, leftW, centerH)
    blit(iw - sr, st, sr, srcCenterH, dstW - rightW, topH, rightW, centerH)
    blit(sl, st, srcCenterW, srcCenterH, leftW, topH, centerW, centerH)
}