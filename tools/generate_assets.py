#!/usr/bin/env python3
"""Generates the original pixel-art PNG assets for the Spider-Man add-on.

Pure standard library (zlib + struct) so no image dependency is needed.
Run from the repository root:  python3 tools/generate_assets.py
All art here is original work made for this project (no third-party files).
"""
import os
import struct
import zlib

ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..")

PALETTE = {
    ".": None,
    "K": (26, 26, 31, 255),     # outline / charcoal
    "R": (215, 38, 46, 255),    # spider red
    "r": (143, 20, 25, 255),    # dark red
    "B": (31, 95, 191, 255),    # deep blue
    "b": (15, 58, 128, 255),    # dark blue
    "W": (242, 242, 242, 255),  # web white
    "G": (154, 163, 173, 255),  # steel gray
    "g": (90, 98, 110, 255),    # dark steel
    "C": (0, 224, 255, 255),    # cyan tech accent
    "Y": (255, 214, 64, 255),   # yellow lens
    "Z": (60, 60, 66, 255),     # charcoal panel
}

# 16x16 pixel art. Each row must be exactly 16 characters.
WEB_SHOOTER = [
    "................",
    "................",
    "....KKKKKKK.....",
    "...KWWRRRRRK....",
    "..KWRRRRRRRRK...",
    "..KRRKKKKKRRK...",
    "..KRKBBBBBKRK...",
    "..KRKBWBBBKRK...",
    "..KRKBBBBBKRK...",
    "..KRRKKKKKRRK...",
    "...KKGGGGGKK....",
    "..KGGGgGgGGGK...",
    "..KGgGGGGGgGK...",
    "..KGGGgGgGGGK...",
    "...KKKKKKKKK....",
    "................",
]

GADGET_LAUNCHER = [
    "................",
    "................",
    ".....KKKKK......",
    "....KYYYYYK.....",
    "...KBBBBBBBK....",
    "...KBCCCCCBK....",
    "...KBBBBBBBK....",
    "...KRRRRRRRK....",
    "...KRrRRRrRK....",
    "...KRRRRRRRK....",
    "...KGGGGGGGK....",
    "...KgGGGGGgK....",
    "...KGGGGGGGK....",
    "...KgGgGgGgK....",
    "....KKKKKKK.....",
    "................",
]

SPIDER_HUB = [
    "................",
    "..KKKKKKKKKKK...",
    "..KZZZZZZZZZK...",
    "..KZRRZZZZZZK...",
    "..KZRRRZZZZZK...",
    "..KZZRRRRZZZK...",
    "..KZZZRRRZZZK...",
    "..KZZRRRRZZZK...",
    "..KZRRRZZZZZK...",
    "..KZRRZZZZZZK...",
    "..KZZZZZZZZZK...",
    "..KZWZZZZZWZK...",
    "..KZZZZZZZZZK...",
    "..KZZWWWWWZZK...",
    "..KKKKKKKKKKK...",
    "................",
]

# 4x4 soft dot used by the web_thread particle.
WEB_THREAD = [
    "WWWW",
    "WWWW",
    "WWWW",
    "WWWW",
]

SPIDER_EMBLEM = [  # 16x16 spider silhouette used for pack icons
    "................",
    "....K......K....",
    ".....K....K.....",
    "...KKKKKKKKKK...",
    "..KRRRRKKRRRRK..",
    ".KRRRRRKKRRRRRK.",
    ".KRRRRRKKRRRRRK.",
    "KKRRRRRRRRRRRRKK",
    "KBBBBBRRRRBBBBBK",
    "KBBBBBBBBBBBBBBK",
    ".KBBBBBBBBBBBBK.",
    "..KBBBBBBBBBBK..",
    "...KKKKKKKKKK...",
    "....K......K....",
    "................",
    "................",
]


def png_bytes(width, height, rgba_rows):
    """Encode RGBA rows (list of lists of 4-tuples) as a PNG byte string."""
    raw = bytearray()
    for row in rgba_rows:
        raw.append(0)  # filter type: none
        for px in row:
            raw.extend(px)

    def chunk(tag, data):
        crc = zlib.crc32(tag + data) & 0xFFFFFFFF
        return struct.pack(">I", len(data)) + tag + data + struct.pack(">I", crc)

    header = struct.pack(">IIBBBBB", width, height, 8, 6, 0, 0, 0)
    return (
        b"\x89PNG\r\n\x1a\n"
        + chunk(b"IHDR", header)
        + chunk(b"IDAT", zlib.compress(bytes(raw), 9))
        + chunk(b"IEND", b"")
    )


def from_art(art, scale=1):
    """Turn a list of palette strings into RGBA rows, optionally upscaled."""
    rows = []
    for line in art:
        out = []
        for ch in line:
            px = PALETTE[ch] or (0, 0, 0, 0)
            out.extend([px] * scale)
        for _ in range(scale):
            rows.append(out)
    return rows


def write_png(rel_path, art, scale=1):
    rows = from_art(art, scale)
    data = png_bytes(len(rows[0]), len(rows), rows)
    path = os.path.join(ROOT, rel_path)
    os.makedirs(os.path.dirname(path), exist_ok=True)
    with open(path, "wb") as fh:
        fh.write(data)
    print("wrote", rel_path)


def pack_icon(art):
    """128x128 pack icon: dark gradient-free backdrop with the emblem centred."""
    size = 128
    backdrop = (22, 22, 28, 255)
    scale = 6  # 16 * 6 = 96
    off = (size - 16 * scale) // 2
    emblem = from_art(art, scale)
    rows = []
    for y in range(size):
        row = []
        for x in range(size):
            px = backdrop
            ex, ey = x - off, y - off
            if 0 <= ex < 16 * scale and 0 <= ey < 16 * scale:
                cand = emblem[ey][ex]
                if cand[3] > 0:
                    px = cand
            row.append(px)
        rows.append(row)
    return png_bytes(size, size, rows)


def main():
    write_png("resource_pack/textures/items/web_shooter.png", WEB_SHOOTER)
    write_png("resource_pack/textures/items/gadget_launcher.png", GADGET_LAUNCHER)
    write_png("resource_pack/textures/items/spider_hub.png", SPIDER_HUB)
    write_png("resource_pack/textures/particle/web_thread.png", WEB_THREAD)
    for rel in ("resource_pack/pack_icon.png", "behavior_pack/pack_icon.png"):
        path = os.path.join(ROOT, rel)
        os.makedirs(os.path.dirname(path), exist_ok=True)
        with open(path, "wb") as fh:
            fh.write(pack_icon(SPIDER_EMBLEM))
        print("wrote", rel)


if __name__ == "__main__":
    main()
