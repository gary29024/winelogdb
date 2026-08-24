#!/usr/bin/env python3
"""Render the WineLog app icon to PNG (and an SVG source of the same geometry).

The mark is one shape family - a filled wine glass on a deep navy field - described once here as
signed distance fields so every size is rasterised natively instead of being resampled from a
master. Run with `python3 scripts/generate_app_icons.py` after changing any constant below.
"""
from __future__ import annotations

import math
import struct
import zlib
from pathlib import Path

OUT = Path(__file__).resolve().parent.parent / "public" / "icons"

NAVY_TOP = (0x22, 0x2F, 0x4E)
NAVY_BOTTOM = (0x0B, 0x11, 0x1F)
GLOW = (0xC5, 0x1F, 0x45)
CREAM = (0xF6, 0xF1, 0xE7)
WINE = (0xC5, 0x1F, 0x45)
WINE_LIGHT = (0xE0, 0x3B, 0x60)

# Glass geometry in an arbitrary unit space; the renderer fits it into each icon automatically.
BOWL_C = (0.0, 0.0)
BOWL_R = 1.0
RIM_Y = -0.52          # the bowl is cut well above its centre, giving the belly of a wine glass
STROKE = 0.082         # half the outline width
WINE_GAP = 0.0
WINE_TOP = 0.34        # fill level, below the rim
STEM_TOP = 0.45
STEM_BOTTOM = 1.92
STEM_R = 0.092
FOOT_Y = 2.00
FOOT_HW = 0.66
FOOT_HH = 0.10
HIGHLIGHT = ((-0.44, 0.02), (-0.30, 0.46), 0.055)

RIM_HW = math.sqrt(BOWL_R ** 2 - RIM_Y ** 2)
WINE_R = BOWL_R - STROKE - WINE_GAP
WINE_CUT = RIM_Y + WINE_TOP
WINE_HW = math.sqrt(WINE_R ** 2 - WINE_CUT ** 2)
BOUNDS = (-(BOWL_R + STROKE), RIM_Y - STROKE, BOWL_R + STROKE, FOOT_Y + FOOT_HH)


def sd_circle(x, y, cx, cy, r):
    return math.hypot(x - cx, y - cy) - r


def sd_segment(x, y, ax, ay, bx, by, r):
    vx, vy = bx - ax, by - ay
    wx, wy = x - ax, y - ay
    t = max(0.0, min(1.0, (wx * vx + wy * vy) / (vx * vx + vy * vy)))
    return math.hypot(wx - t * vx, wy - t * vy) - r


def sd_round_box(x, y, cx, cy, hw, hh, r):
    qx, qy = abs(x - cx) - hw + r, abs(y - cy) - hh + r
    return math.hypot(max(qx, 0.0), max(qy, 0.0)) + min(max(qx, qy), 0.0) - r


def cup(x, y, radius):
    """Bowl outline: a disc intersected with the half plane below the rim."""
    return max(sd_circle(x, y, *BOWL_C, radius), RIM_Y - y)


def wine(x, y):
    return max(sd_circle(x, y, *BOWL_C, WINE_R), WINE_CUT - y)


def glass_layers(x, y):
    """(distance, colour, alpha) for every part of the mark, painted back to front."""
    # Stem first, so the wine and then the bowl outline hide the joint where they overlap.
    yield sd_segment(x, y, 0.0, STEM_TOP, 0.0, STEM_BOTTOM, STEM_R), CREAM, 1.0
    yield sd_round_box(x, y, 0.0, FOOT_Y, FOOT_HW, FOOT_HH, FOOT_HH), CREAM, 1.0
    yield wine(x, y), WINE, 1.0
    yield sd_segment(x, y, *HIGHLIGHT[0], *HIGHLIGHT[1], HIGHLIGHT[2]), WINE_LIGHT, 0.85
    yield abs(cup(x, y, BOWL_R)) - STROKE, CREAM, 1.0


def blend(dst, src, alpha):
    return tuple(round(d + (s - d) * alpha) for d, s in zip(dst, src))


def background(u, v):
    base = blend(NAVY_TOP, NAVY_BOTTOM, v)
    falloff = math.exp(-(((u - 0.5) ** 2 + (v - 0.42) ** 2) / (2 * 0.30 ** 2)))
    return blend(base, GLOW, 0.22 * falloff)


def render(size: int, coverage: float) -> bytes:
    """Rasterise the icon at `size` px with the mark spanning `coverage` of the canvas."""
    left, top, right, bottom = BOUNDS
    scale = size * coverage / max(right - left, bottom - top)
    ox = size / 2 - (left + right) / 2 * scale
    oy = size / 2 - (top + bottom) / 2 * scale
    edge = 0.8 / scale  # antialiasing band, held at a constant pixel width
    rows = []
    for py in range(size):
        row = bytearray([0])
        v = (py + 0.5) / size
        y = ((py + 0.5) - oy) / scale
        inside_y = top - edge <= y <= bottom + edge
        for px in range(size):
            u = (px + 0.5) / size
            colour = background(u, v)
            if inside_y:
                x = ((px + 0.5) - ox) / scale
                if left - edge <= x <= right + edge:
                    for distance, tint, alpha in glass_layers(x, y):
                        cover = min(1.0, max(0.0, 0.5 - distance / edge))
                        if cover:
                            colour = blend(colour, tint, cover * alpha)
            row += bytes(colour)
            row.append(255)
        rows.append(bytes(row))
    return png(size, size, b"".join(rows))


def png(width: int, height: int, raw: bytes) -> bytes:
    def chunk(tag: bytes, payload: bytes) -> bytes:
        return (struct.pack(">I", len(payload)) + tag + payload
                + struct.pack(">I", zlib.crc32(tag + payload) & 0xFFFFFFFF))

    header = struct.pack(">IIBBBBB", width, height, 8, 6, 0, 0, 0)
    return (b"\x89PNG\r\n\x1a\n" + chunk(b"IHDR", header)
            + chunk(b"IDAT", zlib.compress(raw, 9)) + chunk(b"IEND", b""))


def svg(size: int, coverage: float) -> str:
    """The same geometry as scalable vector art, for the browser tab icon."""
    left, top, right, bottom = BOUNDS
    scale = size * coverage / max(right - left, bottom - top)
    ox = size / 2 - (left + right) / 2 * scale
    oy = size / 2 - (top + bottom) / 2 * scale

    def fx(value): return round(ox + value * scale, 2)
    def fy(value): return round(oy + value * scale, 2)
    def fs(value): return round(value * scale, 2)

    def hexed(rgb): return "#%02x%02x%02x" % rgb

    rim_l, rim_r = fx(-RIM_HW), fx(RIM_HW)
    wine_l, wine_r = fx(-WINE_HW), fx(WINE_HW)
    return f"""<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {size} {size}" role="img" aria-label="WineLog">
  <defs>
    <linearGradient id="field" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="{hexed(NAVY_TOP)}"/><stop offset="1" stop-color="{hexed(NAVY_BOTTOM)}"/>
    </linearGradient>
    <radialGradient id="glow" cx="0.5" cy="0.42" r="0.62">
      <stop offset="0" stop-color="{hexed(GLOW)}" stop-opacity="0.22"/><stop offset="1" stop-color="{hexed(GLOW)}" stop-opacity="0"/>
    </radialGradient>
  </defs>
  <rect width="{size}" height="{size}" fill="url(#field)"/>
  <rect width="{size}" height="{size}" fill="url(#glow)"/>
  <path d="M{fx(0)} {fy(STEM_TOP)} L{fx(0)} {fy(STEM_BOTTOM)}" stroke="{hexed(CREAM)}" stroke-width="{fs(STEM_R * 2)}" stroke-linecap="round"/>
  <rect x="{fx(-FOOT_HW)}" y="{fy(FOOT_Y - FOOT_HH)}" width="{fs(FOOT_HW * 2)}" height="{fs(FOOT_HH * 2)}" rx="{fs(FOOT_HH)}" fill="{hexed(CREAM)}"/>
  <path d="M{wine_l} {fy(WINE_CUT)} A{fs(WINE_R)} {fs(WINE_R)} 0 1 0 {wine_r} {fy(WINE_CUT)} Z" fill="{hexed(WINE)}"/>
  <path d="M{fx(HIGHLIGHT[0][0])} {fy(HIGHLIGHT[0][1])} L{fx(HIGHLIGHT[1][0])} {fy(HIGHLIGHT[1][1])}" stroke="{hexed(WINE_LIGHT)}" stroke-opacity="0.85" stroke-width="{fs(HIGHLIGHT[2] * 2)}" stroke-linecap="round"/>
  <path d="M{rim_l} {fy(RIM_Y)} A{fs(BOWL_R)} {fs(BOWL_R)} 0 1 0 {rim_r} {fy(RIM_Y)} Z" fill="none" stroke="{hexed(CREAM)}" stroke-width="{fs(STROKE * 2)}" stroke-linejoin="round"/>
</svg>
"""


TARGETS = [
    ("apple-touch-icon-v4.png", 180, 0.70),
    ("icon-192.png", 192, 0.70),
    ("icon-512.png", 512, 0.70),
    ("icon-maskable-512.png", 512, 0.54),  # inside the 80% safe zone Android may crop to
    ("favicon-32.png", 32, 0.74),
]

if __name__ == "__main__":
    OUT.mkdir(parents=True, exist_ok=True)
    for name, size, coverage in TARGETS:
        (OUT / name).write_bytes(render(size, coverage))
        print(f"{name} {size}x{size}")
    (OUT / "app-icon.svg").write_text(svg(512, 0.70))
    print("app-icon.svg")
