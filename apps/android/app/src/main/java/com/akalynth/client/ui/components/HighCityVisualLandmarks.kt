package com.akalynth.client.ui.components

import com.akalynth.client.protocol.MapName

enum class HighCityVisualKind {
    COBBLE_FLOOR,
    STONE_FLOOR,
    WOOD_FLOOR,
    STONE_WALL,
    STONE_COLUMN,
    CLOSED_DOOR,
    FOUNTAIN,
    NOTICE_BOARD,
    BANNER_BLUE,
    BANNER_RED,
    BENCH
}

data class HighCityVisualLandmark(
    val kind: HighCityVisualKind,
    val x: Int,
    val y: Int
) {
    val isFloor: Boolean
        get() = when (kind) {
            HighCityVisualKind.COBBLE_FLOOR,
            HighCityVisualKind.STONE_FLOOR,
            HighCityVisualKind.WOOD_FLOOR -> true
            else -> false
        }
}

private fun obj(kind: HighCityVisualKind, x: Int, y: Int): HighCityVisualLandmark =
    HighCityVisualLandmark(kind, x, y)

private fun row(kind: HighCityVisualKind, x1: Int, x2: Int, y: Int): List<HighCityVisualLandmark> =
    (x1..x2).map { x -> obj(kind, x, y) }

private fun col(kind: HighCityVisualKind, x: Int, y1: Int, y2: Int): List<HighCityVisualLandmark> =
    (y1..y2).map { y -> obj(kind, x, y) }

private fun floorPatch(
    kind: HighCityVisualKind,
    x1: Int,
    y1: Int,
    x2: Int,
    y2: Int
): List<HighCityVisualLandmark> =
    (y1..y2).flatMap { y -> (x1..x2).map { x -> obj(kind, x, y) } }

private val HIGH_CITY_VISUAL_LANDMARKS: List<HighCityVisualLandmark> = buildList {
    // Arrival spine: display-only civic paving from Guild Hall toward Central Plaza.
    addAll(floorPatch(HighCityVisualKind.COBBLE_FLOOR, 29, 18, 35, 48))
    addAll(floorPatch(HighCityVisualKind.COBBLE_FLOOR, 24, 30, 39, 35))
    addAll(floorPatch(HighCityVisualKind.STONE_FLOOR, 27, 29, 37, 35))
    add(obj(HighCityVisualKind.FOUNTAIN, 32, 33))
    add(obj(HighCityVisualKind.NOTICE_BOARD, 28, 32))
    add(obj(HighCityVisualKind.BANNER_BLUE, 26, 32))
    add(obj(HighCityVisualKind.BANNER_RED, 38, 32))
    add(obj(HighCityVisualKind.BENCH, 29, 36))
    add(obj(HighCityVisualKind.BENCH, 36, 36))

    // Guild Hall facade: visible civic landmark, not an enterable interior.
    addAll(floorPatch(HighCityVisualKind.STONE_FLOOR, 14, 8, 25, 19))
    addAll(row(HighCityVisualKind.STONE_WALL, 15, 24, 8))
    addAll(col(HighCityVisualKind.STONE_COLUMN, 14, 9, 18))
    addAll(col(HighCityVisualKind.STONE_COLUMN, 25, 9, 18))
    add(obj(HighCityVisualKind.STONE_WALL, 14, 8))
    add(obj(HighCityVisualKind.STONE_WALL, 25, 8))
    add(obj(HighCityVisualKind.CLOSED_DOOR, 20, 18))
    add(obj(HighCityVisualKind.BANNER_BLUE, 17, 11))
    add(obj(HighCityVisualKind.BANNER_RED, 23, 11))
    add(obj(HighCityVisualKind.NOTICE_BOARD, 24, 18))

    // House plot lane: claim markers only. No houses, interiors, prices, or ownership.
    addAll(floorPatch(HighCityVisualKind.COBBLE_FLOOR, 8, 30, 22, 35))
    addAll(floorPatch(HighCityVisualKind.WOOD_FLOOR, 10, 32, 11, 33))
    addAll(floorPatch(HighCityVisualKind.WOOD_FLOOR, 14, 32, 15, 33))
    addAll(floorPatch(HighCityVisualKind.WOOD_FLOOR, 18, 32, 19, 33))
    add(obj(HighCityVisualKind.NOTICE_BOARD, 10, 34))
    add(obj(HighCityVisualKind.NOTICE_BOARD, 14, 34))
    add(obj(HighCityVisualKind.NOTICE_BOARD, 18, 34))
    add(obj(HighCityVisualKind.BANNER_BLUE, 8, 32))
    add(obj(HighCityVisualKind.BANNER_RED, 21, 32))

    // Central Plaza: monument and social furniture over existing stone plaza tiles.
    addAll(floorPatch(HighCityVisualKind.COBBLE_FLOOR, 24, 46, 39, 57))
    addAll(floorPatch(HighCityVisualKind.STONE_FLOOR, 26, 48, 37, 55))
    add(obj(HighCityVisualKind.FOUNTAIN, 32, 53))
    add(obj(HighCityVisualKind.STONE_COLUMN, 28, 50))
    add(obj(HighCityVisualKind.STONE_COLUMN, 36, 50))
    add(obj(HighCityVisualKind.BANNER_BLUE, 27, 52))
    add(obj(HighCityVisualKind.BANNER_RED, 37, 52))
    add(obj(HighCityVisualKind.BENCH, 27, 56))
    add(obj(HighCityVisualKind.BENCH, 36, 56))
    add(obj(HighCityVisualKind.NOTICE_BOARD, 32, 49))
}

fun highCityVisualLandmarksFor(map: MapName): List<HighCityVisualLandmark> =
    if (map.isHighCityCompatible) HIGH_CITY_VISUAL_LANDMARKS else emptyList()
