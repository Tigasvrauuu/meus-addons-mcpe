#!/usr/bin/env python3
"""tools/texture_gen.py — HD procedural pixel-art generator (v2, "4x pass").

Every texture of Spider-Man: Definitive Experience is ORIGINAL art drawn here
from scratch (spec §2.2/§15.6 — no ripped or commercial assets). This second
generation renders everything at 4x the classic resolution with real craft:
per-face lighting, vertical/radial gradients, fabric & metal noise, radial web
patterns, curved spider emblems, glows (gaussian), soft alpha particles and
supersampled anti-aliasing.

Resolutions (v1 → v2):
  item icons / spawn eggs / block faces / bullet : 16² → 64²
  particle sprites                                : 8²/16² → 32²/64²
  entity skins (suits, enemies)                   : 64² → 256²
  pack icons                                      : 128² → 512²

Deterministic: all randomness uses fixed seeds; same bytes every run.
Run:  python3 tools/texture_gen.py     (requires Pillow)
"""

import math
import os
import random

from PIL import Image, ImageDraw, ImageFilter

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
RP = os.path.join(ROOT, "resource_pack")
BP = os.path.join(ROOT, "behavior_pack")

SS = 2  # supersample factor (draw at SSx, downscale with LANCZOS for AA)

# ---------------------------------------------------------------- palette
SPIDER_RED = (206, 26, 38)
DARK_RED = (122, 12, 22)
DEEP_BLUE = (28, 52, 168)
NAVY = (16, 30, 96)
CHARCOAL = (30, 30, 36)
NEAR_BLACK = (14, 14, 18)
WHITE = (246, 246, 250)
PALE = (206, 208, 216)
CYAN = (72, 222, 255)
GOLD = (222, 176, 62)
GUNMETAL = (108, 114, 128)
STEEL = (152, 158, 170)


def rgba(c, a=255):
    return (c[0], c[1], c[2], a)


def shade(c, f):
    return tuple(max(0, min(255, int(v * f))) for v in c[:3])


def mix(c1, c2, t):
    return tuple(int(c1[i] + (c2[i] - c1[i]) * t) for i in range(3))


# ---------------------------------------------------------------- canvas
class Canvas:
    """RGBA canvas in TARGET pixel space; internally supersampled SSx."""

    def __init__(self, w, h, ss=SS):
        self.w, self.h, self.ss = w, h, ss
        self.img = Image.new("RGBA", (w * ss, h * ss), (0, 0, 0, 0))
        self.d = ImageDraw.Draw(self.img)

    # -- primitives (coords in target space) --
    def _s(self, *nums):
        return [n * self.ss for n in nums]

    def _overlay(self, fn):
        """ImageDraw REPLACES pixels (no blending); semi-transparent shapes
        must be composited through an overlay layer to preserve alpha."""
        layer = Image.new("RGBA", self.img.size, (0, 0, 0, 0))
        fn(ImageDraw.Draw(layer))
        self.img = Image.alpha_composite(self.img, layer)
        self.d = ImageDraw.Draw(self.img)

    def rect(self, x0, y0, x1, y1, color):
        self.d.rectangle(self._s(x0, y0, x1, y1), fill=rgba(color))

    def rect_a(self, x0, y0, x1, y1, color, a=255):
        if a >= 255:
            self.d.rectangle(self._s(x0, y0, x1, y1), fill=rgba(color))
        else:
            self._overlay(lambda ld: ld.rectangle(self._s(x0, y0, x1, y1), fill=rgba(color, a)))

    def line(self, p0, p1, color, width=1, a=255):
        w = max(1, int(width * self.ss))
        args = self._s(p0[0], p0[1], p1[0], p1[1])
        if a >= 255:
            self.d.line(args, fill=rgba(color), width=w)
        else:
            self._overlay(lambda ld: ld.line(args, fill=rgba(color, a), width=w))

    def poly(self, pts, color, a=255):
        args = self._s(*[c for p in pts for c in p])
        if a >= 255:
            self.d.polygon(args, fill=rgba(color))
        else:
            self._overlay(lambda ld: ld.polygon(args, fill=rgba(color, a)))

    def ellipse(self, x0, y0, x1, y1, color=None, a=255, outline=None, ow=1):
        args = self._s(x0, y0, x1, y1)
        fill = rgba(color, a) if color else None
        ol = rgba(outline) if outline else None
        w = max(1, int(ow * self.ss))
        if a >= 255:
            self.d.ellipse(args, fill=fill, outline=ol, width=w)
        else:
            self._overlay(lambda ld: ld.ellipse(args, fill=fill, outline=ol, width=w))

    def vgrad(self, x0, y0, x1, y1, ctop, cbot):
        x0, y0, x1, y1 = (int(round(v)) for v in (x0, y0, x1, y1))
        h = max(1, y1 - y0)
        for i in range(h + 1):
            t = i / h
            # full target-space row (y..y+1), else supersampling halves alpha
            self.rect(x0, y0 + i, x1, y0 + i + 1, mix(ctop, cbot, t))

    def hgrad(self, x0, y0, x1, y1, cleft, cright):
        x0, y0, x1, y1 = (int(round(v)) for v in (x0, y0, x1, y1))
        w = max(1, x1 - x0)
        for i in range(w + 1):
            t = i / w
            self.rect(x0 + i, y0, x0 + i + 1, y1, mix(cleft, cright, t))

    def radial(self, cx, cy, r, color, a0=255, a1=0):
        """Soft radial falloff disc (glow / soft dot), one composite pass."""
        layer = Image.new("RGBA", self.img.size, (0, 0, 0, 0))
        ld = ImageDraw.Draw(layer)
        for i in range(int(r), 0, -1):
            t = i / r
            a = int(a1 + (a0 - a1) * (1 - t) ** 1.6)
            ld.ellipse(self._s(cx - i, cy - i, cx + i, cy + i), fill=rgba(color, a))
        self.img = Image.alpha_composite(self.img, layer)
        self.d = ImageDraw.Draw(self.img)

    def noise(self, amount, seed, only_opaque=True):
        rng = random.Random(seed)
        px = self.img.load()
        W, H = self.img.size
        for y in range(H):
            for x in range(W):
                r, g, b, a = px[x, y]
                if a == 0 and only_opaque:
                    continue
                n = rng.randint(-amount, amount)
                px[x, y] = (max(0, min(255, r + n)), max(0, min(255, g + n)),
                            max(0, min(255, b + n)), a)

    def glow(self, color, radius=2.0, thresh=90):
        """Bloom ONLY pixels close to `color` (emissive parts), not the whole
        silhouette: mask by color distance, blur it, composite back."""
        px = self.img.load()
        W, H = self.img.size
        mask = Image.new("L", (W, H), 0)
        mp = mask.load()
        cr, cg, cb = color
        for y in range(H):
            row = y
            for x in range(W):
                r, g, b, a = px[x, row]
                if a and abs(r - cr) + abs(g - cg) + abs(b - cb) < thresh:
                    mp[x, row] = a
        colored = Image.new("RGBA", (W, H), rgba(color, 255))
        colored.putalpha(mask)
        blurred = colored.filter(ImageFilter.GaussianBlur(radius * self.ss))
        self.img = Image.alpha_composite(self.img, blurred)
        self.d = ImageDraw.Draw(self.img)

    def outline_alpha(self, color, width=1):
        """Dilate alpha and paint behind: crisp outer outline."""
        a = self.img.split()[3]
        for _ in range(max(1, int(width * self.ss))):
            a = a.filter(ImageFilter.MaxFilter(3))
        back = Image.new("RGBA", self.img.size, rgba(color, 255))
        back.putalpha(a)
        self.img = Image.alpha_composite(back, self.img)
        self.d = ImageDraw.Draw(self.img)

    def blit(self, other, dx=0, dy=0):
        self.img.alpha_composite(other.img, (dx * self.ss, dy * self.ss))
        self.d = ImageDraw.Draw(self.img)

    def down(self):
        if self.ss == 1:
            return self.img
        return self.img.resize((self.w, self.h), Image.LANCZOS)

    def save(self, path):
        os.makedirs(os.path.dirname(path), exist_ok=True)
        self.down().save(path)


# ---------------------------------------------------------------- spider motifs
def spider_emblem(cv, cx, cy, s, color, glow_color=None):
    """Curved-leg spider silhouette; s = scale in target px."""
    if glow_color:
        cv.radial(cx, cy, s * 2.2, glow_color, a0=90)
    # abdomen + thorax
    cv.ellipse(cx - s * 0.42, cy - s * 0.10, cx + s * 0.42, cy + s * 0.78, color=color)
    cv.ellipse(cx - s * 0.26, cy - s * 0.52, cx + s * 0.26, cy - s * 0.02, color=color)
    # 8 legs: 3-segment curved polylines
    for side in (-1, 1):
        for i, (ay, bx, by) in enumerate(((-0.42, 1.5, -1.05), (-0.18, 1.75, -0.35),
                                          (0.06, 1.75, 0.4), (0.3, 1.5, 1.1))):
            p0 = (cx + side * s * 0.2, cy + s * ay)
            p1 = (cx + side * s * (0.55 + 0.12 * i), cy + s * (ay - 0.12))
            p2 = (cx + side * s * bx * 0.72, cy + s * by * 0.72)
            p3 = (cx + side * s * bx, cy + s * by)
            w = max(1, s * 0.085)
            cv.line(p0, p1, color, w)
            cv.line(p1, p2, color, w)
            cv.line(p2, p3, color, max(1, w * 0.7))


def web_pattern(cv, x0, y0, x1, y1, color, alpha=150, rings=3, spokes=8, width=1):
    """Radial spider-web: spokes + sagging concentric rings inside a box."""
    cx, cy = (x0 + x1) / 2, (y0 + y1) / 2
    r = max(x1 - x0, y1 - y0) * 0.75
    ends = []
    for i in range(spokes):
        a = math.radians(i * 360 / spokes + 22.5)
        ex, ey = cx + r * math.cos(a), cy + r * math.sin(a)
        ends.append((ex, ey))
        cv.line((cx, cy), (ex, ey), color, width, a=alpha)
    for k in range(1, rings + 1):
        rr = r * k / (rings + 0.4)
        pts = []
        for i in range(spokes):
            a = math.radians(i * 360 / spokes + 22.5)
            pts.append((cx + rr * math.cos(a), cy + rr * math.sin(a)))
        for i in range(spokes):
            p, q = pts[i], pts[(i + 1) % spokes]
            mid = ((p[0] + q[0]) / 2, (p[1] + q[1]) / 2)
            sag = ((mid[0] - cx) * 0.86 + cx, (mid[1] - cy) * 0.86 + cy)
            cv.line(p, sag, color, width, a=alpha)
            cv.line(sag, q, color, width, a=alpha)


def lens_eyes(cv, x0, y0, w, h, style, lens=WHITE, rim=NEAR_BLACK):
    """Masked-suit eyes inside a head-front box (target px)."""
    ew = w * 0.34
    eh = h * 0.42
    for ox in (w * 0.10, w * 0.56):
        ex, ey = x0 + ox, y0 + h * 0.24
        if style == "narrow":
            eh2 = eh * 0.55
            cv.poly([(ex, ey + eh2 * 0.4), (ex + ew * 0.5, ey), (ex + ew, ey + eh2 * 0.5),
                     (ex + ew * 0.5, ey + eh2)], rim)
            cv.poly([(ex + ew * 0.12, ey + eh2 * 0.42), (ex + ew * 0.5, ey + eh2 * 0.16),
                     (ex + ew * 0.86, ey + eh2 * 0.5), (ex + ew * 0.5, ey + eh2 * 0.82)], lens)
            continue
        # angular teardrop lenses: dark rim + gradient lens + glint
        cv.poly([(ex, ey + eh * 0.35), (ex + ew * 0.42, ey), (ex + ew, ey + eh * 0.22),
                 (ex + ew * 0.86, ey + eh), (ex + ew * 0.2, ey + eh * 0.9)], rim)
        cv.poly([(ex + ew * 0.12, ey + eh * 0.36), (ex + ew * 0.44, ey + eh * 0.12),
                 (ex + ew * 0.86, ey + eh * 0.3), (ex + ew * 0.74, ey + eh * 0.84),
                 (ex + ew * 0.26, ey + eh * 0.76)], mix(lens, (255, 255, 255), 0.1))
        cv.line((ex + ew * 0.24, ey + eh * 0.3), (ex + ew * 0.42, ey + eh * 0.22),
                (255, 255, 255), max(1, ew * 0.1))


def human_eyes(cv, x0, y0, w, h, skin, dark=NEAR_BLACK):
    ey = y0 + h * 0.42
    for ox in (0.28, 0.62):
        cv.ellipse(x0 + w * ox, ey, x0 + w * ox + w * 0.10, ey + h * 0.10, color=dark)
    cv.line((x0 + w * 0.34, y0 + h * 0.74), (x0 + w * 0.66, y0 + h * 0.74),
            shade(skin, 0.62), max(1, w * 0.03))


# ---------------------------------------------------------------- skin rig (256²)
S = 4  # 4x of the classic 64x64 UV layout
# Per-face UV rects (x, y, w, h) in classic 64x64 space — side panels are 4px
# wide on body/limbs, 8px on the head; top/bottom caps sized accordingly.
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
LIGHT = {"top": 1.14, "front": 1.0, "back": 0.9, "left": 0.84, "right": 0.88, "bottom": 0.66}


class Skin:
    def __init__(self):
        self.cv = Canvas(64 * S, 64 * S)

    def box(self, limb, face):
        x, y, w, h = limb[face]
        return (x * S, y * S, (x + w) * S - 1, (y + h) * S - 1)

    def web_face(self, limb, face, color, alpha=150, rings=3, spokes=8, width=1):
        """Web pattern clipped exactly to one UV face (no bleed, spec-grade)."""
        x0, y0, x1, y1 = self.box(limb, face)
        w, h = x1 - x0 + 1, y1 - y0 + 1
        sub = Canvas(w, h, ss=SS)
        web_pattern(sub, 0, 0, w - 1, h - 1, color, alpha=alpha, rings=rings,
                    spokes=spokes, width=width)
        self.cv.blit(sub, x0, y0)

    def face(self, limb, face, color, grad=0.16, light=True):
        x0, y0, x1, y1 = self.box(limb, face)
        c = shade(color, LIGHT[face]) if light else color
        self.cv.vgrad(x0, y0, x1, y1, shade(c, 1 + grad / 2), shade(c, 1 - grad / 2))

    def fill(self, limb, face, color, a=255):
        x0, y0, x1, y1 = self.box(limb, face)
        self.cv.rect_a(x0, y0, x1, y1, color, a)

    def save(self, relpath):
        self.cv.save(os.path.join(RP, relpath))


def paint_limb(sk, limb, color, grad=0.16):
    for face in ("top", "front", "back", "left", "right", "bottom"):
        sk.face(limb, face, color, grad)


# ---------------------------------------------------------------- suits
def suit_skin(path, primary, secondary, opts):
    sk = Skin()
    webbed = opts.get("web", True)
    web_col = opts["web_color"]
    # head
    for face in ("top", "front", "back", "left", "right", "bottom"):
        sk.face(HEAD, face, primary)
        if webbed and face != "bottom":
            sk.web_face(HEAD, face, web_col, alpha=opts.get("web_alpha", 150),
                        rings=3, spokes=8, width=max(1, S * 0.35))
    hx0, hy0, hx1, hy1 = sk.box(HEAD, "front")
    estyle = opts["eyes"]
    if estyle == "goggles":
        sk.cv.rect_a(hx0, hy0 + 8 * S / 2, hx1, hy0 + 8 * S / 2 + S, shade(primary, 0.7))
        for ox in (1.2, 4.4):
            ex = hx0 + ox * S
            sk.cv.ellipse(ex, hy0 + 1.6 * S, ex + 2.4 * S, hy0 + 4.4 * S, color=CHARCOAL)
            sk.cv.ellipse(ex + 0.35 * S, hy0 + 1.95 * S, ex + 2.05 * S, hy0 + 4.05 * S,
                          color=mix(WHITE, (180, 220, 235), 0.35))
            sk.cv.line((ex + 0.7 * S, hy0 + 2.4 * S), (ex + 1.3 * S, hy0 + 2.9 * S),
                       (255, 255, 255), max(1, S * 0.22))
    elif estyle == "visor":
        sk.cv.rect_a(hx0, hy0 + 2.2 * S, hx1, hy0 + 4.6 * S, NEAR_BLACK)
        sk.cv.hgrad(hx0 + S * 0.5, hy0 + 2.8 * S, hx1 - S * 0.5, hy0 + 3.9 * S,
                    shade(CYAN, 0.7), CYAN)
        sk.cv.glow(CYAN, radius=1.2)
    elif estyle == "shades":
        sk.cv.rect_a(hx0, hy0 + 2.6 * S, hx1, hy0 + 4.2 * S, NEAR_BLACK)
        sk.cv.line((hx0 + S, hy0 + 3 * S), (hx0 + 3 * S, hy0 + 3 * S), (90, 96, 110), S * 0.22)
    elif estyle == "human":
        human_eyes(sk.cv, hx0, hy0, 8 * S, 8 * S, opts.get("skin_tone", (205, 160, 120)))
    else:
        lens_eyes(sk.cv, hx0, hy0, 8 * S, 8 * S, estyle, lens=opts.get("lens", WHITE))
    # torso
    for face in ("top", "front", "back", "left", "right", "bottom"):
        col = secondary if face in ("left", "right") else primary
        sk.face(BODY, face, col)
        if webbed and face in ("front", "back", "top"):
            sk.web_face(BODY, face, web_col, alpha=opts.get("web_alpha", 150),
                        rings=4, spokes=8, width=max(1, S * 0.35))
    fx0, fy0, fx1, fy1 = sk.box(BODY, "front")
    spider_emblem(sk.cv, (fx0 + fx1) / 2, fy0 + 4.4 * S, 2.6 * S, opts["emblem"],
                  glow_color=opts.get("emblem_glow"))
    bx0, by0, bx1, by1 = sk.box(BODY, "back")
    spider_emblem(sk.cv, (bx0 + bx1) / 2, by0 + 4.8 * S, 3.1 * S, opts["emblem_back"],
                  glow_color=opts.get("emblem_glow"))
    # limbs: sleeves + gloves/boots cuffs
    for limb in (RARM, LARM, RLEG, LLEG):
        paint_limb(sk, limb, secondary)
        is_arm = limb in (RARM, LARM)
        cuff = 4 if is_arm else 4
        for face in ("front", "back", "left", "right"):
            x0, y0, x1, y1 = sk.box(limb, face)
            hgt = y1 - y0
            cy0 = y1 - cuff * S
            sk.cv.vgrad(x0, cy0, x1, y1, shade(primary, LIGHT[face] * 1.06),
                        shade(primary, LIGHT[face] * 0.9))
            sk.cv.line((x0, cy0), (x1, cy0), shade(primary, 0.6), max(1, S * 0.3))
            if webbed:
                cw, ch = x1 - x0 + 1, y1 - cy0 + 1
                sub = Canvas(cw, ch, ss=SS)
                web_pattern(sub, 0, 0, cw - 1, ch - 1, web_col, alpha=110, rings=2,
                            spokes=6, width=max(1, S * 0.3))
                sk.cv.blit(sub, x0, cy0)
    if opts.get("accent"):
        opts["accent"](sk)
    sk.cv.noise(opts.get("noise", 3), seed=hash(path) % 9999)
    sk.save(path)


def iron_plating(sk):
    for limb in (BODY, RARM, LARM, RLEG, LLEG):
        for face in ("front", "back", "left", "right"):
            x0, y0, x1, y1 = sk.box(limb, face)
            hgt = (y1 - y0)
            n = 3
            for i in range(1, n + 1):
                yy = y0 + hgt * i / (n + 1)
                sk.cv.line((x0, yy), (x1, yy), shade(GOLD, 0.95), max(1, S * 0.35))
                sk.cv.line((x0, yy + S * 0.4), (x1, yy + S * 0.4), shade(CHARCOAL, 0.7),
                           max(1, S * 0.3))
            # rivets
            for rx in (x0 + S * 0.6, x1 - S * 0.6):
                for ry in (y0 + S * 0.6, y1 - S * 0.6):
                    sk.cv.ellipse(rx - S * 0.22, ry - S * 0.22, rx + S * 0.22, ry + S * 0.22,
                                  color=shade(STEEL, 1.15))


def urban_graffiti(sk):
    rng = random.Random(42)
    for limb, faces in ((BODY, ("right", "left")), (RARM, ("front",)), (LLEG, ("front",))):
        for face in faces:
            x0, y0, x1, y1 = sk.box(limb, face)
            for _ in range(3):
                px = rng.uniform(x0 + 2, x1 - 2)
                py = rng.uniform(y0 + 2, y1 - 2)
                sk.cv.line((px, py), (px + rng.uniform(-6, 6), py + rng.uniform(-8, 8)),
                           (206, 30, 46), max(1, S * 0.3), a=210)


def generate_suits():
    suit_skin("textures/entity/suits/suit_classic.png", SPIDER_RED, DEEP_BLUE, dict(
        web=True, web_color=(70, 6, 12), eyes="classic", emblem=NEAR_BLACK,
        emblem_back=SPIDER_RED, noise=3))
    suit_skin("textures/entity/suits/suit_improvised.png", (142, 142, 148), (96, 96, 104), dict(
        web=False, web_color=(120, 120, 128), eyes="goggles", emblem=(196, 40, 52),
        emblem_back=(196, 40, 52), noise=6))
    suit_skin("textures/entity/suits/suit_stealth.png", (26, 26, 32), (15, 15, 20), dict(
        web=True, web_color=(52, 52, 62), web_alpha=120, eyes="narrow", emblem=WHITE,
        emblem_back=WHITE, noise=2))
    suit_skin("textures/entity/suits/suit_advanced.png", (238, 238, 244), (204, 208, 220), dict(
        web=True, web_color=(186, 44, 54), web_alpha=120, eyes="classic",
        emblem=(196, 26, 38), emblem_back=(196, 26, 38), noise=2))
    suit_skin("textures/entity/suits/suit_urban.png", (24, 24, 30), (12, 12, 16), dict(
        web=True, web_color=(44, 44, 52), web_alpha=110, eyes="classic",
        emblem=(208, 32, 48), emblem_back=(208, 32, 48), accent=urban_graffiti, noise=4))
    suit_skin("textures/entity/suits/suit_iron.png", GUNMETAL, shade(GUNMETAL, 0.72), dict(
        web=False, web_color=CHARCOAL, eyes="classic", lens=CYAN, emblem=GOLD,
        emblem_back=GOLD, emblem_glow=(255, 210, 90), accent=iron_plating, noise=3))


# ---------------------------------------------------------------- enemies
def enemy_base():
    return Skin()


def hood_head(sk, hood, skin_tone):
    for face in ("top", "front", "back", "left", "right", "bottom"):
        sk.face(HEAD, face, hood)
    x0, y0, x1, y1 = sk.box(HEAD, "front")
    # hood opening: skin oval + inner shadow
    sk.cv.ellipse(x0 + 0.9 * S, y0 + 1.1 * S, x1 - 0.9 * S, y1 - 0.6 * S, color=shade(hood, 0.5))
    sk.cv.ellipse(x0 + 1.4 * S, y0 + 1.6 * S, x1 - 1.4 * S, y1 - 1.1 * S, color=skin_tone)
    sk.cv.ellipse(x0 + 1.8 * S, y0 + 2.0 * S, x1 - 1.8 * S, y0 + 3.4 * S,
                  color=shade(skin_tone, 1.12))
    human_eyes(sk.cv, x0 + 1.4 * S, y0 + 1.6 * S, 5.2 * S, 5.4 * S, skin_tone)
    # hood rim highlight
    sk.cv.ellipse(x0 + 0.7 * S, y0 + 0.9 * S, x1 - 0.7 * S, y1 - 0.4 * S,
                  outline=shade(hood, 1.3), ow=S * 0.35)


def generate_enemies():
    # ---- Street Thug: hoodie, jeans, sneakers
    sk = enemy_base()
    hoodie = (64, 86, 58)
    hood_head(sk, hoodie, (205, 160, 120))
    for limb in (BODY, RARM, LARM):
        paint_limb(sk, limb, hoodie)
    x0, y0, x1, y1 = sk.box(BODY, "front")
    sk.cv.line((x0 + 2 * S, y0 + 8 * S), (x1 - 2 * S, y0 + 8 * S), shade(hoodie, 0.7), S * 0.3)
    sk.cv.line((x0 + 2 * S, y0 + 8.6 * S), (x1 - 2 * S, y0 + 8.6 * S), shade(hoodie, 1.2), S * 0.2)
    for dx in (3.2, 4.5):  # drawstrings
        sk.cv.line((x0 + dx * S, y0 + 0.6 * S), (x0 + dx * S, y0 + 3.2 * S), PALE, S * 0.25)
        sk.cv.ellipse(x0 + dx * S - S * 0.2, y0 + 3.2 * S, x0 + dx * S + S * 0.2,
                      y0 + 3.7 * S, color=PALE)
    jeans = (54, 64, 96)
    for limb in (RLEG, LLEG):
        paint_limb(sk, limb, jeans)
        x0, y0, x1, y1 = sk.box(limb, "front")
        sk.cv.vgrad(x0, y1 - 2 * S, x1, y1, (40, 40, 46), (24, 24, 28))
        sk.cv.line((x0, y1 - 2 * S), (x1, y1 - 2 * S), (200, 200, 205), S * 0.22)
    sk.cv.noise(4, 11)
    sk.save("textures/entity/enemies/thug.png")

    # ---- Alley Gunner: cap, shades, tactical vest, armband
    sk = enemy_base()
    tac = (66, 68, 78)
    skin = (170, 125, 90)
    for face in ("top", "front", "back", "left", "right", "bottom"):
        sk.face(HEAD, face, skin)
    x0, y0, x1, y1 = sk.box(HEAD, "front")
    sk.cv.vgrad(x0, y0, x1, y0 + 2.2 * S, shade((44, 44, 52), 1.1), (44, 44, 52))  # cap
    sk.cv.rect_a(x0, y0 + 2.0 * S, x1, y0 + 2.6 * S, (30, 30, 36))  # brim shadow
    sk.cv.rect_a(x0 + 0.6 * S, y0 + 2.9 * S, x1 - 0.6 * S, y0 + 4.1 * S, NEAR_BLACK)  # shades
    sk.cv.line((x0 + 1.2 * S, y0 + 3.3 * S), (x0 + 3 * S, y0 + 3.3 * S), (120, 130, 150), S * 0.2)
    human_eyes(sk.cv, x0, y0 + 1.2 * S, 8 * S, 6 * S, skin)
    for limb in (BODY, RARM, LARM, RLEG, LLEG):
        paint_limb(sk, limb, tac)
    x0, y0, x1, y1 = sk.box(BODY, "front")
    sk.cv.vgrad(x0 + S, y0 + S, x1 - S, y0 + 7 * S, shade(tac, 0.66), shade(tac, 0.55))  # vest
    for py in (2.4, 4.6):  # pouches
        sk.cv.rect(x0 + 1.4 * S, y0 + py * S, x0 + 3.2 * S, y0 + (py + 1.5) * S, shade(tac, 1.25))
        sk.cv.line((x0 + 1.4 * S, y0 + (py + 0.5) * S), (x0 + 3.2 * S, y0 + (py + 0.5) * S),
                   shade(tac, 0.5), S * 0.2)
    sk.cv.line((x1 - 2.6 * S, y0 + S), (x1 - 2.6 * S, y0 + 7 * S), shade(tac, 1.4), S * 0.3)
    lx0, ly0, lx1, ly1 = sk.box(LARM, "front")
    sk.cv.vgrad(lx0, ly0 + S, lx1, ly0 + 2.6 * S, (196, 44, 54), (150, 26, 36))  # armband
    for limb in (RLEG, LLEG):
        x0, y0, x1, y1 = sk.box(limb, "front")
        sk.cv.vgrad(x0, y1 - 2.4 * S, x1, y1, (34, 34, 40), (20, 20, 24))
    sk.cv.noise(4, 22)
    sk.save("textures/entity/enemies/gunner.png")

    # ---- Dock Brute: bandana, tank top, wrapped fists, scars
    sk = enemy_base()
    skin = (176, 128, 92)
    for face in ("top", "front", "back", "left", "right", "bottom"):
        sk.face(HEAD, face, skin)
    x0, y0, x1, y1 = sk.box(HEAD, "front")
    sk.cv.vgrad(x0, y0, x1, y0 + 2.4 * S, (186, 38, 46), (140, 24, 32))  # bandana
    sk.cv.poly([(x1 - 1.6 * S, y0 + 1.2 * S), (x1 + 0.0 * S, y0 + 2.6 * S),
                (x1 - 1.2 * S, y0 + 3.0 * S)], (150, 26, 34))  # knot tail
    human_eyes(sk.cv, x0, y0, 8 * S, 8 * S, skin)
    sk.cv.line((x0 + 2 * S, y0 + 5.4 * S), (x0 + 3.4 * S, y0 + 6.6 * S), shade(skin, 0.7), S * 0.22)
    tank = (92, 94, 100)
    paint_limb(sk, BODY, tank)
    x0, y0, x1, y1 = sk.box(BODY, "front")
    sk.cv.poly([(x0, y0), (x0 + 2.2 * S, y0), (x0 + 0.8 * S, y0 + 2.6 * S)], skin)  # straps→skin
    sk.cv.poly([(x1, y0), (x1 - 2.2 * S, y0), (x1 - 0.8 * S, y0 + 2.6 * S)], skin)
    for limb in (RARM, LARM):
        paint_limb(sk, limb, skin)
        x0, y0, x1, y1 = sk.box(limb, "front")
        for wy in range(3):  # fist wraps
            yy = y1 - (3.2 - wy * 0.9) * S
            sk.cv.line((x0, yy), (x1, yy), (214, 208, 196), S * 0.35)
    pants = (58, 48, 42)
    for limb in (RLEG, LLEG):
        paint_limb(sk, limb, pants)
        x0, y0, x1, y1 = sk.box(limb, "front")
        sk.cv.vgrad(x0, y1 - 2 * S, x1, y1, (36, 30, 26), (22, 18, 16))
    sk.cv.noise(5, 33)
    sk.save("textures/entity/enemies/brute.png")

    # ---- Shadow Runner: sleek suit, neon piping, visor
    sk = enemy_base()
    suit = (42, 30, 64)
    for face in ("top", "front", "back", "left", "right", "bottom"):
        sk.face(HEAD, face, suit)
    x0, y0, x1, y1 = sk.box(HEAD, "front")
    sk.cv.rect_a(x0, y0 + 2.4 * S, x1, y0 + 4.4 * S, NEAR_BLACK)
    sk.cv.hgrad(x0 + S * 0.4, y0 + 2.9 * S, x1 - S * 0.4, y0 + 3.9 * S, shade(CYAN, 0.6), CYAN)
    for limb in (BODY, RARM, LARM, RLEG, LLEG):
        paint_limb(sk, limb, suit)
    neon = (158, 84, 226)
    for limb in (BODY, RARM, LARM, RLEG, LLEG):
        for face in ("front", "back"):
            x0, y0, x1, y1 = sk.box(limb, face)
            cx = (x0 + x1) / 2
            sk.cv.line((cx, y0), (cx, y1), neon, max(1, S * 0.28), a=220)
    x0, y0, x1, y1 = sk.box(BODY, "front")
    sk.cv.line((x0, y0 + 5 * S), (x1, y0 + 5 * S), neon, S * 0.3, a=230)
    sk.cv.glow(neon, radius=1.4)
    sk.cv.noise(2, 44)
    sk.save("textures/entity/enemies/shadow.png")

    # ---- The Enforcer: white suit, purple shirt, tie, shades
    sk = enemy_base()
    pale = (230, 228, 224)
    skin = (236, 206, 180)
    for face in ("top", "front", "back", "left", "right", "bottom"):
        sk.face(HEAD, face, skin, grad=0.2)
    x0, y0, x1, y1 = sk.box(HEAD, "front")
    sk.cv.ellipse(x0 + 2 * S, y0 + 0.6 * S, x1 - 2 * S, y0 + 2.2 * S, color=mix(skin, WHITE, 0.35))
    sk.cv.rect_a(x0 + 0.6 * S, y0 + 2.8 * S, x1 - 0.6 * S, y0 + 4.0 * S, NEAR_BLACK)
    sk.cv.line((x0 + 1.4 * S, y0 + 3.2 * S), (x0 + 3.2 * S, y0 + 3.2 * S), (140, 150, 170), S * 0.2)
    human_eyes(sk.cv, x0, y0 + 1.4 * S, 8 * S, 6 * S, skin)
    for limb in (BODY, RARM, LARM):
        paint_limb(sk, limb, pale, grad=0.22)
    x0, y0, x1, y1 = sk.box(BODY, "front")
    sk.cv.poly([(x0 + 2 * S, y0), (x1 - 2 * S, y0), (x1 - 2.6 * S, y0 + 7 * S),
                (x0 + 2.6 * S, y0 + 7 * S)], (112, 62, 152))  # shirt
    sk.cv.poly([(x0 + 3.4 * S, y0 + 0.4 * S), (x1 - 3.4 * S, y0 + 0.4 * S),
                ((x0 + x1) / 2, y0 + 2.2 * S)], NEAR_BLACK)  # tie knot
    sk.cv.line(((x0 + x1) / 2, y0 + 2.2 * S), ((x0 + x1) / 2, y0 + 6.4 * S), NEAR_BLACK, S * 0.5)
    sk.cv.poly([(x0, y0), (x0 + 2.4 * S, y0), (x0 + 1.2 * S, y0 + 6 * S)], shade(pale, 0.82))  # lapels
    sk.cv.poly([(x1, y0), (x1 - 2.4 * S, y0), (x1 - 1.2 * S, y0 + 6 * S)], shade(pale, 0.82))
    for limb in (RLEG, LLEG):
        paint_limb(sk, limb, pale, grad=0.22)
        x0, y0, x1, y1 = sk.box(limb, "front")
        sk.cv.vgrad(x0, y1 - 2 * S, x1, y1, (30, 30, 34), (16, 16, 20))
    sk.cv.noise(2, 55)
    sk.save("textures/entity/enemies/enforcer.png")

    # ---- bullet: metallic sphere + motion streak
    cv = Canvas(64, 64)
    cv.line((6, 32), (26, 32), shade(STEEL, 0.8), 3, a=90)
    cv.line((10, 26), (26, 26), shade(STEEL, 0.7), 2, a=60)
    cv.line((10, 38), (26, 38), shade(STEEL, 0.7), 2, a=60)
    cv.radial(38, 32, 15, shade(STEEL, 0.55), a0=255, a1=40)
    cv.ellipse(26, 20, 50, 44, color=STEEL)
    cv.ellipse(28, 22, 44, 38, color=mix(STEEL, WHITE, 0.35))
    cv.ellipse(30, 24, 38, 31, color=mix(STEEL, WHITE, 0.7))
    cv.ellipse(31, 25, 35, 28, color=WHITE)
    cv.ellipse(40, 36, 48, 43, color=shade(STEEL, 0.6), a=160)
    cv.noise(2, 66)
    cv.save(os.path.join(RP, "textures/entity/bullet.png"))


# ---------------------------------------------------------------- item icons 64²
def icon_outlined(cv, color=(16, 16, 20), w=1.4):
    cv.outline_alpha(color, w)


def gen_web_shooter():
    cv = Canvas(64, 64)
    # strap band
    cv.vgrad(14, 22, 50, 54, shade(STEEL, 0.75), shade(STEEL, 0.5))
    cv.rect_a(14, 22, 50, 25, shade(STEEL, 1.05))
    # body
    cv.vgrad(18, 14, 46, 46, mix(STEEL, WHITE, 0.25), shade(GUNMETAL, 0.85))
    cv.rect_a(18, 14, 46, 17, mix(STEEL, WHITE, 0.55))
    cv.line((18, 40), (46, 40), shade(CHARCOAL, 1.2), 1.6)
    # nozzle
    cv.vgrad(26, 4, 38, 15, mix(STEEL, WHITE, 0.5), STEEL)
    cv.ellipse(27, 4, 37, 9, color=shade(CHARCOAL, 0.9))
    cv.ellipse(29, 5, 35, 8, color=NEAR_BLACK)
    # red button with gloss
    cv.radial(32, 30, 7, (120, 10, 18), a0=255)
    cv.ellipse(27, 25, 37, 35, color=SPIDER_RED)
    cv.ellipse(29, 27, 33, 30, color=mix(SPIDER_RED, WHITE, 0.55))
    # vents + strand flick
    for i in range(3):
        cv.line((22 + i * 7, 43), (22 + i * 7, 50), shade(CHARCOAL, 1.3), 1.6)
    cv.line((40, 12), (50, 6), WHITE, 1.6, a=230)
    cv.line((44, 16), (54, 10), WHITE, 1.2, a=160)
    cv.radial(52, 8, 4, WHITE, a0=140)
    cv.noise(2, 101)
    icon_outlined(cv)
    cv.save(os.path.join(RP, "textures/items/web_shooter.png"))


def gen_impact_web():
    cv = Canvas(64, 64)
    cv.radial(32, 34, 26, shade(PALE, 0.5), a0=70)          # impact halo
    for a in range(0, 360, 45):                             # spikes
        r = math.radians(a)
        cv.line((32 + 20 * math.cos(r), 32 + 20 * math.sin(r)),
                (32 + 27 * math.cos(r), 32 + 27 * math.sin(r)), WHITE, 2, a=200)
    cv.ellipse(12, 12, 52, 52, color=mix(PALE, (160, 164, 176), 0.6))
    cv.ellipse(14, 14, 50, 50, color=PALE)
    cv.ellipse(18, 16, 40, 36, color=mix(PALE, WHITE, 0.6))
    web_pattern(cv, 12, 12, 52, 52, (120, 124, 136), alpha=200, rings=3, spokes=8, width=1.4)
    cv.ellipse(20, 18, 30, 26, color=WHITE, a=190)          # gloss
    cv.noise(2, 102)
    icon_outlined(cv)
    cv.save(os.path.join(RP, "textures/items/impact_web.png"))


def gen_restraint_web():
    cv = Canvas(64, 64)
    cv.rect(10, 10, 54, 54, mix(PALE, (170, 172, 182), 0.5))
    step = 7.3
    for i in range(6):                                      # woven over/under
        off = 10 + i * step
        cv.line((off, 10), (off, 54), WHITE if i % 2 == 0 else mix(PALE, WHITE, 0.4), 2.6)
        cv.line((10, off), (54, off), WHITE if i % 2 == 1 else mix(PALE, WHITE, 0.4), 2.6)
    for i in range(6):
        off = 10 + i * step
        cv.line((off - 1.4, 10), (off - 1.4, 54), shade(PALE, 0.65), 0.8, a=120)
        cv.line((10, off - 1.4), (54, off - 1.4), shade(PALE, 0.65), 0.8, a=120)
    cv.rect(8, 8, 56, 10, shade(PALE, 0.9))                 # rope border
    cv.rect(8, 54, 56, 56, shade(PALE, 0.8))
    cv.rect(8, 8, 10, 56, shade(PALE, 0.9))
    cv.rect(54, 8, 56, 56, shade(PALE, 0.8))
    for t in range(8, 56, 6):                               # rope twist
        cv.line((t, 8), (t + 2, 10), shade(PALE, 0.6), 0.8)
        cv.line((t, 54), (t + 2, 56), shade(PALE, 0.55), 0.8)
    cv.noise(2, 103)
    icon_outlined(cv)
    cv.save(os.path.join(RP, "textures/items/restraint_web.png"))


def gen_web_pull():
    cv = Canvas(64, 64)
    cv.line((10, 54), (44, 20), shade(PALE, 0.7), 1.4, a=150)   # taut line shadow
    cv.line((10, 53), (44, 19), WHITE, 2.2)
    cv.line((12, 51), (42, 21), mix(PALE, WHITE, 0.6), 1.0, a=160)
    # hook with barb
    cv.line((44, 19), (50, 25), STEEL, 3)
    cv.line((50, 25), (44, 29), STEEL, 3)
    cv.line((50, 25), (54, 21), STEEL, 2.4)
    cv.line((45, 18), (49, 14), mix(STEEL, WHITE, 0.5), 2)
    # anchor ball
    cv.ellipse(6, 49, 16, 59, color=mix(PALE, (150, 154, 166), 0.5))
    cv.ellipse(8, 50, 13, 55, color=WHITE, a=220)
    # red arrow head
    cv.poly([(46, 6), (58, 12), (50, 20), (44, 12)], SPIDER_RED)
    cv.poly([(48, 8), (55, 12), (50, 16)], mix(SPIDER_RED, WHITE, 0.4))
    cv.noise(2, 104)
    icon_outlined(cv)
    cv.save(os.path.join(RP, "textures/items/web_pull.png"))


def gen_tech_pulse():
    cv = Canvas(64, 64)
    for r, a in ((26, 60), (20, 100), (14, 150)):               # emission arcs
        cv.ellipse(32 - r, 30 - r, 32 + r, 30 + r, outline=CYAN, ow=2.2, a=a)
    cv.vgrad(20, 26, 44, 56, shade(GUNMETAL, 1.15), shade(GUNMETAL, 0.7))  # emitter
    cv.rect_a(20, 26, 44, 29, mix(GUNMETAL, WHITE, 0.35))
    cv.line((20, 48), (44, 48), shade(CHARCOAL, 1.2), 1.6)
    cv.ellipse(26, 18, 38, 30, color=shade(CYAN, 0.5))
    cv.radial(32, 24, 8, CYAN, a0=255)
    cv.ellipse(29, 21, 35, 27, color=mix(CYAN, WHITE, 0.7))
    for i in range(3):
        cv.line((24 + i * 6, 50), (24 + i * 6, 54), shade(CHARCOAL, 1.3), 1.4)
    cv.glow(CYAN, radius=2.2)
    cv.noise(2, 105)
    icon_outlined(cv)
    cv.save(os.path.join(RP, "textures/items/tech_pulse.png"))


def gen_threat_scanner():
    cv = Canvas(64, 64)
    cv.ellipse(6, 6, 58, 58, color=shade(GUNMETAL, 0.8))        # bezel
    cv.ellipse(8, 8, 56, 56, color=shade(GUNMETAL, 1.1))
    cv.ellipse(11, 11, 53, 53, color=(16, 34, 40))             # screen
    cv.radial(32, 32, 20, (24, 70, 80), a0=200)
    for r in (7, 13, 19):
        cv.ellipse(32 - r, 32 - r, 32 + r, 32 + r, outline=(60, 190, 220), ow=1.2, a=150)
    for a in range(0, 360, 30):                                # sweep trail
        r = math.radians(a)
        al = int(60 + 140 * (a / 360))
        cv.line((32, 32), (32 + 19 * math.cos(r), 32 + 19 * math.sin(r)),
                (120, 240, 255), 1.4, a=al if a > 300 else 40)
    cv.line((32, 32), (46, 18), (190, 250, 255), 2)
    for (bx, by) in ((22, 24), (40, 38), (36, 20)):            # blips + glow
        cv.radial(bx, by, 4, (255, 90, 90), a0=160)
        cv.ellipse(bx - 1.6, by - 1.6, bx + 1.6, by + 1.6, color=(255, 96, 96))
    cv.ellipse(14, 12, 30, 22, color=WHITE, a=40)              # glass gloss
    cv.noise(2, 106)
    icon_outlined(cv)
    cv.save(os.path.join(RP, "textures/items/threat_scanner.png"))


def gen_spider_manual():
    cv = Canvas(64, 64)
    cv.vgrad(10, 6, 50, 58, (196, 34, 46), (128, 16, 26))      # cover
    cv.vgrad(10, 6, 15, 58, (120, 14, 22), (96, 10, 18))       # spine
    for i in range(3):
        cv.line((11.5, 12 + i * 16), (13.5, 12 + i * 16), GOLD, 1.2)
    cv.rect_a(48, 8, 54, 56, (236, 232, 218))                  # pages
    for i in range(6):
        cv.line((49 + i * 0.8, 9), (49 + i * 0.8, 55), shade((236, 232, 218), 0.8), 0.6)
    cv.rect_a(40, 6, 44, 16, GOLD)                             # bookmark
    cv.poly([(40, 16), (42, 13), (44, 16)], (128, 16, 26))
    spider_emblem(cv, 30, 32, 9, NEAR_BLACK)
    cv.ellipse(16, 10, 34, 20, color=WHITE, a=36)              # sheen
    cv.noise(2, 107)
    icon_outlined(cv)
    cv.save(os.path.join(RP, "textures/items/spider_manual.png"))


def gen_suit_icon(path, primary, secondary, emblem, lens=None, plate=1.0):
    cv = Canvas(64, 64)
    # shoulders
    for ox in (8, 44):
        cv.vgrad(ox, 12, ox + 12, 30, shade(secondary, 1.15), shade(secondary, 0.8))
    # torso plate
    cv.vgrad(16, 8, 48, 56, shade(primary, 1.18), shade(primary, 0.78))
    cv.poly([(16, 8), (24, 8), (20, 16)], shade(primary, 0.7))   # neckline
    cv.poly([(48, 8), (40, 8), (44, 16)], shade(primary, 0.7))
    cv.vgrad(16, 46, 48, 56, shade(secondary, 1.05), shade(secondary, 0.75))  # waist
    cv.line((16, 46), (48, 46), shade(primary, 0.55), 1.4)
    cv.line((18, 10), (18, 54), shade(primary, 1.3), 1.0, a=120)  # edge light
    spider_emblem(cv, 32, 30, 7 * plate, emblem)
    if lens:
        cv.ellipse(24, 12, 28, 15, color=lens)
        cv.ellipse(36, 12, 40, 15, color=lens)
    cv.ellipse(20, 10, 36, 20, color=WHITE, a=40)               # gloss
    cv.noise(2, hash(path) % 500)
    icon_outlined(cv)
    cv.save(os.path.join(RP, path))


def gen_eggs():
    os.makedirs(os.path.join(RP, "textures/items/eggs"), exist_ok=True)
    eggs = {
        "egg_thug": ((64, 86, 58), (205, 160, 120)),
        "egg_gunner": ((66, 68, 78), (196, 44, 54)),
        "egg_brute": ((186, 38, 46), (176, 128, 92)),
        "egg_shadow": ((42, 30, 64), (158, 84, 226)),
        "egg_enforcer": ((230, 228, 224), (112, 62, 152)),
    }
    for name, (base, spot) in eggs.items():
        cv = Canvas(64, 64)
        # egg silhouette: union of two ellipses via mask
        mask = Image.new("L", (64 * SS, 64 * SS), 0)
        md = ImageDraw.Draw(mask)
        md.ellipse([20 * SS, 4 * SS, 44 * SS, 34 * SS], fill=255)
        md.ellipse([16 * SS, 16 * SS, 48 * SS, 48 * SS], fill=255)
        md.ellipse([14 * SS, 28 * SS, 50 * SS, 58 * SS], fill=255)
        grad = Image.new("RGBA", (64 * SS, 64 * SS), (0, 0, 0, 0))
        gd = ImageDraw.Draw(grad)
        for y in range(4 * SS, 59 * SS):
            t = (y / SS - 4) / 54
            c = mix(mix(base, WHITE, 0.35 * (1 - t)), shade(base, 0.6), t)
            gd.line([0, y, 64 * SS, y], fill=rgba(c))
        grad.putalpha(mask)
        cv.img = grad
        cv.d = ImageDraw.Draw(cv.img)
        rng = random.Random(hash(name) % 9999)
        for i in range(8):                                      # spread speckles
            ang = i * 0.9 + rng.uniform(-0.25, 0.25)
            bx = 32 + math.cos(ang) * rng.uniform(6, 13)
            by = 32 + math.sin(ang) * rng.uniform(9, 17)
            r = rng.uniform(2.0, 4.0)
            cv.ellipse(bx - r, by - r, bx + r, by + r, color=shade(spot, 0.9), a=235)
            cv.ellipse(bx - r * 0.5, by - r * 0.6, bx + r * 0.4, by - r * 0.1,
                       color=mix(spot, WHITE, 0.4), a=200)
        cv.ellipse(22, 10, 34, 20, color=WHITE, a=110)          # highlight
        cv.ellipse(20, 44, 46, 58, color=shade(base, 0.5), a=90)  # bottom shade
        cv.noise(3, hash(name) % 777)
        cv.outline_alpha(shade(base, 0.45), 1.2)
        cv.save(os.path.join(RP, f"textures/items/eggs/{name}.png"))


# ---------------------------------------------------------------- blocks 64²
def gen_station_top():
    cv = Canvas(64, 64)
    cv.rect(0, 0, 63, 63, (54, 57, 66))
    rng = random.Random(7)
    for _ in range(90):                                          # brushed streaks
        y = rng.uniform(0, 63)
        cv.line((0, y), (63, y), shade((54, 57, 66), rng.uniform(0.85, 1.25)), 0.7, a=70)
    cv.rect(2, 2, 61, 61, (64, 68, 78))
    cv.rect(4, 4, 59, 59, (58, 61, 70))
    for (bx, by) in ((6, 6), (57, 6), (6, 57), (57, 57)):         # bolts
        cv.ellipse(bx - 2.6, by - 2.6, bx + 2.6, by + 2.6, color=shade(STEEL, 0.9))
        cv.ellipse(bx - 1.8, by - 2.2, bx + 1.2, by - 0.4, color=mix(STEEL, WHITE, 0.5))
        cv.line((bx - 1.6, by), (bx + 1.6, by), shade(CHARCOAL, 0.8), 1)
    cv.ellipse(14, 14, 50, 50, outline=(198, 32, 44), ow=2.6)     # red ring + glow
    cv.ellipse(16, 16, 48, 48, outline=(150, 20, 30), ow=1.2)
    cv.radial(32, 32, 15, (120, 16, 26), a0=70)
    cv.ellipse(18, 18, 46, 46, color=(34, 35, 42))
    cv.ellipse(20, 20, 44, 42, color=(40, 41, 48))
    spider_emblem(cv, 32, 33, 8, (222, 48, 58), glow_color=(222, 48, 58))
    cv.noise(3, 201)
    cv.save(os.path.join(RP, "textures/blocks/station_top.png"))


def gen_station_side():
    cv = Canvas(64, 64)
    cv.vgrad(0, 0, 63, 63, (60, 63, 72), (44, 46, 54))
    rng = random.Random(9)
    for _ in range(70):
        y = rng.uniform(0, 63)
        cv.line((0, y), (63, y), shade((56, 59, 68), rng.uniform(0.8, 1.2)), 0.7, a=60)
    for x in (0, 63):                                             # frame edges
        cv.rect(x, 0, x, 63, shade((56, 59, 68), 0.7))
    cv.line((0, 12), (63, 12), shade(CHARCOAL, 1.1), 1.4)         # seams
    cv.line((0, 13.4), (63, 13.4), shade((56, 59, 68), 1.3), 0.8)
    cv.vgrad(0, 48, 63, 54, (176, 32, 42), (120, 18, 26))         # red stripe
    cv.line((0, 48), (63, 48), mix(SPIDER_RED, WHITE, 0.4), 1)
    for t in range(4, 63, 10):                                    # hazard ticks
        cv.line((t, 54), (t + 4, 48), shade(SPIDER_RED, 0.6), 1.2, a=160)
    cv.rect(8, 18, 34, 40, (18, 24, 28))                          # screen bezel
    cv.vgrad(10, 20, 32, 38, (26, 74, 88), (16, 48, 58))          # screen
    for y in range(21, 38, 2):                                    # scanlines
        cv.line((10, y), (32, y), shade(CYAN, 0.5), 0.6, a=70)
    cv.line((12, 30), (18, 24), CYAN, 1.4)                        # waveform
    cv.line((18, 24), (22, 32), CYAN, 1.4)
    cv.line((22, 32), (28, 26), CYAN, 1.4)
    cv.radial(21, 29, 10, CYAN, a0=60)
    cv.rect(40, 18, 56, 40, shade((56, 59, 68), 1.2))             # side column
    for y in range(21, 39, 4):
        cv.line((42, y), (54, y), shade(CHARCOAL, 0.9), 1.6)      # vents
        cv.line((42, y + 1.6), (54, y + 1.6), shade((56, 59, 68), 1.35), 0.8)
    cv.radial(48, 15, 4, (255, 90, 90), a0=200)                   # status LED
    cv.ellipse(46.6, 13.6, 49.4, 16.4, color=(255, 110, 110))
    cv.noise(3, 202)
    cv.save(os.path.join(RP, "textures/blocks/station_side.png"))


# ---------------------------------------------------------------- particles
def gen_particles():
    cv = Canvas(32, 32, ss=2)
    cv.radial(16, 16, 14, WHITE, a0=255, a1=0)
    cv.save(os.path.join(RP, "textures/particle/web_dot.png"))

    cv = Canvas(32, 32, ss=2)
    cv.radial(16, 16, 10, WHITE, a0=120)
    for a in (0, 90):
        r = math.radians(a)
        cv.line((16 - 14 * math.cos(r), 16 - 14 * math.sin(r)),
                (16 + 14 * math.cos(r), 16 + 14 * math.sin(r)), WHITE, 2.4, a=230)
    for a in (45, 135):
        r = math.radians(a)
        cv.line((16 - 9 * math.cos(r), 16 - 9 * math.sin(r)),
                (16 + 9 * math.cos(r), 16 + 9 * math.sin(r)), WHITE, 1.6, a=180)
    cv.radial(16, 16, 4, WHITE, a0=255)
    cv.save(os.path.join(RP, "textures/particle/spark.png"))

    cv = Canvas(32, 32, ss=2)
    cv.poly([(16, 2), (30, 16), (16, 30), (2, 16)], (214, 42, 52), a=235)
    cv.poly([(16, 7), (25, 16), (16, 25), (7, 16)], (236, 90, 96), a=235)
    cv.poly([(16, 11), (21, 16), (16, 21), (11, 16)], mix((236, 90, 96), WHITE, 0.6))
    cv.glow((255, 90, 90), radius=1.6)
    cv.save(os.path.join(RP, "textures/particle/ping.png"))

    cv = Canvas(64, 64, ss=2)
    cv.ellipse(6, 6, 58, 58, outline=CYAN, ow=4, a=210)
    cv.ellipse(10, 10, 54, 54, outline=mix(CYAN, WHITE, 0.5), ow=1.6, a=140)
    cv.ellipse(2, 2, 62, 62, outline=shade(CYAN, 0.7), ow=1.4, a=90)
    cv.glow(CYAN, radius=2.4)
    cv.save(os.path.join(RP, "textures/particle/ring.png"))


# ---------------------------------------------------------------- pack icons 512²
def pack_icon(path, c_top, c_bottom, accent):
    W = 512
    cv = Canvas(W, W, ss=1)
    cv.vgrad(0, 0, W - 1, W - 1, c_top, c_bottom)
    cv.radial(W / 2, W / 2, W * 0.72, shade(c_bottom, 0.55), a0=150)   # vignette
    cx, cy = W / 2, W / 2
    dark = (12, 12, 16, )
    # radial web with sagging rings
    spokes = 16
    ends = []
    for i in range(spokes):
        a = math.radians(i * 360 / spokes)
        ex, ey = cx + W * 0.75 * math.cos(a), cy + W * 0.75 * math.sin(a)
        ends.append((ex, ey))
        cv.line((cx, cy), (ex, ey), dark, 3, a=150)
    for k in range(1, 8):
        rr = W * 0.09 * k ** 1.18
        pts = [(cx + rr * math.cos(math.radians(i * 360 / spokes)),
                cy + rr * math.sin(math.radians(i * 360 / spokes))) for i in range(spokes)]
        for i in range(spokes):
            p, q = pts[i], pts[(i + 1) % spokes]
            mid = (((p[0] + q[0]) / 2 - cx) * 0.9 + cx, ((p[1] + q[1]) / 2 - cy) * 0.9 + cy)
            cv.line(p, mid, dark, 2.4, a=140)
            cv.line(mid, q, dark, 2.4, a=140)
    cv.radial(cx, cy, W * 0.3, accent, a0=90)                          # hero glow
    spider_emblem(cv, cx, cy + 24, W * 0.16, (10, 10, 14))
    cv.rect(0, 0, W - 1, 3, mix(c_top, WHITE, 0.5))
    cv.rect(0, W - 4, W - 1, W - 1, shade(c_bottom, 0.6))
    cv.rect(0, 0, 3, W - 1, mix(c_top, WHITE, 0.35))
    cv.rect(W - 4, 0, W - 1, W - 1, shade(c_bottom, 0.7))
    cv.noise(2, 303)
    cv.save(path)


def main():
    generate_suits()
    generate_enemies()
    gen_web_shooter()
    gen_impact_web()
    gen_restraint_web()
    gen_web_pull()
    gen_tech_pulse()
    gen_threat_scanner()
    gen_spider_manual()
    gen_suit_icon("textures/items/suit_classic.png", SPIDER_RED, DEEP_BLUE, NEAR_BLACK, WHITE)
    gen_suit_icon("textures/items/suit_improvised.png", (142, 142, 148), (96, 96, 104), (196, 40, 52), WHITE)
    gen_suit_icon("textures/items/suit_stealth.png", (26, 26, 32), (15, 15, 20), WHITE)
    gen_suit_icon("textures/items/suit_advanced.png", (238, 238, 244), (204, 208, 220), (196, 26, 38))
    gen_suit_icon("textures/items/suit_urban.png", (24, 24, 30), (12, 12, 16), (208, 32, 48))
    gen_suit_icon("textures/items/suit_iron.png", GUNMETAL, shade(GUNMETAL, 0.72), GOLD, CYAN)
    gen_eggs()
    gen_station_top()
    gen_station_side()
    gen_particles()
    pack_icon(os.path.join(BP, "pack_icon.png"), (206, 30, 42), (92, 12, 22), (255, 80, 80))
    pack_icon(os.path.join(RP, "pack_icon.png"), (40, 62, 176), (16, 26, 88), (120, 160, 255))
    print("All HD textures generated (4x pass).")


if __name__ == "__main__":
    main()
