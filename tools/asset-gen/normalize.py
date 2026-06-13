#!/usr/bin/env python3
"""Akalynth Asset Factory — deterministic raw -> Classic-32 normalize.

Takes a raw generated image (data/assets-src/_raw/<id>_raw.png, ~1024px) and produces a
CANDIDATE cleaned tile/sprite at the Classic 32 base under data/assets-src/sprites/. This is
the "deterministic post-processing" step from FACTORY.md — it does NOT make the asset
game-ready; a human still reviews (and may hand-polish in Aseprite) before promote.

Steps: load -> (optional) flatten to an opaque tile fill -> high-quality downscale to the
target base -> (optional) palette quantize for the flat limited-palette look -> save PNG.

Pillow only (no network, no key). Usage:
  python3 tools/asset-gen/normalize.py --raw <raw.png> --out <sprites/<class>__<name>.png> \
      [--size 32x32] [--colors 32] [--opaque]
"""
import argparse
from PIL import Image


def parse_size(s: str):
    w, _, h = s.partition("x")
    return int(w), int(h)


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--raw", required=True, help="raw generated PNG (data/assets-src/_raw/...)")
    ap.add_argument("--out", required=True, help="cleaned output (data/assets-src/sprites/<class>__<name>.png)")
    ap.add_argument("--size", default="32x32", help="target base, e.g. 32x32 / 32x64 / 64x64")
    ap.add_argument("--colors", type=int, default=0, help="palette-quantize to N colors (0 = off; tiles ~24-48)")
    ap.add_argument("--opaque", action="store_true", help="flatten alpha onto black -> opaque (seamless terrain tiles)")
    args = ap.parse_args()

    w, h = parse_size(args.size)
    img = Image.open(args.raw).convert("RGBA")

    if args.opaque:
        base = Image.new("RGBA", img.size, (0, 0, 0, 255))
        img = Image.alpha_composite(base, img).convert("RGB")

    out = img.resize((w, h), Image.LANCZOS)

    if args.colors and args.colors > 0:
        mode = out.mode
        out = out.convert("RGB").quantize(colors=args.colors, method=Image.MEDIANCUT).convert(mode)

    out.save(args.out)
    print(f"[normalize] {args.raw} -> {args.out} ({w}x{h}, opaque={args.opaque}, colors={args.colors or 'none'})")
    print("[normalize] CANDIDATE only — human review (FACTORY.md) before promote.")


if __name__ == "__main__":
    main()
