#!/usr/bin/env python3
"""Build Akalynth Classic UI chrome textures (art-first v2).

Deterministic hand-pixelled procedural art — nine-slice-ready frames, circular
action rings, and bar fills. Higher contrast + corner craft so stretched docks
read as metal/stone HUD, not muddy grey blobs.

Outputs:
  data/assets-src/sprites/ui/
  data/assets-built/ui/
  apps/android/app/src/main/assets/ui/
"""
from __future__ import annotations

import json
from pathlib import Path

from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parents[2]
OUT_SRC = ROOT / "data/assets-src/sprites/ui"
OUT_BUILT = ROOT / "data/assets-built/ui"
OUT_ANDROID = ROOT / "apps/android/app/src/main/assets/ui"

# Art-first palette — readable on dark playfields, brass hierarchy
VOID = (6, 7, 8)
PANEL_DEEP = (14, 16, 18)
STONE = (72, 74, 68)
STONE_MID = (98, 100, 92)
STONE_LIGHT = (132, 134, 124)
IRON = (28, 30, 32)
IRON_MID = (48, 52, 54)
IRON_BRIGHT = (148, 154, 146)
BRASS = (214, 176, 64)
BRASS_HOT = (242, 210, 110)
BRASS_DIM = (148, 112, 36)
RUNE = (120, 210, 220)
GOOD = (70, 230, 120)
DANGER = (236, 72, 64)
DANGER_HOT = (255, 140, 120)
TEXT = (236, 230, 214)
EDGE_DARK = (4, 4, 5)
EDGE_LIGHT = (168, 164, 150)


def _lerp(a: int, b: int, t: float) -> int:
    return int(a + (b - a) * t)


def _blend(c1: tuple[int, int, int], c2: tuple[int, int, int], t: float) -> tuple[int, int, int]:
    return (_lerp(c1[0], c2[0], t), _lerp(c1[1], c2[1], t), _lerp(c1[2], c2[2], t))


def _rgba(c: tuple[int, int, int], a: int = 255) -> tuple[int, int, int, int]:
    return (*c, a)


def _set(px, x: int, y: int, w: int, h: int, color: tuple[int, int, int, int]) -> None:
    if 0 <= x < w and 0 <= y < h:
        px[x, y] = color


def _fill_rect(
    px,
    x0: int,
    y0: int,
    x1: int,
    y1: int,
    w: int,
    h: int,
    color: tuple[int, int, int, int],
) -> None:
    for y in range(max(0, y0), min(h, y1 + 1)):
        for x in range(max(0, x0), min(w, x1 + 1)):
            px[x, y] = color


def _stone_fill(
    x: int,
    y: int,
    w: int,
    h: int,
    base: tuple[int, int, int],
    accent: tuple[int, int, int],
) -> tuple[int, int, int]:
    """Subtle vertical gradient + sparse grit — quiet center for nine-slice stretch."""
    t = y / max(h - 1, 1)
    color = _blend(accent, base, t * 0.85 + 0.08)
    # Keep center nearly flat so large docks don't look like noise wallpaper.
    if w > 4 and h > 4 and 1 < x < w - 2 and 1 < y < h - 2:
        if (x + y * 3) % 19 == 0:
            color = _blend(color, EDGE_DARK, 0.07)
        if (x * 2 + y) % 23 == 0:
            color = _blend(color, STONE_LIGHT, 0.05)
    return color


def _corner_rivet(px, cx: int, cy: int, w: int, h: int, hot: bool = False) -> None:
    """1–2px brass rivet at corner zones for craft read at stretch."""
    body = BRASS_HOT if hot else BRASS
    rim = BRASS_DIM
    for dy in (-1, 0, 1):
        for dx in (-1, 0, 1):
            if abs(dx) + abs(dy) > 2:
                continue
            color = body if dx == 0 and dy == 0 else rim
            alpha = 255 if dx == 0 and dy == 0 else 220
            _set(px, cx + dx, cy + dy, w, h, _rgba(color, alpha))
    _set(px, cx, cy - 1, w, h, _rgba(EDGE_LIGHT, 180))


def _draw_frame(
    size: int,
    slice_px: int,
    *,
    fill_base: tuple[int, int, int],
    fill_top: tuple[int, int, int],
    outer: tuple[int, int, int] = EDGE_DARK,
    highlight: tuple[int, int, int] = EDGE_LIGHT,
    inner: tuple[int, int, int] = IRON,
    brass_corners: bool = True,
    pressed: bool = False,
) -> Image.Image:
    """Beveled stone/iron frame with uniform edge bands (nine-slice safe)."""
    img = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    px = img.load()
    s = slice_px
    # Outer border ring
    for y in range(size):
        for x in range(size):
            on_border = x < s or y < s or x >= size - s or y >= size - s
            if not on_border:
                # Center fill — slightly translucent dark so HUD content sits clean
                cx = x - s
                cy = y - s
                cw = size - 2 * s
                ch = size - 2 * s
                fill = _stone_fill(cx, cy, cw, ch, fill_base, fill_top)
                if pressed:
                    fill = _blend(fill, BRASS_DIM, 0.12)
                # Hollow-ish center: darker + slight alpha so content contrast wins
                alpha = 245 if pressed else 238
                px[x, y] = _rgba(fill, alpha)
                continue

            # Distance into the border band from nearest outer edge
            d_out = min(x, y, size - 1 - x, size - 1 - y)
            d_in = min(x - 0, y - 0, size - 1 - x, size - 1 - y)  # same for outer
            # Prefer distance from outer edge for bevel ladder
            depth = d_out

            if depth == 0:
                # Outer silhouette — top/left light, bottom/right dark (classic bevel)
                if x == 0 or y == 0:
                    color = highlight if not pressed else BRASS
                else:
                    color = outer
            elif depth == 1:
                if x <= 1 or y <= 1:
                    color = _blend(highlight, STONE_LIGHT, 0.35 if not pressed else 0.15)
                else:
                    color = _blend(outer, inner, 0.45)
            elif depth == 2:
                color = _blend(inner, STONE_MID, 0.35)
            elif depth == 3 and s >= 6:
                color = _blend(inner, fill_base, 0.25)
            else:
                # Mid border body
                edge_t = depth / max(s - 1, 1)
                color = _blend(IRON_MID, inner, edge_t)
                # Inner lip (facing content) — dark recess
                if depth >= s - 1:
                    color = EDGE_DARK if not pressed else _blend(EDGE_DARK, BRASS_DIM, 0.4)
                elif depth >= s - 2:
                    color = _blend(inner, EDGE_DARK, 0.55)

            if pressed and depth <= 2:
                color = _blend(color, BRASS, 0.22)

            px[x, y] = _rgba(color, 255)

    # Brass corner caps — ornament only in corner squares (survives nine-slice)
    if brass_corners and s >= 4:
        # Rivets inset from outer corner
        inset = max(2, s // 3)
        corners = [
            (inset, inset),
            (size - 1 - inset, inset),
            (inset, size - 1 - inset),
            (size - 1 - inset, size - 1 - inset),
        ]
        for cx, cy in corners:
            _corner_rivet(px, cx, cy, size, size, hot=pressed)

        # Thin brass L-trim on outer corner pixels (not on edge midpoints)
        for i in range(1, min(s - 1, 5)):
            # TL
            _set(px, i, 1, size, size, _rgba(BRASS if pressed else BRASS_DIM, 210))
            _set(px, 1, i, size, size, _rgba(BRASS if pressed else BRASS_DIM, 210))
            # TR
            _set(px, size - 1 - i, 1, size, size, _rgba(BRASS if pressed else BRASS_DIM, 200))
            _set(px, size - 2, i, size, size, _rgba(BRASS if pressed else BRASS_DIM, 200))
            # BL
            _set(px, i, size - 2, size, size, _rgba(BRASS_DIM, 180))
            _set(px, 1, size - 1 - i, size, size, _rgba(BRASS_DIM, 180))
            # BR
            _set(px, size - 1 - i, size - 2, size, size, _rgba(BRASS_DIM, 160))
            _set(px, size - 2, size - 1 - i, size, size, _rgba(BRASS_DIM, 160))

    return img


def _draw_circle_button(
    size: int,
    *,
    fill: tuple[int, int, int],
    rim: tuple[int, int, int],
    highlight: tuple[int, int, int],
    pressed: bool = False,
    danger: bool = False,
) -> Image.Image:
    img = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    draw = ImageDraw.Draw(img)
    cx = cy = size / 2
    r = size / 2 - 1.2

    # Soft outer shadow ring
    draw.ellipse(
        [cx - r - 0.5, cy - r - 0.5, cx + r + 0.5, cy + r + 0.5],
        outline=_rgba(EDGE_DARK, 160),
        width=1,
    )

    # Body
    body = fill
    if pressed:
        body = _blend(fill, EDGE_DARK, 0.18)
    draw.ellipse([cx - r, cy - r, cx + r, cy + r], fill=_rgba(body, 255))

    # Metal rim (2px)
    rim_col = DANGER if danger and not pressed else rim
    draw.ellipse([cx - r, cy - r, cx + r, cy + r], outline=_rgba(rim_col, 255), width=2)

    # Inner ring
    inner_r = r - 3.5
    if inner_r > 4:
        inner_col = _blend(rim_col, STONE_LIGHT, 0.25) if not pressed else BRASS
        draw.ellipse(
            [cx - inner_r, cy - inner_r, cx + inner_r, cy + inner_r],
            outline=_rgba(inner_col, 200),
            width=1,
        )

    # Upper-left gleam
    if not pressed:
        gleam_r = r * 0.55
        draw.arc(
            [cx - gleam_r - 1, cy - gleam_r - 2, cx + gleam_r - 4, cy + gleam_r - 6],
            start=200,
            end=340,
            fill=_rgba(highlight, 210),
            width=2,
        )
    else:
        # Inset press shade bottom-right
        draw.arc(
            [cx - r + 2, cy - r + 2, cx + r - 2, cy + r - 2],
            start=20,
            end=160,
            fill=_rgba(EDGE_DARK, 140),
            width=2,
        )
        # Brass hot rim flash
        draw.ellipse(
            [cx - r + 1, cy - r + 1, cx + r - 1, cy + r - 1],
            outline=_rgba(BRASS_HOT, 180),
            width=1,
        )

    return img


def _draw_bar(
    size_w: int,
    size_h: int,
    *,
    fill: tuple[int, int, int],
    gloss: tuple[int, int, int],
    deep: tuple[int, int, int],
) -> Image.Image:
    img = Image.new("RGBA", (size_w, size_h), (0, 0, 0, 0))
    px = img.load()
    for y in range(size_h):
        for x in range(size_w):
            if y == 0:
                px[x, y] = _rgba(gloss, 255)
            elif y == size_h - 1:
                px[x, y] = _rgba(deep, 255)
            elif x == 0 or x == size_w - 1:
                px[x, y] = _rgba(_blend(fill, EDGE_DARK, 0.35), 255)
            elif y == 1:
                px[x, y] = _rgba(_blend(gloss, fill, 0.35), 255)
            else:
                t = y / max(size_h - 1, 1)
                px[x, y] = _rgba(_blend(fill, deep, t * 0.45), 255)
    return img


def _draw_bar_track(size_w: int, size_h: int) -> Image.Image:
    img = Image.new("RGBA", (size_w, size_h), (0, 0, 0, 0))
    px = img.load()
    for y in range(size_h):
        for x in range(size_w):
            if y == 0:
                px[x, y] = _rgba(EDGE_LIGHT, 160)
            elif y == size_h - 1:
                px[x, y] = _rgba(EDGE_DARK, 255)
            elif x == 0 or x == size_w - 1:
                px[x, y] = _rgba(IRON, 255)
            else:
                # Recessed trough
                t = y / max(size_h - 1, 1)
                px[x, y] = _rgba(_blend(VOID, PANEL_DEEP, t), 255)
    # Inner top shadow line
    for x in range(1, size_w - 1):
        px[x, 1] = _rgba(EDGE_DARK, 200)
    return img


ASSETS: list[dict] = [
    {
        "file": "ui_panel_frame.png",
        "slice": 8,
        "kind": "nine_slice",
        "generator": lambda: _draw_frame(
            48, 8, fill_base=PANEL_DEEP, fill_top=STONE, inner=IRON, highlight=STONE_LIGHT
        ),
    },
    {
        "file": "ui_button_frame.png",
        "slice": 6,
        "kind": "nine_slice",
        "generator": lambda: _draw_frame(
            32, 6, fill_base=STONE, fill_top=STONE_LIGHT, inner=IRON_BRIGHT, highlight=EDGE_LIGHT
        ),
    },
    {
        "file": "ui_button_pressed_frame.png",
        "slice": 6,
        "kind": "nine_slice",
        "generator": lambda: _draw_frame(
            32,
            6,
            fill_base=_blend(STONE, BRASS_DIM, 0.28),
            fill_top=_blend(STONE_LIGHT, BRASS, 0.4),
            inner=_blend(IRON, BRASS, 0.3),
            highlight=BRASS_HOT,
            pressed=True,
        ),
    },
    {
        "file": "ui_dock_frame.png",
        "slice": 8,
        "kind": "nine_slice",
        "generator": lambda: _draw_frame(
            40,
            8,
            fill_base=VOID,
            fill_top=PANEL_DEEP,
            inner=IRON_MID,
            highlight=IRON_BRIGHT,
        ),
    },
    {
        "file": "ui_dpad_frame.png",
        "slice": 10,
        "kind": "nine_slice",
        "generator": lambda: _draw_frame(
            64, 10, fill_base=PANEL_DEEP, fill_top=STONE, inner=IRON, highlight=STONE_LIGHT
        ),
    },
    {
        "file": "ui_action_ring.png",
        "slice": 0,
        "kind": "circle",
        "generator": lambda: _draw_circle_button(
            32, fill=STONE, rim=IRON_BRIGHT, highlight=STONE_LIGHT
        ),
    },
    {
        "file": "ui_action_ring_pressed.png",
        "slice": 0,
        "kind": "circle",
        "generator": lambda: _draw_circle_button(
            32, fill=_blend(STONE, BRASS, 0.35), rim=BRASS, highlight=TEXT, pressed=True
        ),
    },
    {
        "file": "ui_action_ring_danger.png",
        "slice": 0,
        "kind": "circle",
        "generator": lambda: _draw_circle_button(
            32,
            fill=_blend(DANGER, STONE, 0.35),
            rim=BRASS,
            highlight=TEXT,
            danger=True,
        ),
    },
    {
        "file": "ui_dpad_button.png",
        "slice": 0,
        "kind": "circle",
        "generator": lambda: _draw_circle_button(
            32, fill=IRON_MID, rim=IRON_BRIGHT, highlight=STONE_LIGHT
        ),
    },
    {
        "file": "ui_dpad_button_pressed.png",
        "slice": 0,
        "kind": "circle",
        "generator": lambda: _draw_circle_button(
            32, fill=_blend(IRON, BRASS, 0.4), rim=BRASS_HOT, highlight=TEXT, pressed=True
        ),
    },
    {
        "file": "ui_hp_fill.png",
        "slice": 2,
        "kind": "bar",
        "generator": lambda: _draw_bar(
            16, 4, fill=(220, 52, 48), gloss=DANGER_HOT, deep=(120, 18, 20)
        ),
    },
    {
        "file": "ui_mp_fill.png",
        "slice": 2,
        "kind": "bar",
        "generator": lambda: _draw_bar(
            16, 4, fill=(40, 130, 220), gloss=(130, 210, 255), deep=(12, 48, 110)
        ),
    },
    {
        "file": "ui_bar_track.png",
        "slice": 2,
        "kind": "bar",
        "generator": lambda: _draw_bar_track(16, 6),
    },
]


def main() -> None:
    OUT_SRC.mkdir(parents=True, exist_ok=True)
    OUT_BUILT.mkdir(parents=True, exist_ok=True)
    OUT_ANDROID.mkdir(parents=True, exist_ok=True)
    manifest: list[dict] = []

    for spec in ASSETS:
        img = spec["generator"]()
        src_path = OUT_SRC / spec["file"]
        built_path = OUT_BUILT / spec["file"]
        android_path = OUT_ANDROID / spec["file"]
        img.save(src_path, optimize=True)
        img.save(built_path, optimize=True)
        img.save(android_path, optimize=True)
        manifest.append(
            {
                "asset_id": f"akalynth_ui_{spec['file'].replace('.png', '')}",
                "file": spec["file"],
                "dimensions_px": list(img.size),
                "slice_px": spec["slice"],
                "kind": spec["kind"],
                "style_contract": "nostalgic_top_down_mmo_readability_original_akalynth_assets_v1",
                "pack_revision": "ui_gameplay_v2_art_first",
                "mechanics": None,
                "copyright_boundary": "original procedural pixel art; display-only UI chrome",
            }
        )
        print(f"[ui-textures] {spec['file']} {img.size[0]}x{img.size[1]} slice={spec['slice']}")

    pack_path = OUT_SRC / "ui_gameplay_v1.json"
    pack_path.write_text(
        json.dumps(
            {
                "pack": "ui_gameplay_v1",
                "revision": "v2_art_first",
                "assets": manifest,
            },
            indent=2,
        )
        + "\n"
    )
    print(f"[ui-textures] manifest -> {pack_path}")
    print(f"[ui-textures] built assets -> {OUT_BUILT}")
    print(f"[ui-textures] android assets -> {OUT_ANDROID}")


if __name__ == "__main__":
    main()
