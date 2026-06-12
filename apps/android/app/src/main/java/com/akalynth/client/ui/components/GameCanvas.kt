package com.akalynth.client.ui.components

import androidx.compose.foundation.Canvas
import androidx.compose.foundation.background
import androidx.compose.runtime.Composable
import androidx.compose.runtime.remember
import androidx.compose.ui.Modifier
import androidx.compose.ui.geometry.CornerRadius
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Size
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.drawscope.DrawScope
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.unit.dp
import com.akalynth.client.game.MapRepository
import com.akalynth.client.protocol.MapData
import com.akalynth.client.protocol.MapName
import com.akalynth.client.protocol.PlayerPublic
import com.akalynth.client.protocol.PlayerStatus
import com.akalynth.client.protocol.TileCode

// Tile colors keyed by the canonical TileCode (mirrors packages/shared/types.ts TileCode).
private val TILE_GRASS = Color(0xFF275522)
private val TILE_STONE = Color(0xFF595C55)
private val TILE_WALL = Color(0xFF2A2D2B)
private val TILE_WATER = Color(0xFF185B77)
private val TILE_DOOR = Color(0xFF7A4A24)
private val TILE_TUTORIAL = Color(0xFF435D39)
private val TILE_GATE = Color(0xFFCDAF4A)
private val TILE_UNKNOWN = Color(0xFF111313)

private val PLAYER_SELF = Color(0xFF42E66B)
private val PLAYER_OTHER = Color(0xFF8FD3D6)
private val PLAYER_DEAD = Color(0xFF9E9E9E)

private val OVERLAY_COBBLE = Color(0xFF6B6150)
private val OVERLAY_STONE = Color(0xFF484B45)
private val OVERLAY_WOOD = Color(0xFF6F4C27)
private val OVERLAY_WALL = Color(0xFF313531)
private val OVERLAY_WALL_LIGHT = Color(0xFF8B8A78)
private val OVERLAY_BRASS = Color(0xFFCDAF4A)
private val OVERLAY_BLUE = Color(0xFF1D66BA)
private val OVERLAY_RED = Color(0xFFA93220)
private val OVERLAY_WATER = Color(0xFF4CC9F0)
private val OVERLAY_BOARD = Color(0xFF8A5A2B)
private val OVERLAY_SHADOW = Color(0x66000000)

private fun colorFor(tile: TileCode): Color = when (tile) {
    TileCode.GRASS -> TILE_GRASS
    TileCode.STONE -> TILE_STONE
    TileCode.WALL -> TILE_WALL
    TileCode.WATER -> TILE_WATER
    TileCode.DOOR -> TILE_DOOR
    TileCode.TUTORIAL_MOVE,
    TileCode.TUTORIAL_CHAT,
    TileCode.TUTORIAL_TEM -> TILE_TUTORIAL
    TileCode.GATE_TO_AZURA -> TILE_GATE
    TileCode.UNKNOWN -> TILE_UNKNOWN
}

/**
 * Renders the world around the player using the real canonical map tile grid
 * (see [MapRepository] / `packages/shared/maps`). Out-of-bounds cells render as wall.
 *
 * Display-only: the server remains authoritative for walkability and collision. Tiles are read
 * solely to draw, never to gate movement.
 */
@Composable
fun GameCanvas(
    map: MapName,
    me: PlayerPublic?,
    others: List<PlayerPublic>,
    modifier: Modifier = Modifier
) {
    val context = LocalContext.current
    // Loaded once per map; MapRepository caches across recompositions.
    val mapData: MapData? = remember(map) { MapRepository.load(context, map) }

    Canvas(
        modifier = modifier.background(Color(0xFF090A0A))
    ) {
        val tileSize = 36.dp.toPx()
        val centerX = size.width / 2
        val centerY = size.height / 2

        me?.let { player ->
            val visibleTilesX = (size.width / tileSize / 2).toInt() + 2
            val visibleTilesY = (size.height / tileSize / 2).toInt() + 2
            val visualLandmarks = highCityVisualLandmarksFor(map)

            for (dy in -visibleTilesY..visibleTilesY) {
                for (dx in -visibleTilesX..visibleTilesX) {
                    val tileX = player.x + dx
                    val tileY = player.y + dy

                    val screenX = centerX + (dx * tileSize) - tileSize / 2
                    val screenY = centerY + (dy * tileSize) - tileSize / 2

                    // Real tile from canonical map data; wall outside bounds. If the asset failed to
                    // load, fall back to a neutral void rather than fabricating terrain.
                    val tile = mapData?.tileAt(tileX, tileY) ?: TileCode.UNKNOWN

                    drawRect(
                        color = colorFor(tile),
                        topLeft = Offset(screenX, screenY),
                        size = Size(tileSize - 1, tileSize - 1)
                    )
                }
            }

            drawHighCityVisualLandmarks(
                landmarks = visualLandmarks.filter { it.isFloor },
                player = player,
                tileSize = tileSize,
                centerX = centerX,
                centerY = centerY
            )
            drawHighCityVisualLandmarks(
                landmarks = visualLandmarks.filterNot { it.isFloor },
                player = player,
                tileSize = tileSize,
                centerX = centerX,
                centerY = centerY
            )

            // Draw other players
            others.forEach { other ->
                val offsetX = (other.x - player.x) * tileSize
                val offsetY = (other.y - player.y) * tileSize

                drawPlayer(
                    x = centerX + offsetX,
                    y = centerY + offsetY,
                    radius = tileSize / 3,
                    isDead = other.status == PlayerStatus.DEAD,
                    isSelf = false
                )
            }

            // Draw self (always center)
            drawPlayer(
                x = centerX,
                y = centerY,
                radius = tileSize / 2.7f,
                isDead = player.status == PlayerStatus.DEAD,
                isSelf = true
            )
        }
    }
}

private fun DrawScope.drawHighCityVisualLandmarks(
    landmarks: List<HighCityVisualLandmark>,
    player: PlayerPublic,
    tileSize: Float,
    centerX: Float,
    centerY: Float
) {
    landmarks.forEach { landmark ->
        val topLeft = tileTopLeft(landmark.x, landmark.y, player, tileSize, centerX, centerY)
        drawHighCityVisualLandmark(landmark, topLeft, tileSize)
    }
}

private fun tileTopLeft(
    tileX: Int,
    tileY: Int,
    player: PlayerPublic,
    tileSize: Float,
    centerX: Float,
    centerY: Float
): Offset {
    val offsetX = (tileX - player.x) * tileSize
    val offsetY = (tileY - player.y) * tileSize
    return Offset(
        x = centerX + offsetX - tileSize / 2,
        y = centerY + offsetY - tileSize / 2
    )
}

private fun DrawScope.drawHighCityVisualLandmark(
    landmark: HighCityVisualLandmark,
    topLeft: Offset,
    tileSize: Float
) {
    when (landmark.kind) {
        HighCityVisualKind.COBBLE_FLOOR -> drawFloor(topLeft, tileSize, OVERLAY_COBBLE)
        HighCityVisualKind.STONE_FLOOR -> drawFloor(topLeft, tileSize, OVERLAY_STONE)
        HighCityVisualKind.WOOD_FLOOR -> drawFloor(topLeft, tileSize, OVERLAY_WOOD)
        HighCityVisualKind.STONE_WALL -> drawStoneBlock(topLeft, tileSize, raised = false)
        HighCityVisualKind.STONE_COLUMN -> drawStoneBlock(topLeft, tileSize, raised = true)
        HighCityVisualKind.CLOSED_DOOR -> drawClosedDoor(topLeft, tileSize)
        HighCityVisualKind.FOUNTAIN -> drawFountain(topLeft, tileSize)
        HighCityVisualKind.NOTICE_BOARD -> drawNoticeBoard(topLeft, tileSize)
        HighCityVisualKind.BANNER_BLUE -> drawBanner(topLeft, tileSize, OVERLAY_BLUE)
        HighCityVisualKind.BANNER_RED -> drawBanner(topLeft, tileSize, OVERLAY_RED)
        HighCityVisualKind.BENCH -> drawBench(topLeft, tileSize)
    }
}

private fun DrawScope.drawFloor(topLeft: Offset, tileSize: Float, color: Color) {
    drawRect(
        color = color.copy(alpha = 0.88f),
        topLeft = topLeft,
        size = Size(tileSize - 1f, tileSize - 1f)
    )
    drawLine(
        color = Color.Black.copy(alpha = 0.18f),
        start = Offset(topLeft.x, topLeft.y + tileSize * 0.48f),
        end = Offset(topLeft.x + tileSize, topLeft.y + tileSize * 0.48f),
        strokeWidth = 1f
    )
    drawLine(
        color = Color.White.copy(alpha = 0.08f),
        start = Offset(topLeft.x + tileSize * 0.52f, topLeft.y),
        end = Offset(topLeft.x + tileSize * 0.52f, topLeft.y + tileSize),
        strokeWidth = 1f
    )
}

private fun DrawScope.drawStoneBlock(topLeft: Offset, tileSize: Float, raised: Boolean) {
    val inset = if (raised) tileSize * 0.12f else tileSize * 0.04f
    val size = tileSize - inset * 2f
    drawRect(
        color = OVERLAY_SHADOW,
        topLeft = Offset(topLeft.x + inset + 2f, topLeft.y + inset + 2f),
        size = Size(size, size)
    )
    drawRect(
        color = if (raised) OVERLAY_WALL_LIGHT else OVERLAY_WALL,
        topLeft = Offset(topLeft.x + inset, topLeft.y + inset),
        size = Size(size, size)
    )
    drawRect(
        color = Color.Black.copy(alpha = 0.38f),
        topLeft = Offset(topLeft.x + inset, topLeft.y + inset),
        size = Size(size, size),
        style = Stroke(width = 1.5f)
    )
}

private fun DrawScope.drawClosedDoor(topLeft: Offset, tileSize: Float) {
    val doorWidth = tileSize * 0.56f
    val doorHeight = tileSize * 0.78f
    val doorTopLeft = Offset(
        topLeft.x + (tileSize - doorWidth) / 2f,
        topLeft.y + tileSize - doorHeight
    )
    drawRoundRect(
        color = Color(0xFF5E351A),
        topLeft = doorTopLeft,
        size = Size(doorWidth, doorHeight),
        cornerRadius = CornerRadius(tileSize * 0.08f, tileSize * 0.08f)
    )
    drawRect(
        color = OVERLAY_BRASS,
        topLeft = Offset(doorTopLeft.x + doorWidth * 0.68f, doorTopLeft.y + doorHeight * 0.48f),
        size = Size(tileSize * 0.08f, tileSize * 0.08f)
    )
}

private fun DrawScope.drawFountain(topLeft: Offset, tileSize: Float) {
    val center = Offset(topLeft.x + tileSize / 2f, topLeft.y + tileSize / 2f)
    drawCircle(
        color = OVERLAY_SHADOW,
        radius = tileSize * 0.52f,
        center = Offset(center.x + 2f, center.y + 2f)
    )
    drawCircle(
        color = OVERLAY_WALL_LIGHT,
        radius = tileSize * 0.5f,
        center = center
    )
    drawCircle(
        color = OVERLAY_WATER,
        radius = tileSize * 0.36f,
        center = center
    )
    drawCircle(
        color = Color.White.copy(alpha = 0.72f),
        radius = tileSize * 0.12f,
        center = Offset(center.x, center.y - tileSize * 0.08f)
    )
    drawLine(
        color = Color.White.copy(alpha = 0.68f),
        start = Offset(center.x, center.y - tileSize * 0.44f),
        end = Offset(center.x, center.y + tileSize * 0.16f),
        strokeWidth = 2f
    )
}

private fun DrawScope.drawNoticeBoard(topLeft: Offset, tileSize: Float) {
    val boardTopLeft = Offset(topLeft.x + tileSize * 0.18f, topLeft.y + tileSize * 0.24f)
    val boardSize = Size(tileSize * 0.64f, tileSize * 0.38f)
    drawLine(
        color = Color(0xFF3B2818),
        start = Offset(topLeft.x + tileSize * 0.28f, topLeft.y + tileSize * 0.58f),
        end = Offset(topLeft.x + tileSize * 0.28f, topLeft.y + tileSize * 0.9f),
        strokeWidth = 3f
    )
    drawLine(
        color = Color(0xFF3B2818),
        start = Offset(topLeft.x + tileSize * 0.72f, topLeft.y + tileSize * 0.58f),
        end = Offset(topLeft.x + tileSize * 0.72f, topLeft.y + tileSize * 0.9f),
        strokeWidth = 3f
    )
    drawRect(color = OVERLAY_BOARD, topLeft = boardTopLeft, size = boardSize)
    drawRect(
        color = OVERLAY_BRASS.copy(alpha = 0.85f),
        topLeft = Offset(boardTopLeft.x + boardSize.width * 0.18f, boardTopLeft.y + boardSize.height * 0.18f),
        size = Size(boardSize.width * 0.26f, boardSize.height * 0.5f)
    )
}

private fun DrawScope.drawBanner(topLeft: Offset, tileSize: Float, bannerColor: Color) {
    val poleX = topLeft.x + tileSize * 0.5f
    drawLine(
        color = OVERLAY_BRASS,
        start = Offset(poleX, topLeft.y + tileSize * 0.12f),
        end = Offset(poleX, topLeft.y + tileSize * 0.9f),
        strokeWidth = 3f
    )
    drawRect(
        color = bannerColor,
        topLeft = Offset(poleX, topLeft.y + tileSize * 0.2f),
        size = Size(tileSize * 0.34f, tileSize * 0.42f)
    )
    drawRect(
        color = OVERLAY_BRASS.copy(alpha = 0.75f),
        topLeft = Offset(poleX + tileSize * 0.08f, topLeft.y + tileSize * 0.28f),
        size = Size(tileSize * 0.08f, tileSize * 0.22f)
    )
}

private fun DrawScope.drawBench(topLeft: Offset, tileSize: Float) {
    val benchTopLeft = Offset(topLeft.x - tileSize * 0.32f, topLeft.y + tileSize * 0.56f)
    val benchSize = Size(tileSize * 1.64f, tileSize * 0.28f)
    drawRoundRect(
        color = OVERLAY_SHADOW,
        topLeft = Offset(benchTopLeft.x + 2f, benchTopLeft.y + 2f),
        size = benchSize,
        cornerRadius = CornerRadius(3f, 3f)
    )
    drawRoundRect(
        color = Color(0xFF6A421F),
        topLeft = benchTopLeft,
        size = benchSize,
        cornerRadius = CornerRadius(3f, 3f)
    )
    drawLine(
        color = Color(0xFFB47A36),
        start = Offset(benchTopLeft.x + tileSize * 0.12f, benchTopLeft.y + benchSize.height * 0.35f),
        end = Offset(benchTopLeft.x + benchSize.width - tileSize * 0.12f, benchTopLeft.y + benchSize.height * 0.35f),
        strokeWidth = 1.5f
    )
}

private fun DrawScope.drawPlayer(
    x: Float,
    y: Float,
    radius: Float,
    isDead: Boolean,
    isSelf: Boolean
) {
    val color = when {
        isDead -> PLAYER_DEAD
        isSelf -> PLAYER_SELF
        else -> PLAYER_OTHER
    }

    // Outer glow
    drawCircle(
        color = color.copy(alpha = 0.3f),
        radius = radius * 1.3f,
        center = Offset(x, y)
    )

    // Main circle
    drawCircle(
        color = color,
        radius = radius,
        center = Offset(x, y)
    )

    // Inner highlight
    drawCircle(
        color = Color.White.copy(alpha = 0.3f),
        radius = radius * 0.4f,
        center = Offset(x - radius * 0.2f, y - radius * 0.2f)
    )
}
