package com.akalynth.client.ui.components

import androidx.compose.foundation.Canvas
import androidx.compose.foundation.background
import androidx.compose.runtime.Composable
import androidx.compose.runtime.remember
import androidx.compose.ui.Modifier
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Size
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.drawscope.DrawScope
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.unit.dp
import com.akalynth.client.game.MapRepository
import com.akalynth.client.protocol.MapData
import com.akalynth.client.protocol.MapName
import com.akalynth.client.protocol.PlayerPublic
import com.akalynth.client.protocol.PlayerStatus
import com.akalynth.client.protocol.TileCode

// Tile colors keyed by the canonical TileCode (mirrors packages/shared/types.ts TileCode).
private val TILE_GRASS = Color(0xFF2D5A27)
private val TILE_STONE = Color(0xFF6B6B6B)
private val TILE_WALL = Color(0xFF3D3D3D)
private val TILE_WATER = Color(0xFF1E5F8A)
private val TILE_DOOR = Color(0xFF8B4513)
private val TILE_TUTORIAL = Color(0xFF4A6741)
private val TILE_GATE = Color(0xFFD4AF37)
private val TILE_UNKNOWN = Color(0xFF222222)

private val PLAYER_SELF = Color(0xFF4CAF50)
private val PLAYER_OTHER = Color(0xFF2196F3)
private val PLAYER_DEAD = Color(0xFF9E9E9E)

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
        modifier = modifier.background(Color(0xFF1A1A1A))
    ) {
        val tileSize = 32.dp.toPx()
        val centerX = size.width / 2
        val centerY = size.height / 2

        me?.let { player ->
            val visibleTilesX = (size.width / tileSize / 2).toInt() + 2
            val visibleTilesY = (size.height / tileSize / 2).toInt() + 2

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
                radius = tileSize / 3,
                isDead = player.status == PlayerStatus.DEAD,
                isSelf = true
            )
        }
    }
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
