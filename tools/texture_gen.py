#!/usr/bin/env python3
"""tools/texture_gen.py — procedural pixel-art generator for every texture in
Spider-Man: Definitive Experience (spec §15). All art is ORIGINAL, drawn here
from scratch: no ripped/commercial assets (spec §2.2, §15.6).

Run:  python3 tools/texture_gen.py        (requires Pillow)
Writes PNGs into resource_pack/textures/** and pack_icon.png into both packs.
Deterministic: same output every run (no randomness without fixed seeds).
"""

import os
from PIL import Image, ImageDraw

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
RP = os.path.join(ROOT, "resource_pack")
BP = os.path.join(ROOT, "behavior_pack")

# --------------------------------------------------------------------------
# palette (spec §15.1: spider red / deep blue / charcoal / white / cyan tech)
# --------------------------------------------------------------------------
SPIDER_RED = (200, 25, 35, 255)
DARK_RED = (130, 12, 22, 255)
DEEP_BLUE = (25, 50, 160, 255)
CHARCOAL = (28, 28, 34, 255)
NEAR_BLACK = (18, 18, 22, 255)
WHITE = (245, 245, 250, 255)
PALE_GRAY = (200, 202, 210, 255)
CYAN = (70, 220, 255, 255)
GOLD = (215, 170, 60, 255)
GUNMETAL = (110, 116, 128, 255)
STEEL = (150, 156, 168, 255)


def shade(c, f):
    """Multiply-shade an RGBA color (f<1 darker, f>1 lighter)."""
    return (
        max(0, min(255, int(c[0] * f))),
        max(0, min(255, int(c[1] * f))),
        max(0, min(255, int(c[2] * f))),
        c[3] if len(c) > 3 else 255,
    )


# --------------------------------------------------------------------------
# 64x64 humanoid skin-layout painter (player UV mapping)
# --------------------------------------------------------------------------
# Face regions per limb: (x, y, w, h) for right/left/top/bottom/front/back.
HEAD = {"right": (0, 8, 8, 8), "front": (8, 8, 8, 8), "left": (16, 8, 8, 8),
        "back": (24, 8, 8, 8), "top": (8, 0, 8, 8), "bottom": (16, 0, 8, 8)}
BODY = {"right": (16, 20, 4, 12), "front": (20, 20, 8, 12), "left": (28, 20, 4, 12),
        "back": (32, 20, 8, 12), "top": (20, 16, 8, 4), "bottom": (28, 16, 8, 4)}
RARM = {"right": (40, 20, 4, 12), "front": (44, 20, 4, 12), "left": (48, 20, 4, 12),
        "back": (52, 20, 4, 12), "top": (44, 16, 4, 4), "bottom": (48, 16, 4, 4)}
RLEG = {"right": (0, 20, 4, 12), "front": (4, 20, 4, 12), "left": (8, 20, 4, 12),
        "back": (12, 20, 4, 12), "top": (4, 16, 4, 4), "bottom": (8, 16, 4, 4)}
LARM = {"right": (32, 52, 4, 12), "front": (36, 52, 4, 12), "left": (40, 52, 4, 12),
        "back": (44, 52, 4, 12), "top": (36, 48, 4, 4), "bottom": (40, 48, 4, 4)}
LLEG = {"right": (16, 52, 4, 12), "front": (20, 52, 4, 12), "left": (24, 52, 4, 12),
        "back": (28, 52, 4, 12), "top": (20, 48, 4, 4), "bottom": (24, 48, 4, 4)}


class Skin:
    def __init__(self):
        self.img = Image.new("RGBA", (64, 64), (0, 0, 0, 0))
        self.d = ImageDraw.Draw(self.img)

    def fill(self, region, color):
        x, y, w, h = region
        self.d.rectangle([x, y, x + w - 1, y + h - 1], fill=color)

    def px(self, x, y, color):
        self.d.point((x, y), fill=color)

    def rect(self, x0, y0, x1, y1, color):
        self.d.rectangle([x0, y0, x1, y1], fill=color)

    def line(self, x0, y0, x1, y1, color):
        self.d.line([x0, y0, x1, y1], fill=color)

    def save(self, path):
        full = os.path.join(RP, path)
        os.makedirs(os.path.dirname(full), exist_ok=True)
        self.img.save(full)


def paint_limb(skin, limb, color, shade_sides=0.86):
    """Flat-paint a limb with subtle side shading (vanilla-plus readability)."""
    for face, region in limb.items():
        c = color if face in ("front", "back", "top") else shade(color, shade_sides)
        if face == "bottom":
            c = shade(color, 0.7)
        skin.fill(region, c)


def web_lines(skin, region, color, step=3):
    """Fine web grid over a region (thin lines; readable at pixel scale)."""
    x, y, w, h = region
    for i in range(step, w, step):
        skin.line(x + i, y, x + i, y + h - 1, color)
    for j in range(step, h, step):
        skin.line(x, y + j, x + w - 1, y + j, color)


def spider_emblem(skin, cx, cy, color, scale=1, legs=True):
    """Small centered spider motif (spec §15.2: centered & proportionate)."""
    # body: cephalothorax + abdomen
    skin.rect(cx - scale, cy - 2 * scale, cx + scale, cy - scale, color)
    skin.rect(cx - scale, cy - scale, cx + scale, cy + 2 * scale, color)
    if not legs:
        return
    for side in (-1, 1):
        for i, dy in enumerate((-2 * scale, -scale, 0, scale)):
            x1 = cx + side * (2 * scale + i % 2)
            x2 = cx + side * (3 * scale + 1)
            skin.line(x1, cy + dy, x2, cy + dy - side * 0 + (-1 if i < 2 else 1), color)
            skin.px(x2, cy + dy + (-1 if i < 2 else 1), color)


def suit_eyes(skin, front, style="classic", lens=WHITE, outline=NEAR_BLACK):
    """Eyes on the head-front 8x8 region. Styles differ per suit identity."""
    x, y, _, _ = front
    if style == "goggles":
        # improvised: round goggle lenses with strap
        skin.rect(x, y + 2, x + 7, y + 3, shade(CHARCOAL, 1.2))  # strap
        skin.rect(x + 1, y + 1, x + 3, y + 4, outline)
        skin.rect(x + 4, y + 1, x + 6, y + 4, outline)
        skin.rect(x + 1, y + 2, x + 3, y + 3, lens)
        skin.rect(x + 4, y + 2, x + 6, y + 3, lens)
        return
    if style == "visor":
        skin.rect(x, y + 2, x + 7, y + 4, outline)
        skin.rect(x + 1, y + 3, x + 6, y + 3, CYAN)
        return
    if style == "shades":
        skin.rect(x, y + 3, x + 7, y + 4, NEAR_BLACK)
        skin.px(x + 1, y + 3, shade(NEAR_BLACK, 1.8))
        return
    if style == "human":
        skin.px(x + 2, y + 3, NEAR_BLACK); skin.px(x + 5, y + 3, NEAR_BLACK)
        skin.line(x + 2, y + 6, x + 5, y + 6, shade(NEAR_BLACK, 0.8))
        return
    # masked suits: big angular lenses with outline
    for ox in (0, 4):
        skin.rect(x + ox + 1, y + 1, x + ox + 3, y + 5, outline)
    skin.rect(x + 1, y + 2, x + 3, y + 4, lens)   # left lens
    skin.rect(x + 5, y + 2, x + 6, y + 4, lens)   # right lens (slight asymmetry reads "expressive")
    if style == "narrow":
        skin.rect(x + 2, y + 2, x + 2, y + 4, lens)
        skin.rect(x + 5, y + 2, x + 5, y + 4, lens)


def paint_suit(path, primary, secondary, lines, emblem, eye_style, eye_lens,
               webbed=True, accent=None, emblem_scale=1):
    s = Skin()
    # head: primary with webbing, masked eyes
    for face, region in HEAD.items():
        paint_c = primary if face != "bottom" else shade(primary, 0.7)
        s.fill(region, paint_c)
        if webbed and face in ("front", "back", "left", "right", "top"):
            web_lines(s, region, lines, step=3 if region[2] >= 8 else 2)
    suit_eyes(s, HEAD["front"], style=eye_style, lens=eye_lens)
    # torso
    for face, region in BODY.items():
        if face in ("right", "left"):
            s.fill(region, secondary)
        else:
            s.fill(region, primary if face != "bottom" else shade(primary, 0.7))
            if webbed and face in ("front", "back", "top"):
                web_lines(s, region, lines, step=3)
    fx, fy, fw, fh = BODY["front"]
    spider_emblem(s, fx + fw // 2, fy + 4, emblem, scale=emblem_scale)
    bx, by, bw, bh = BODY["back"]
    spider_emblem(s, bx + bw // 2, by + 4, emblem, scale=emblem_scale)
    # arms: secondary sleeves + primary gloves (bottom third)
    for arm in (RARM, LARM):
        for face, region in arm.items():
            base = secondary if face not in ("top", "bottom") else shade(secondary, 0.8)
            s.fill(region, base)
            x, y, w, h = region
            if face != "top" and h >= 8:
                s.rect(x, y + h - 4, x + w - 1, y + h - 1, primary if face in ("front", "back") else shade(primary, 0.86))
                if webbed:
                    s.line(x, y + h - 5, x + w - 1, y + h - 5, lines)
    # legs: secondary + primary boots
    for leg in (RLEG, LLEG):
        for face, region in leg.items():
            base = secondary if face not in ("top", "bottom") else shade(secondary, 0.8)
            s.fill(region, base)
            x, y, w, h = region
            if face != "top" and h >= 8:
                s.rect(x, y + h - 4, x + w - 1, y + h - 1, primary if face in ("front", "back") else shade(primary, 0.86))
    if accent:
        accent(s)
    s.save(path)


def segmented_plating(s):
    """Iron suit: horizontal plate seams + gold trim (armored look)."""
    for limb in (BODY, RARM, LARM, RLEG, LLEG):
        for face, region in limb.items():
            x, y, w, h = region
            if h < 8:
                continue
            for j in range(3, h - 1, 4):
                s.line(x, y + j, x + w - 1, y + j, shade(GOLD, 0.9))
                s.line(x, y + j + 1, x + w - 1, y + j + 1, shade(CHARCOAL, 0.8))


def generate_suits():
    # Classic red/blue — balanced starter (spec table row 1)
    paint_suit("textures/entity/suits/suit_classic.png",
               primary=SPIDER_RED, secondary=DEEP_BLUE, lines=DARK_RED,
               emblem=NEAR_BLACK, eye_style="classic", eye_lens=WHITE)
    # Improvised homemade — gray with red accents + goggles
    paint_suit("textures/entity/suits/suit_improvised.png",
               primary=(140, 140, 146, 255), secondary=(95, 95, 102, 255),
               lines=(115, 115, 122, 255), emblem=(190, 40, 50, 255),
               eye_style="goggles", eye_lens=WHITE, webbed=False, emblem_scale=1)
    # Stealth black — high-contrast white spider (spec row 2)
    paint_suit("textures/entity/suits/suit_stealth.png",
               primary=(26, 26, 31, 255), secondary=(16, 16, 20, 255),
               lines=(48, 48, 56, 255), emblem=WHITE,
               eye_style="narrow", eye_lens=WHITE, webbed=True)
    # Advanced tech — white/red/black, clean panels (spec row 3)
    paint_suit("textures/entity/suits/suit_advanced.png",
               primary=(238, 238, 243, 255), secondary=(205, 208, 218, 255),
               lines=(180, 40, 50, 255), emblem=(190, 25, 35, 255),
               eye_style="classic", eye_lens=WHITE, emblem_scale=1)
    # Urban (Miles-inspired) — dark base, red accents, expressive lines
    def urban_accent(s):
        # red diagonal expressiveness on torso sides + red limb cuffs
        for region in (BODY["right"], BODY["left"]):
            x, y, w, h = region
            for i in range(h):
                s.px(x + (i % w), y + i, (190, 30, 45, 255))
    paint_suit("textures/entity/suits/suit_urban.png",
               primary=(22, 22, 27, 255), secondary=(12, 12, 16, 255),
               lines=(40, 40, 48, 255), emblem=(200, 30, 45, 255),
               eye_style="classic", eye_lens=WHITE, accent=urban_accent, emblem_scale=1)
    # Iron-armor inspired — segmented metallic plates, distinct emblem (spec row 5)
    paint_suit("textures/entity/suits/suit_iron.png",
               primary=GUNMETAL, secondary=shade(GUNMETAL, 0.75),
               lines=shade(CHARCOAL, 1.15), emblem=GOLD,
               eye_style="classic", eye_lens=CYAN, webbed=False,
               accent=segmented_plating, emblem_scale=1)


# --------------------------------------------------------------------------
# enemies (humanoid 64x64, role-appropriate palettes — spec §15.5)
# --------------------------------------------------------------------------
SKIN_TONE = (205, 160, 120, 255)
SKIN_TONE_DARK = (170, 125, 90, 255)


def human_head(s, hair=None, hair_color=NEAR_BLACK, face=SKIN_TONE, eye_style="human", mask=None):
    for f, region in HEAD.items():
        s.fill(region, face if f != "bottom" else shade(face, 0.8))
    if mask:
        for f, region in HEAD.items():
            if f != "front":
                s.fill(region, mask)
    if hair:
        s.fill(HEAD["top"], hair_color)
        x, y, w, h = HEAD["front"]
        s.rect(x, y, x + w - 1, y + 1, hair_color)
        for f in ("left", "right", "back"):
            rx, ry, rw, rh = HEAD[f]
            s.rect(rx, ry, rx + rw - 1, ry + 2, hair_color)
    suit_eyes(s, HEAD["front"], style=eye_style)


def generate_enemies():
    # --- Street Thug: green hoodie, hood up, jeans ---
    s = Skin()
    hoodie = (62, 84, 56, 255)
    human_head(s, face=SKIN_TONE, eye_style="human", mask=hoodie)
    # face opening
    fx, fy, fw, fh = HEAD["front"]
    s.rect(fx + 1, fy + 2, fx + 6, fy + 6, SKIN_TONE)
    suit_eyes(s, (fx + 1, fy + 2, 6, 5), style="human")
    for limb, colr in ((BODY, hoodie), (RARM, hoodie), (LARM, hoodie)):
        paint_limb(s, limb, colr)
    # hoodie pocket line + drawstrings
    bx, by, bw, bh = BODY["front"]
    s.line(bx + 1, by + 8, bx + bw - 2, by + 8, shade(hoodie, 0.75))
    s.px(bx + 3, by + 1, PALE_GRAY); s.px(bx + 4, by + 2, PALE_GRAY)
    jeans = (52, 62, 92, 255)
    for leg in (RLEG, LLEG):
        paint_limb(s, leg, jeans)
        x, y, w, h = leg["front"]
        s.rect(x, y + h - 2, x + w - 1, y + h - 1, NEAR_BLACK)  # shoes
    s.save("textures/entity/enemies/thug.png")

    # --- Alley Gunner: tactical dark gray, cap + goggles, red armband ---
    s = Skin()
    tac = (66, 68, 76, 255)
    human_head(s, face=SKIN_TONE_DARK, eye_style="shades", hair=(40, 40, 46, 255))
    for limb in (BODY, RARM, LARM, RLEG, LLEG):
        paint_limb(s, limb, tac)
    # vest plates
    bx, by, bw, bh = BODY["front"]
    s.rect(bx + 1, by + 1, bx + bw - 2, by + 6, shade(tac, 0.7))
    s.rect(bx + 2, by + 2, bx + 3, by + 4, shade(tac, 1.25))  # mag pouch
    # red armband on left arm
    lx, ly, lw, lh = LARM["front"]
    s.rect(lx, ly + 1, lx + lw - 1, ly + 2, (180, 40, 50, 255))
    # boots
    for leg in (RLEG, LLEG):
        x, y, w, h = leg["front"]
        s.rect(x, y + h - 2, x + w - 1, y + h - 1, NEAR_BLACK)
    s.save("textures/entity/enemies/gunner.png")

    # --- Dock Brute: tank top, bandana, big arms ---
    s = Skin()
    human_head(s, face=SKIN_TONE_DARK, eye_style="human")
    # red bandana
    for f in ("top", "front", "back", "left", "right"):
        x, y, w, h = HEAD[f]
        s.rect(x, y, x + w - 1, y + (2 if f != "top" else h - 1), (170, 35, 40, 255))
    suit_eyes(s, HEAD["front"], style="human")
    tank = (90, 92, 98, 255)
    paint_limb(s, BODY, tank)
    bx, by, bw, bh = BODY["front"]
    s.rect(bx + 2, by, bx + 2, by + 2, SKIN_TONE_DARK)  # tank straps → skin shoulders
    s.rect(bx + bw - 3, by, bx + bw - 3, by + 2, SKIN_TONE_DARK)
    for arm in (RARM, LARM):
        paint_limb(s, arm, SKIN_TONE_DARK)
    pants = (58, 48, 42, 255)
    for leg in (RLEG, LLEG):
        paint_limb(s, leg, pants)
        x, y, w, h = leg["front"]
        s.rect(x, y + h - 2, x + w - 1, y + h - 1, (35, 30, 26, 255))
    s.save("textures/entity/enemies/brute.png")

    # --- Shadow Runner: sleek purple-black bodysuit, cyan visor ---
    s = Skin()
    suitcol = (40, 30, 60, 255)
    human_head(s, face=suitcol, eye_style="visor", mask=suitcol)
    for limb in (BODY, RARM, LARM, RLEG, LLEG):
        paint_limb(s, limb, suitcol)
    neon = (150, 80, 220, 255)
    for limb in (BODY, RARM, LARM, RLEG, LLEG):
        for f in ("front", "back"):
            x, y, w, h = limb[f]
            s.line(x + w // 2, y, x + w // 2, y + h - 1, shade(neon, 0.8))
    bx, by, bw, bh = BODY["front"]
    s.line(bx, by + 5, bx + bw - 1, by + 5, neon)
    s.save("textures/entity/enemies/shadow.png")

    # --- The Enforcer: white suit, purple shirt, shades (elite silhouette) ---
    s = Skin()
    pale = (228, 226, 222, 255)
    human_head(s, face=(235, 205, 180, 255), eye_style="shades")
    for limb in (BODY, RARM, LARM):
        paint_limb(s, limb, pale)
    bx, by, bw, bh = BODY["front"]
    s.rect(bx + 2, by, bx + bw - 3, by + 7, (110, 60, 150, 255))  # purple shirt
    s.line(bx + bw // 2, by + 1, bx + bw // 2, by + 6, NEAR_BLACK)  # tie
    for leg in (RLEG, LLEG):
        paint_limb(s, leg, pale)
        x, y, w, h = leg["front"]
        s.rect(x, y + h - 2, x + w - 1, y + h - 1, NEAR_BLACK)
    s.save("textures/entity/enemies/enforcer.png")

    # --- bullet texture (16x16 metal sphere) ---
    img = Image.new("RGBA", (16, 16), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    d.ellipse([4, 4, 11, 11], fill=(120, 124, 132, 255))
    d.ellipse([5, 5, 9, 9], fill=(170, 174, 182, 255))
    d.point((6, 6), fill=(235, 238, 245, 255))
    img.save(os.path.join(RP, "textures/entity/bullet.png"))


# --------------------------------------------------------------------------
# item icons (16x16, distinct silhouettes, consistent 1px outline — §15.3)
# --------------------------------------------------------------------------
OUTLINE = (14, 14, 18, 255)


def icon_canvas():
    img = Image.new("RGBA", (16, 16), (0, 0, 0, 0))
    return img, ImageDraw.Draw(img)


def outlined(d, box, fill):
    x0, y0, x1, y1 = box
    d.rectangle([x0 - 1, y0 - 1, x1 + 1, y1 + 1], fill=OUTLINE)
    d.rectangle(box, fill=fill)


def web_ball(d, cx, cy, r, color=WHITE, line=PALE_GRAY):
    d.ellipse([cx - r, cy - r, cx + r, cy + r], fill=color)
    for a in range(0, 180, 45):
        import math
        rad = math.radians(a)
        d.line([cx - r * math.cos(rad), cy - r * math.sin(rad),
                cx + r * math.cos(rad), cy + r * math.sin(rad)], fill=line)
    d.ellipse([cx - r // 2, cy - r // 2, cx + r // 2, cy + r // 2], outline=line)


def generate_items():
    # web shooter: wrist device + nozzle + strand
    img, d = icon_canvas()
    outlined(d, (4, 5, 11, 13), (95, 100, 112, 255))
    d.rectangle([5, 6, 10, 12], fill=(130, 136, 148, 255))
    d.rectangle([6, 2, 9, 5], fill=OUTLINE)
    d.rectangle([7, 3, 8, 4], fill=(210, 214, 222, 255))  # nozzle
    d.point((7, 8), fill=(210, 40, 50, 255)); d.point((8, 8), fill=(210, 40, 50, 255))  # button
    d.line([6, 10, 9, 10], fill=shade(CHARCOAL, 1.4))
    for p in ((10, 2), (11, 1), (12, 2), (13, 1)):
        d.point(p, fill=WHITE)  # strand flick
    img.save(os.path.join(RP, "textures/items/web_shooter.png"))

    # impact web: dense web ball with impact spikes
    img, d = icon_canvas()
    web_ball(d, 8, 8, 5)
    for p in ((2, 3), (13, 3), (3, 13), (12, 12), (8, 1), (8, 14)):
        d.point(p, fill=WHITE)
    img.save(os.path.join(RP, "textures/items/impact_web.png"))

    # restraint web: net square with border
    img, d = icon_canvas()
    outlined(d, (3, 3, 12, 12), (235, 235, 240, 255))
    for i in range(4, 13, 3):
        d.line([i, 3, i, 12], fill=(170, 172, 182, 255))
        d.line([3, i, 12, i], fill=(170, 172, 182, 255))
    img.save(os.path.join(RP, "textures/items/restraint_web.png"))

    # web pull: hook + line + arrow
    img, d = icon_canvas()
    d.line([3, 12, 11, 4], fill=WHITE)
    d.line([11, 4, 12, 6], fill=WHITE)
    d.line([12, 6, 10, 7], fill=WHITE)  # hook curl
    d.polygon([(2, 13), (4, 13), (3, 11)], fill=WHITE)
    d.polygon([(13, 1), (15, 3), (13, 4), (12, 2)], fill=(200, 25, 35, 255))
    img.save(os.path.join(RP, "textures/items/web_pull.png"))

    # tech pulse: emitter with cyan arcs
    img, d = icon_canvas()
    outlined(d, (5, 5, 10, 12), (60, 66, 78, 255))
    d.point((7, 4), fill=CYAN); d.point((8, 4), fill=CYAN)
    d.arc([3, 2, 12, 11], start=200, end=340, fill=CYAN)
    d.arc([1, 0, 14, 13], start=200, end=340, fill=shade(CYAN, 0.75))
    d.rectangle([7, 8, 8, 9], fill=CYAN)
    img.save(os.path.join(RP, "textures/items/tech_pulse.png"))

    # threat scanner: radar screen
    img, d = icon_canvas()
    outlined(d, (2, 2, 13, 13), (28, 40, 46, 255))
    d.ellipse([4, 4, 11, 11], outline=(60, 190, 220, 255))
    d.ellipse([6, 6, 9, 9], outline=(60, 190, 220, 200))
    d.line([8, 8, 12, 4], fill=(120, 240, 255, 255))
    d.point((5, 6), fill=(255, 80, 80, 255)); d.point((10, 9), fill=(255, 80, 80, 255))
    img.save(os.path.join(RP, "textures/items/threat_scanner.png"))

    # spider manual: red book + black spider
    img, d = icon_canvas()
    outlined(d, (3, 2, 12, 13), (176, 30, 40, 255))
    d.rectangle([11, 3, 12, 12], fill=(235, 232, 220, 255))  # pages
    d.line([4, 2, 4, 13], fill=shade((176, 30, 40, 255), 0.7))  # spine
    spider_emblem_on_icon(d, 7, 7, NEAR_BLACK)
    img.save(os.path.join(RP, "textures/items/spider_manual.png"))


def spider_emblem_on_icon(d, cx, cy, color):
    d.rectangle([cx - 1, cy - 2, cx, cy + 2], fill=color)
    for side in (-1, 1):
        for i, dy in enumerate((-2, -1, 0, 1)):
            d.line([cx, cy + dy, cx + side * 3, cy + dy + (-1 if i < 2 else 1)], fill=color)


def suit_icon(path, primary, secondary, emblem, eye=None):
    """Chestplate-silhouette icon in suit colors."""
    img, d = icon_canvas()
    outlined(d, (4, 4, 11, 13), primary)          # torso
    outlined(d, (2, 4, 3, 8), secondary)          # left shoulder
    outlined(d, (12, 4, 13, 8), secondary)        # right shoulder
    d.rectangle([5, 5, 10, 12], fill=primary)
    d.rectangle([4, 11, 11, 12], fill=secondary)  # waist band
    spider_emblem_on_icon(d, 7, 8, emblem)
    if eye:
        d.point((6, 5), fill=eye); d.point((9, 5), fill=eye)
    img.save(os.path.join(RP, path))


def generate_suit_icons():
    suit_icon("textures/items/suit_classic.png", SPIDER_RED, DEEP_BLUE, NEAR_BLACK, WHITE)
    suit_icon("textures/items/suit_improvised.png", (140, 140, 146, 255), (95, 95, 102, 255), (190, 40, 50, 255), WHITE)
    suit_icon("textures/items/suit_stealth.png", (26, 26, 31, 255), (16, 16, 20, 255), WHITE)
    suit_icon("textures/items/suit_advanced.png", (238, 238, 243, 255), (205, 208, 218, 255), (190, 25, 35, 255))
    suit_icon("textures/items/suit_urban.png", (22, 22, 27, 255), (12, 12, 16, 255), (200, 30, 45, 255))
    suit_icon("textures/items/suit_iron.png", GUNMETAL, shade(GUNMETAL, 0.72), GOLD, CYAN)


def spawn_egg(path, base, spot):
    """Vanilla-shaped spawn egg with deterministic spots."""
    img = Image.new("RGBA", (16, 16), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    # classic egg silhouette
    rows = {
        2: (6, 9), 3: (5, 10), 4: (4, 11), 5: (4, 11), 6: (3, 12), 7: (3, 12),
        8: (3, 12), 9: (3, 12), 10: (3, 12), 11: (4, 11), 12: (4, 11), 13: (5, 10),
    }
    for y, (x0, x1) in rows.items():
        d.line([x0, y, x1, y], fill=base)
    # bottom shading
    for y in (11, 12, 13):
        x0, x1 = rows[y]
        d.line([x0, y, x1, y], fill=shade(base, 0.82))
    # spots (fixed pattern)
    for (sx, sy) in ((5, 4), (9, 6), (6, 8), (10, 10), (4, 7)):
        d.point((sx, sy), fill=spot)
        d.point((sx + 1, sy), fill=shade(spot, 0.85))
    # outline
    img_out = img.copy()
    d2 = ImageDraw.Draw(img_out)
    img.save(os.path.join(RP, path))


def generate_eggs():
    os.makedirs(os.path.join(RP, "textures/items/eggs"), exist_ok=True)
    spawn_egg("textures/items/eggs/egg_thug.png", (62, 84, 56, 255), (205, 160, 120, 255))
    spawn_egg("textures/items/eggs/egg_gunner.png", (66, 68, 76, 255), (180, 40, 50, 255))
    spawn_egg("textures/items/eggs/egg_brute.png", (170, 35, 40, 255), (170, 125, 90, 255))
    spawn_egg("textures/items/eggs/egg_shadow.png", (40, 30, 60, 255), (150, 80, 220, 255))
    spawn_egg("textures/items/eggs/egg_enforcer.png", (228, 226, 222, 255), (110, 60, 150, 255))


# --------------------------------------------------------------------------
# blocks (16x16 station faces)
# --------------------------------------------------------------------------
def generate_blocks():
    # top: dark plate, red ring, black spider, corner bolts
    img, d = icon_canvas()
    d.rectangle([0, 0, 15, 15], fill=(52, 55, 64, 255))
    d.rectangle([1, 1, 14, 14], fill=(62, 66, 76, 255))
    for (bx, by) in ((1, 1), (14, 1), (1, 14), (14, 14)):
        d.point((bx, by), fill=(120, 126, 138, 255))
    d.ellipse([4, 4, 11, 11], outline=(190, 30, 40, 255))
    d.ellipse([5, 5, 10, 10], fill=(35, 36, 42, 255))
    spider_emblem_on_icon(d, 8, 8, (215, 45, 55, 255))
    img.save(os.path.join(RP, "textures/blocks/station_top.png"))

    # side: panel with red stripe, cyan screen, vents
    img, d = icon_canvas()
    d.rectangle([0, 0, 15, 15], fill=(48, 51, 60, 255))
    d.rectangle([1, 1, 14, 14], fill=(58, 62, 72, 255))
    d.rectangle([0, 12, 15, 13], fill=(160, 30, 40, 255))  # red base stripe
    d.rectangle([3, 3, 8, 8], fill=(20, 26, 30, 255))       # screen
    d.rectangle([4, 4, 7, 7], fill=(40, 150, 180, 255))
    d.point((5, 5), fill=CYAN); d.point((6, 6), fill=CYAN)
    for vy in (10, 11):
        d.line([3, vy, 12, vy], fill=(38, 40, 48, 255))     # vents
    d.rectangle([11, 3, 13, 8], fill=(70, 74, 84, 255))
    d.point((12, 4), fill=(200, 60, 60, 255))               # status LED
    img.save(os.path.join(RP, "textures/blocks/station_side.png"))


# --------------------------------------------------------------------------
# particle textures
# --------------------------------------------------------------------------
def generate_particles():
    # web_dot: soft white dot 8x8
    img = Image.new("RGBA", (8, 8), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    d.ellipse([1, 1, 6, 6], fill=(255, 255, 255, 235))
    d.ellipse([2, 2, 5, 5], fill=(255, 255, 255, 255))
    for p in ((0, 3), (3, 0), (7, 3), (3, 7), (0, 4), (4, 0), (7, 4), (4, 7)):
        d.point(p, fill=(255, 255, 255, 90))
    img.save(os.path.join(RP, "textures/particle/web_dot.png"))

    # spark: 4-point star
    img = Image.new("RGBA", (8, 8), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    d.line([0, 3, 7, 3], fill=(255, 255, 255, 160))
    d.line([3, 0, 3, 7], fill=(255, 255, 255, 160))
    d.line([1, 2, 6, 2], fill=(255, 255, 255, 220))
    d.line([2, 1, 2, 6], fill=(255, 255, 255, 220))
    d.rectangle([3, 3, 4, 4], fill=(255, 255, 255, 255))
    img.save(os.path.join(RP, "textures/particle/spark.png"))

    # ping: red diamond alert
    img = Image.new("RGBA", (8, 8), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    d.polygon([(3, 0), (7, 3), (3, 7), (0, 3)], fill=(210, 40, 50, 235))
    d.polygon([(3, 2), (5, 3), (3, 5), (2, 3)], fill=(255, 120, 120, 255))
    img.save(os.path.join(RP, "textures/particle/ping.png"))

    # ring: expanding cyan ring 16x16
    img = Image.new("RGBA", (16, 16), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    d.ellipse([1, 1, 14, 14], outline=(70, 220, 255, 200), width=2)
    d.ellipse([3, 3, 12, 12], outline=(140, 240, 255, 120))
    img.save(os.path.join(RP, "textures/particle/ring.png"))


# --------------------------------------------------------------------------
# pack icons (128x128)
# --------------------------------------------------------------------------
def pack_icon(path, bg_top, bg_bottom):
    img = Image.new("RGBA", (128, 128), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    # vertical gradient
    for y in range(128):
        t = y / 127
        c = tuple(int(bg_top[i] + (bg_bottom[i] - bg_top[i]) * t) for i in range(3)) + (255,)
        d.line([0, y, 127, y], fill=c)
    # radial web geometry from center
    cx, cy = 64, 64
    import math
    dark = (10, 10, 14, 160)
    for i in range(16):
        rad = math.radians(i * 22.5)
        d.line([cx, cy, cx + 90 * math.cos(rad), cy + 90 * math.sin(rad)], fill=dark)
    for r in (16, 30, 46, 64, 84):
        d.ellipse([cx - r, cy - r, cx + r, cy + r], outline=dark)
    # big centered spider
    spider_big(d, cx, cy + 6, (8, 8, 12, 255))
    # frame
    d.rectangle([0, 0, 127, 127], outline=(245, 245, 250, 255))
    d.rectangle([2, 2, 125, 125], outline=(10, 10, 14, 200))
    img.save(path)


def spider_big(d, cx, cy, color):
    d.ellipse([cx - 7, cy - 16, cx + 7, cy - 2], fill=color)   # abdomen
    d.ellipse([cx - 5, cy - 22, cx + 5, cy - 10], fill=color)  # thorax/head
    for side in (-1, 1):
        for i, (dy1, dy2) in enumerate(((-18, -30), (-12, -20), (-4, -8), (2, 6))):
            x1 = cx + side * 6
            x2 = cx + side * (16 + i * 6)
            x3 = cx + side * (20 + i * 8)
            d.line([x1, cy + dy1 // 2, x2, cy + dy2], fill=color, width=3)
            d.line([x2, cy + dy2, x3, cy + dy2 + 10], fill=color, width=3)
    # eyes glint
    d.point((cx - 2, cy - 18), fill=(240, 240, 250, 255))
    d.point((cx + 2, cy - 18), fill=(240, 240, 250, 255))


def main():
    generate_suits()
    generate_enemies()
    generate_items()
    generate_suit_icons()
    generate_eggs()
    generate_blocks()
    generate_particles()
    pack_icon(os.path.join(BP, "pack_icon.png"), (196, 30, 42), (96, 14, 24))
    pack_icon(os.path.join(RP, "pack_icon.png"), (40, 62, 170), (18, 28, 90))
    print("All textures generated.")


if __name__ == "__main__":
    main()
