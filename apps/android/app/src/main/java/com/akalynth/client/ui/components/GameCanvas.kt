package com.akalynth.client.ui.components

import androidx.compose.foundation.Canvas
import androidx.compose.foundation.background
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.remember
import androidx.compose.ui.Modifier
import androidx.compose.ui.geometry.CornerRadius
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Size
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.FilterQuality
import androidx.compose.ui.graphics.drawscope.DrawScope
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.unit.IntOffset
import androidx.compose.ui.unit.IntSize
import androidx.compose.ui.unit.dp
import com.akalynth.client.game.MapRepository
import com.akalynth.client.game.RegistryPlacement
import com.akalynth.client.game.WorldPlacementRepository
import com.akalynth.client.protocol.MapData
import com.akalynth.client.protocol.MapName
import com.akalynth.client.protocol.PlayerPublic
import com.akalynth.client.protocol.PlayerStatus
import com.akalynth.client.protocol.TileCode
import com.akalynth.client.ui.render.ApplyRequestedFrameRate
import com.akalynth.client.ui.render.AssetRegistry
import com.akalynth.client.ui.render.EntityInterpolator
import com.akalynth.client.ui.render.RenderClock
import com.akalynth.client.ui.render.TilePos
import com.akalynth.client.ui.render.WorldSprite
import com.akalynth.client.ui.render.drawRegistryWorldOverlay
import com.akalynth.client.ui.render.rememberAssetRegistry
import com.akalynth.client.ui.render.rememberThermalTargetFps
import com.akalynth.client.ui.render.rememberOutfitRecolorCache
import com.akalynth.client.ui.render.rememberWorldSprites
import kotlin.math.floor
import kotlin.math.roundToInt

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
private const val ROOKGUARD_TRAINING_SLIME_SPRITE_ID = "akalynth_creature_rookguard_training_slime_001"

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
 * Display-only: the server remains authoritative for walkability, collision, and position. The
 * incoming integer tile positions are fed into a render-layer [EntityInterpolator] so the camera
 * and other players glide smoothly between confirmed tiles instead of teleporting; nothing here is
 * ever computed as truth or sent back. Redraws are paced by a [RenderClock] (capped, thermal-aware)
 * that parks when the world is still.
 */
@Composable
fun GameCanvas(
    map: MapName,
    me: PlayerPublic?,
    others: List<PlayerPublic>,
    objectiveMarkers: List<Pair<Int, Int>> = emptyList(),
    modifier: Modifier = Modifier
) {
    val context = LocalContext.current
    // Loaded once per map; MapRepository caches across recompositions.
    val mapData: MapData? = remember(map) { MapRepository.load(context, map) }

    val interpolator = remember { EntityInterpolator() }
    val targetFps = rememberThermalTargetFps(baseFps = 30)
    ApplyRequestedFrameRate(targetFps.value)
    val clock = remember { RenderClock(targetFps = { targetFps.value }) }
    // Display-only pixel art bundled in assets; absent keys fall back to procedural shapes below.
    val sprites = rememberWorldSprites()
    val outfitRecolorCache = rememberOutfitRecolorCache()
    // World PNG overlays from compiled registry.json; absent keys fall back to procedural landmarks.
    val assetRegistry = rememberAssetRegistry()
    // Registry-driven placements (e.g. Rookguard overlays from placements/rookguard-overlays.json).
    val registryPlacements = remember(map) {
        WorldPlacementRepository.registryPlacementsFor(context, map)
    }

    // A stable signature of the authoritative positions: changes only when a real position does,
    // so we feed new glide targets (and prune absent entities) exactly on snapshot changes rather
    // than on every recomposition.
    val snapshotKey = buildString {
        append(me?.id).append('@').append(me?.x).append(',').append(me?.y)
        others.forEach { append('|').append(it.id).append('@').append(it.x).append(',').append(it.y) }
    }
    LaunchedEffect(snapshotKey) {
        val now = clock.nowMs()
        me?.let { interpolator.setTarget(it.id, it.x, it.y, now) }
        others.forEach { interpolator.setTarget(it.id, it.x, it.y, now) }
        val live = buildSet {
            me?.let { add(it.id) }
            others.forEach { add(it.id) }
        }
        interpolator.retain(live)
        clock.wake()
    }

    // Choreographer-paced redraw loop; parks when motion settles.
    LaunchedEffect(clock) {
        clock.run { now -> interpolator.isAnimating(now) }
    }

    Canvas(
        modifier = modifier.background(Color(0xFF090A0A))
    ) {
        val player = me ?: return@Canvas
        val now = clock.frameTimeMs.value
        val camera = interpolator.positionOf(player.id, now)
            ?: TilePos(player.x.toFloat(), player.y.toFloat())
        val camX = camera.x
        val camY = camera.y

        val tileSize = 36.dp.toPx()
        val centerX = size.width / 2
        val centerY = size.height / 2
        // +3 tiles of margin so sub-tile camera scrolling never reveals an unpainted edge.
        val visibleTilesX = (size.width / tileSize / 2).toInt() + 3
        val visibleTilesY = (size.height / tileSize / 2).toInt() + 3
        val baseTileX = floor(camX).toInt()
        val baseTileY = floor(camY).toInt()
        val visualLandmarks = highCityVisualLandmarksFor(map)

        for (dy in -visibleTilesY..visibleTilesY) {
            for (dx in -visibleTilesX..visibleTilesX) {
                val tileX = baseTileX + dx
                val tileY = baseTileY + dy

                val screenX = centerX + (tileX - camX) * tileSize - tileSize / 2
                val screenY = centerY + (tileY - camY) * tileSize - tileSize / 2

                // Real tile from canonical map data; wall outside bounds. If the asset failed to
                // load, fall back to a neutral void rather than fabricating terrain.
                val tile = mapData?.tileAt(tileX, tileY) ?: TileCode.UNKNOWN

                val tileSprite = sprites.tiles[tile]
                if (tileSprite != null) {
                    drawTileSprite(tileSprite, screenX, screenY, tileSize)
                } else {
                    drawRect(
                        color = colorFor(tile),
                        topLeft = Offset(screenX, screenY),
                        size = Size(tileSize - 1, tileSize - 1)
                    )
                }
            }
        }

        drawRegistryPlacements(
            placements = registryPlacements.filter { placement ->
                isFloorRegistryPlacement(placement, assetRegistry)
            },
            cameraX = camX,
            cameraY = camY,
            tileSize = tileSize,
            centerX = centerX,
            centerY = centerY,
            assetRegistry = assetRegistry,
        )
        drawHighCityVisualLandmarks(
            landmarks = visualLandmarks.filter { it.isFloor },
            cameraX = camX,
            cameraY = camY,
            tileSize = tileSize,
            centerX = centerX,
            centerY = centerY,
            assetRegistry = assetRegistry,
        )
        drawRegistryPlacements(
            placements = registryPlacements.filter { placement ->
                !isFloorRegistryPlacement(placement, assetRegistry)
            },
            cameraX = camX,
            cameraY = camY,
            tileSize = tileSize,
            centerX = centerX,
            centerY = centerY,
            assetRegistry = assetRegistry,
        )
        drawHighCityVisualLandmarks(
            landmarks = visualLandmarks.filterNot { it.isFloor },
            cameraX = camX,
            cameraY = camY,
            tileSize = tileSize,
            centerX = centerX,
            centerY = centerY,
            assetRegistry = assetRegistry,
        )

        objectiveMarkers.forEach { (tileX, tileY) ->
            val screenX = centerX + (tileX - camX) * tileSize - tileSize / 2
            val screenY = centerY + (tileY - camY) * tileSize - tileSize / 2
            drawRect(
                color = OVERLAY_BRASS.copy(alpha = 0.55f),
                topLeft = Offset(screenX, screenY),
                size = Size(tileSize - 2, tileSize - 2),
                style = Stroke(width = 3f)
            )
        }

        // Other players, drawn at their smoothed positions but with authoritative status/sprite.
        others.forEach { other ->
            val pos = interpolator.positionOf(other.id, now)
                ?: TilePos(other.x.toFloat(), other.y.toFloat())
            val ex = centerX + (pos.x - camX) * tileSize
            val ey = centerY + (pos.y - camY) * tileSize
            val baseCharacter = other.spriteId?.let { sprites.characters[it] }
            val creatureSprite = other.spriteId?.let { id ->
                sprites.creatures[id]
                    ?: outfitRecolorCache.resolve(context, id, baseCharacter, other.outfitColors)
                    ?: baseCharacter
            }
            if (creatureSprite != null && other.status != PlayerStatus.DEAD) {
                drawCreatureSprite(creatureSprite, ex, ey, tileSize)
            } else {
                drawPlayer(
                    x = ex,
                    y = ey,
                    radius = tileSize / 3,
                    isDead = other.status == PlayerStatus.DEAD,
                    isSelf = false,
                    spriteId = other.spriteId
                )
            }
        }

        // Draw self (always at the camera centre, since the camera follows the smoothed self).
        val selfBase = player.spriteId?.let { sprites.characters[it] }
        val selfSprite = player.spriteId?.let { id ->
            outfitRecolorCache.resolve(context, id, selfBase, player.outfitColors) ?: selfBase
        }
        if (selfSprite != null && player.status != PlayerStatus.DEAD) {
            drawCreatureSprite(selfSprite, centerX, centerY, tileSize)
        } else {
            drawPlayer(
                x = centerX,
                y = centerY,
                radius = tileSize / 2.7f,
                isDead = player.status == PlayerStatus.DEAD,
                isSelf = true,
                spriteId = player.spriteId
            )
        }
    }
}

/**
 * Draw a tile sprite into the cell whose top-left is ([cellX],[cellY]). Multi-tile sprites are
 * bottom-anchored (a 1x2 wall fills this cell and extends one tile upward, the classic top-down
 * look). Nearest-neighbor filtering keeps the pixel art crisp.
 */
private fun DrawScope.drawTileSprite(sprite: WorldSprite, cellX: Float, cellY: Float, tileSize: Float) {
    val wPx = sprite.tilesWide * tileSize
    val hPx = sprite.tilesTall * tileSize
    val topY = cellY - (sprite.tilesTall - 1) * tileSize
    drawImage(
        image = sprite.image,
        srcOffset = IntOffset.Zero,
        srcSize = IntSize(sprite.image.width, sprite.image.height),
        dstOffset = IntOffset(cellX.roundToInt(), topY.roundToInt()),
        dstSize = IntSize(wPx.roundToInt(), hPx.roundToInt()),
        filterQuality = FilterQuality.None
    )
}

/** Draw a creature sprite with its feet near the tile centre ([cx],[cy]); tall sprites rise upward. */
private fun DrawScope.drawCreatureSprite(sprite: WorldSprite, cx: Float, cy: Float, tileSize: Float) {
    val wPx = sprite.tilesWide * tileSize
    val hPx = sprite.tilesTall * tileSize
    val left = cx - wPx / 2f
    val top = (cy + tileSize / 2f) - hPx
    drawImage(
        image = sprite.image,
        srcOffset = IntOffset.Zero,
        srcSize = IntSize(sprite.image.width, sprite.image.height),
        dstOffset = IntOffset(left.roundToInt(), top.roundToInt()),
        dstSize = IntSize(wPx.roundToInt(), hPx.roundToInt()),
        filterQuality = FilterQuality.None
    )
}

private fun isFloorRegistryPlacement(placement: RegistryPlacement, assetRegistry: AssetRegistry): Boolean {
    val layer = assetRegistry.spriteForShortId(placement.assetId)?.layer ?: return false
    return layer == "terrain" || layer == "floor_overlay"
}

private fun DrawScope.drawRegistryPlacements(
    placements: List<RegistryPlacement>,
    cameraX: Float,
    cameraY: Float,
    tileSize: Float,
    centerX: Float,
    centerY: Float,
    assetRegistry: AssetRegistry,
) {
    placements.forEach { placement ->
        if (placement.visibility == "hidden") return@forEach
        val sprite = assetRegistry.spriteForShortId(placement.assetId) ?: return@forEach
        val topLeft = tileTopLeft(placement.x, placement.y, cameraX, cameraY, tileSize, centerX, centerY)
        drawRegistryWorldOverlay(sprite, topLeft, tileSize)
    }
}

private fun DrawScope.drawHighCityVisualLandmarks(
    landmarks: List<HighCityVisualLandmark>,
    cameraX: Float,
    cameraY: Float,
    tileSize: Float,
    centerX: Float,
    centerY: Float,
    assetRegistry: AssetRegistry,
) {
    landmarks.forEach { landmark ->
        val topLeft = tileTopLeft(landmark.x, landmark.y, cameraX, cameraY, tileSize, centerX, centerY)
        drawHighCityVisualLandmark(landmark, topLeft, tileSize, assetRegistry)
    }
}

private fun tileTopLeft(
    tileX: Int,
    tileY: Int,
    cameraX: Float,
    cameraY: Float,
    tileSize: Float,
    centerX: Float,
    centerY: Float
): Offset {
    val offsetX = (tileX - cameraX) * tileSize
    val offsetY = (tileY - cameraY) * tileSize
    return Offset(
        x = centerX + offsetX - tileSize / 2,
        y = centerY + offsetY - tileSize / 2
    )
}

private fun DrawScope.drawHighCityVisualLandmark(
    landmark: HighCityVisualLandmark,
    topLeft: Offset,
    tileSize: Float,
    assetRegistry: AssetRegistry,
) {
    val registrySprite = assetRegistry.sprite(landmark.kind.registryAssetId)
    if (registrySprite != null) {
        drawRegistryWorldOverlay(registrySprite, topLeft, tileSize)
        return
    }

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
    isSelf: Boolean,
    spriteId: String?
) {
    if (spriteId == ROOKGUARD_TRAINING_SLIME_SPRITE_ID) {
        drawRookguardTrainingSlime(x = x, y = y, radius = radius, isDead = isDead)
        return
    }

    val color = when {
        isDead -> PLAYER_DEAD
        spriteId == "guard_city_01" -> Color(0xFF6FA8DC)
        spriteId == "mage_apprentice_01" -> Color(0xFFB98CFF)
        spriteId == "base_human_male_01" -> PLAYER_SELF
        isSelf -> PLAYER_SELF
        else -> PLAYER_OTHER
    }
    val accent = when (spriteId) {
        "guard_city_01" -> Color(0xFFCDAF4A)
        "mage_apprentice_01" -> Color(0xFFE6D7FF)
        else -> Color.White.copy(alpha = 0.3f)
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
        color = accent,
        radius = radius * 0.4f,
        center = Offset(x - radius * 0.2f, y - radius * 0.2f)
    )

    if (!isDead && (spriteId == "guard_city_01" || spriteId == "mage_apprentice_01")) {
        drawLine(
            color = accent,
            start = Offset(x - radius * 0.55f, y + radius * 0.45f),
            end = Offset(x + radius * 0.55f, y + radius * 0.45f),
            strokeWidth = radius * 0.18f
        )
    }
}

private fun DrawScope.drawRookguardTrainingSlime(
    x: Float,
    y: Float,
    radius: Float,
    isDead: Boolean
) {
    val alpha = if (isDead) 0.42f else 1f
    val body = if (isDead) PLAYER_DEAD else Color(0xFF1F7A5B)
    val highlight = if (isDead) Color(0xFFA6ADB7) else Color(0xFF55C89B)
    val mark = if (isDead) Color(0xFFD2D6DC) else Color(0xFFF1D36A)

    drawOval(
        color = Color.Black.copy(alpha = 0.28f),
        topLeft = Offset(x - radius * 0.78f, y + radius * 0.46f),
        size = Size(radius * 1.56f, radius * 0.32f)
    )
    drawOval(
        color = body.copy(alpha = alpha),
        topLeft = Offset(x - radius, y - radius * 0.7f),
        size = Size(radius * 2f, radius * 1.45f)
    )
    drawOval(
        color = highlight.copy(alpha = alpha),
        topLeft = Offset(x - radius * 0.58f, y - radius * 0.55f),
        size = Size(radius * 0.82f, radius * 0.36f)
    )
    drawRect(
        color = mark.copy(alpha = alpha),
        topLeft = Offset(x - radius * 0.1f, y - radius * 0.1f),
        size = Size(radius * 0.28f, radius * 0.28f)
    )
    drawRect(
        color = Color(0xFF07130F).copy(alpha = alpha),
        topLeft = Offset(x - radius * 0.45f, y - radius * 0.02f),
        size = Size(radius * 0.18f, radius * 0.18f)
    )
    drawRect(
        color = Color(0xFF07130F).copy(alpha = alpha),
        topLeft = Offset(x + radius * 0.32f, y - radius * 0.02f),
        size = Size(radius * 0.18f, radius * 0.18f)
    )
}
