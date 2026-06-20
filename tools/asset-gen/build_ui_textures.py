#!/usr/bin/env python3
"""Build deterministic Akalynth Classic 32 gameplay UI textures.

Produces nine-slice-ready panel/button/dock frames and circular action textures.
Output is hand-pixelled procedural art (no model generation) for Android assets/.
"""
from __future__ import annotations

import json
from pathlib import Path

from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parents[2]
OUT_SRC = ROOT / "data/assets-src/sprites/ui"
OUT_ANDROID = ROOT / "apps/android/app/src/main/assets/ui"

# ClassicShell palette (ARGB -> RGB)
VOID = (9, 10, 10)
PANEL_DEEP = (18, 20, 20)
STONE = (58, 61, 57)
STONE_LIGHT = (86, 90, 82)
IRON = (23, 25, 24)
IRON_BRIGHT = (123, 129, 120)
BRASS = (214, 178, 76)
RUNE = (143, 211, 214)
GOOD = (66, 230, 107)
DANGER = (255, 93, 77)
TEXT = (232, 227, 213)
EDGE_DARK = (7, 7, 7)
EDGE_LIGHT = (106, 104, 96)


def _lerp(a: int, b: int, t: float) -> int:
    return int(a + (b - a) * t)


def _blend(c1: tuple[int, int, int], c2: tuple[int, int, int], t: float) -> tuple[int, int, int]:
    return (_lerp(c1[0], c2[0], t), _lerp(c1[1], c2[1], t), _lerp(c1[2], c2[2], t))


def _stone_fill(x: int, y: int, w: int, h: int, base: tuple[int, int, int], accent: tuple[int, int, int]) -> tuple[int, int, int]:
    t = y / max(h - 1, 1)
    color = _blend(accent, base, t)
    # Keep large nine-slice centers subtle so stretched gameplay panels stay readable.
    if (x + y) % 13 == 0:
        color = _blend(color, EDGE_DARK, 0.08)
    if (x * 2 + y * 3) % 17 == 0:
        color = _blend(color, STONE_LIGHT, 0.06)
    return color


def _draw_frame(
    size: int,
    slice_px: int,
    *,
    fill_base: tuple[int, int, int],
    fill_top: tuple[int, int, int],
    outer: tuple[int, int, int] = EDGE_DARK,
    highlight: tuple[int, int, int] = EDGE_LIGHT,
    inner: tuple[int, int, int] = IRON,
) -> Image.Image:
    img = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    px = img.load()
    for y in range(size):
        for x in range(size):
            if x < slice_px or y < slice_px or x >= size - slice_px or y >= size - slice_px:
                if x == 0 or y == 0:
                    px[x, y] = (*highlight, 255)
                elif x == size - 1 or y == size - 1:
                    px[x, y] = (*outer, 255)
                elif x == 1 or y == 1:
                    px[x, y] = (*_blend(highlight, fill_top, 0.35), 255)
                elif x == size - 2 or y == size - 2:
                    px[x, y] = (*_blend(outer, inner, 0.55), 255)
                else:
                    px[x, y] = (*inner, 255)
            else:
                px[x, y] = (*_stone_fill(x - slice_px, y - slice_px, size - 2 * slice_px, size - 2 * slice_px, fill_base, fill_top), 255)
    return img


def _draw_circle_button(size: int, *, fill: tuple[int, int, int], rim: tuple[int, int, int], highlight: tuple[int, int, int]) -> Image.Image:
    img = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    draw = ImageDraw.Draw(img)
    margin = 1
    bbox = (margin, margin, size - margin - 1, size - margin - 1)
    draw.ellipse(bbox, fill=(*fill, 255), outline=(*rim, 255), width=1)
    # upper-left gleam
    gleam = (margin + 2, margin + 2, size // 2, size // 3)
    draw.arc(gleam, start=200, end=340, fill=(*highlight, 180), width=1)
    return img


def _draw_bar(size_w: int, size_h: int, *, track: tuple[int, int, int], fill: tuple[int, int, int], gloss: tuple[int, int, int]) -> Image.Image:
    img = Image.new("RGBA", (size_w, size_h), (0, 0, 0, 0))
    px = img.load()
    for y in range(size_h):
        for x in range(size_w):
            if y == 0:
                px[x, y] = (*EDGE_LIGHT, 255)
            elif y == size_h - 1:
                px[x, y] = (*EDGE_DARK, 255)
            elif x == 0 or x == size_w - 1:
                px[x, y] = (*IRON, 255)
            elif y == 1 and x > 1 and x < size_w - 2:
                px[x, y] = (*gloss, 255)
            else:
                color = fill if y < size_h - 2 else track
                px[x, y] = (*color, 255)
    return img


def _draw_bar_track(size_w: int, size_h: int) -> Image.Image:
    img = Image.new("RGBA", (size_w, size_h), (0, 0, 0, 0))
    px = img.load()
    for y in range(size_h):
        for x in range(size_w):
            if y == 0:
                px[x, y] = (*EDGE_LIGHT, 200)
            elif y == size_h - 1:
                px[x, y] = (*EDGE_DARK, 255)
            elif x == 0 or x == size_w - 1:
                px[x, y] = (*IRON, 255)
            else:
                px[x, y] = (*PANEL_DEEP, 255)
    return img


ASSETS: list[dict] = [
    {
        "file": "ui_panel_frame.png",
        "slice": 8,
        "kind": "nine_slice",
        "generator": lambda: _draw_frame(48, 8, fill_base=STONE, fill_top=STONE_LIGHT, inner=IRON),
    },
    {
        "file": "ui_button_frame.png",
        "slice": 6,
        "kind": "nine_slice",
        "generator": lambda: _draw_frame(32, 6, fill_base=STONE, fill_top=STONE_LIGHT, inner=IRON_BRIGHT),
    },
    {
        "file": "ui_button_pressed_frame.png",
        "slice": 6,
        "kind": "nine_slice",
        "generator": lambda: _draw_frame(
            32,
            6,
            fill_base=_blend(STONE, BRASS, 0.22),
            fill_top=_blend(STONE_LIGHT, BRASS, 0.35),
            inner=_blend(IRON, BRASS, 0.25),
            highlight=BRASS,
        ),
    },
    {
        "file": "ui_dock_frame.png",
        "slice": 8,
        "kind": "nine_slice",
        "generator": lambda: _draw_frame(40, 8, fill_base=PANEL_DEEP, fill_top=STONE, inner=IRON, highlight=IRON_BRIGHT),
    },
    {
        "file": "ui_dpad_frame.png",
        "slice": 10,
        "kind": "nine_slice",
        "generator": lambda: _draw_frame(64, 10, fill_base=STONE, fill_top=STONE_LIGHT, inner=IRON),
    },
    {
        "file": "ui_action_ring.png",
        "slice": 0,
        "kind": "circle",
        "generator": lambda: _draw_circle_button(32, fill=STONE, rim=IRON_BRIGHT, highlight=STONE_LIGHT),
    },
    {
        "file": "ui_action_ring_pressed.png",
        "slice": 0,
        "kind": "circle",
        "generator": lambda: _draw_circle_button(32, fill=_blend(STONE, BRASS, 0.35), rim=BRASS, highlight=TEXT),
    },
    {
        "file": "ui_action_ring_danger.png",
        "slice": 0,
        "kind": "circle",
        "generator": lambda: _draw_circle_button(32, fill=_blend(DANGER, STONE, 0.4), rim=BRASS, highlight=TEXT),
    },
    {
        "file": "ui_dpad_button.png",
        "slice": 0,
        "kind": "circle",
        "generator": lambda: _draw_circle_button(32, fill=IRON, rim=IRON_BRIGHT, highlight=STONE_LIGHT),
    },
    {
        "file": "ui_dpad_button_pressed.png",
        "slice": 0,
        "kind": "circle",
        "generator": lambda: _draw_circle_button(32, fill=_blend(IRON, BRASS, 0.45), rim=BRASS, highlight=TEXT),
    },
    {
        "file": "ui_hp_fill.png",
        "slice": 2,
        "kind": "bar",
        "generator": lambda: _draw_bar(16, 4, track=DANGER, fill=(220, 48, 40), gloss=(255, 140, 120)),
    },
    {
        "file": "ui_mp_fill.png",
        "slice": 2,
        "kind": "bar",
        "generator": lambda: _draw_bar(16, 4, track=RUNE, fill=(36, 120, 210), gloss=(120, 200, 255)),
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
    OUT_ANDROID.mkdir(parents=True, exist_ok=True)
    manifest: list[dict] = []

    for spec in ASSETS:
        img = spec["generator"]()
        src_path = OUT_SRC / spec["file"]
        android_path = OUT_ANDROID / spec["file"]
        img.save(src_path)
        img.save(android_path)
        manifest.append(
            {
                "asset_id": f"akalynth_ui_{spec['file'].replace('.png', '')}",
                "file": spec["file"],
                "dimensions_px": list(img.size),
                "slice_px": spec["slice"],
                "kind": spec["kind"],
                "style_contract": "nostalgic_top_down_mmo_readability_original_akalynth_assets_v1",
                "mechanics": None,
                "copyright_boundary": "original procedural pixel art; display-only UI chrome",
            }
        )
        print(f"[ui-textures] {spec['file']} {img.size[0]}x{img.size[1]} slice={spec['slice']}")

    pack_path = OUT_SRC / "ui_gameplay_v1.json"
    pack_path.write_text(json.dumps({"pack": "ui_gameplay_v1", "assets": manifest}, indent=2) + "\n")
    print(f"[ui-textures] manifest -> {pack_path}")
    print(f"[ui-textures] android assets -> {OUT_ANDROID}")


if __name__ == "__main__":
    main()