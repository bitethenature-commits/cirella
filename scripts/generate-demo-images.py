"""
Genera las imágenes de la demo de forma procedural (sin fotos de terceros).
Uso:  python3 scripts/generate-demo-images.py
Salida: public/demo/*.webp
"""
import math
import os
import random

import numpy as np
from PIL import Image, ImageDraw, ImageFilter

OUT = os.path.join(os.path.dirname(__file__), "..", "public", "demo")
os.makedirs(OUT, exist_ok=True)


def fbm(w, h, seed, octaves=6, base=4, persistence=0.55):
    rng = np.random.default_rng(seed)
    acc = np.zeros((h, w), np.float32)
    amp, total = 1.0, 0.0
    for o in range(octaves):
        s = base * (2 ** o)
        small = rng.random((max(2, int(s * h / w)) + 1, s + 1)).astype(np.float32)
        img = Image.fromarray((small * 255).astype(np.uint8)).resize((w, h), Image.BICUBIC)
        acc += amp * (np.asarray(img, np.float32) / 255.0)
        total += amp
        amp *= persistence
    acc /= total
    acc = (acc - acc.min()) / (acc.max() - acc.min() + 1e-6)
    return acc


def lerp_palette(t, stops):
    """t: array 0..1 ; stops: list of (pos, (r,g,b))"""
    out = np.zeros(t.shape + (3,), np.float32)
    for i in range(len(stops) - 1):
        p0, c0 = stops[i]
        p1, c1 = stops[i + 1]
        mask = (t >= p0) & (t <= p1)
        k = ((t - p0) / (p1 - p0 + 1e-6))[..., None]
        seg = np.array(c0, np.float32) * (1 - k) + np.array(c1, np.float32) * k
        out = np.where(mask[..., None], seg, out)
    return out


def stars(w, h, seed, density=0.0009, glow=True, tint=(255, 248, 235)):
    rng = np.random.default_rng(seed)
    layer = np.zeros((h, w), np.float32)
    n = int(w * h * density)
    xs = rng.integers(0, w, n)
    ys = rng.integers(0, h, n)
    b = rng.pareto(2.2, n) * 0.25 + 0.15
    b = np.clip(b, 0, 3.0)
    layer[ys, xs] = b
    out = layer.copy()
    if glow:
        img = Image.fromarray(np.clip(layer * 255, 0, 255).astype(np.uint8))
        g1 = np.asarray(img.filter(ImageFilter.GaussianBlur(1.2)), np.float32) / 255 * 2.2
        g2 = np.asarray(img.filter(ImageFilter.GaussianBlur(4)), np.float32) / 255 * 3.5
        out = np.clip(layer, 0, 1) + g1 + g2
    rgb = out[..., None] * (np.array(tint, np.float32) / 255.0)
    return rgb


def vignette(w, h, strength=0.55):
    y, x = np.mgrid[0:h, 0:w].astype(np.float32)
    cx, cy = w / 2, h / 2
    d = np.sqrt(((x - cx) / cx) ** 2 + ((y - cy) / cy) ** 2) / math.sqrt(2)
    return (1 - strength * d ** 1.8)[..., None]


def grain(w, h, seed, amount=0.025):
    rng = np.random.default_rng(seed)
    return (rng.standard_normal((h, w, 1)).astype(np.float32)) * amount


def save(arr, name, q=82):
    img = Image.fromarray(np.clip(arr * 255, 0, 255).astype(np.uint8))
    img.save(os.path.join(OUT, name), "WEBP", quality=q, method=6)
    print("✓", name, img.size)


def nebula(w, h, seed, stops, star_density=0.0008, swirl=0.0):
    n1 = fbm(w, h, seed, octaves=7, base=3)
    n2 = fbm(w, h, seed + 1, octaves=6, base=5)
    n3 = fbm(w, h, seed + 2, octaves=5, base=2)
    t = np.clip(n1 * 0.65 + n2 * 0.35, 0, 1)
    t = np.clip((t - 0.3) * 1.6, 0, 1) ** 1.3
    col = lerp_palette(t, stops)
    dust = np.clip((n3 - 0.45) * 2.5, 0, 1)[..., None]
    col = col * (1 - 0.55 * dust)
    col += stars(w, h, seed + 9, star_density)
    col *= vignette(w, h, 0.5)
    col += grain(w, h, seed, 0.018)
    return np.clip(col, 0, 1)


NIGHT = [
    (0.0, (0.02, 0.025, 0.07)),
    (0.35, (0.06, 0.07, 0.19)),
    (0.6, (0.22, 0.17, 0.42)),
    (0.8, (0.55, 0.42, 0.7)),
    (0.93, (0.92, 0.78, 0.66)),
    (1.0, (1.0, 0.95, 0.85)),
]
VIOLET = [
    (0.0, (0.02, 0.01, 0.05)),
    (0.4, (0.1, 0.04, 0.2)),
    (0.65, (0.38, 0.15, 0.48)),
    (0.85, (0.8, 0.45, 0.62)),
    (1.0, (1.0, 0.86, 0.78)),
]
TEAL = [
    (0.0, (0.01, 0.02, 0.05)),
    (0.4, (0.03, 0.08, 0.16)),
    (0.65, (0.1, 0.28, 0.42)),
    (0.85, (0.45, 0.62, 0.78)),
    (1.0, (0.95, 0.92, 0.85)),
]


def moon_image(w, h, seed=7, phase=0.62):
    sky = nebula(w, h, seed, NIGHT, star_density=0.0005) * 0.55
    r = int(min(w, h) * 0.33)
    cx, cy = int(w * 0.5), int(h * 0.5)
    y, x = np.mgrid[0:h, 0:w].astype(np.float32)
    nx, ny = (x - cx) / r, (y - cy) / r
    d2 = nx ** 2 + ny ** 2
    inside = d2 <= 1
    nz = np.sqrt(np.clip(1 - d2, 0, 1))
    # dirección de la luz (fase)
    ang = math.pi * (1 - phase)
    L = np.array([math.sin(ang) * 1.0, -0.15, math.cos(ang)])
    L = L / np.linalg.norm(L)
    lam = np.clip(nx * L[0] + ny * L[1] + nz * L[2], 0, 1)
    # albedo: mares + cráteres
    maria = fbm(w, h, seed + 3, octaves=5, base=3)
    albedo = 0.78 - 0.32 * np.clip((maria - 0.45) * 2.2, 0, 1)
    fine = fbm(w, h, seed + 4, octaves=7, base=18)
    albedo *= 0.88 + 0.22 * fine
    rng = random.Random(seed)
    crater = np.zeros((h, w), np.float32)
    for _ in range(140):
        a = rng.random() * 2 * math.pi
        rr = math.sqrt(rng.random()) * 0.95
        px, py = cx + math.cos(a) * rr * r, cy + math.sin(a) * rr * r
        cr = rng.random() ** 2.5 * r * 0.14 + 2
        dd = np.sqrt((x - px) ** 2 + (y - py) ** 2) / cr
        crater += np.where(dd < 1, -0.10 * (1 - dd), 0) + np.where((dd >= 1) & (dd < 1.25), 0.10 * (1.25 - dd) * 4, 0) * 0.5
    albedo = np.clip(albedo + crater, 0.1, 1)
    shade = lam ** 0.75 * albedo
    earthshine = 0.035 * albedo
    lum = np.where(inside, np.maximum(shade, earthshine), 0)
    moon = lum[..., None] * np.array([1.0, 0.97, 0.9], np.float32)
    # halo
    halo = np.clip(1 - (np.sqrt(d2) - 1) / 0.9, 0, 1) ** 3 * 0.18
    halo = np.where(inside, 0, halo)[..., None] * np.array([0.75, 0.72, 0.95])
    edge = np.clip((1.0 - np.sqrt(d2)) * r / 1.5, 0, 1)[..., None]
    out = sky * (1 - edge) + moon * edge + halo
    out += grain(w, h, seed, 0.012)
    return np.clip(out, 0, 1)


def eclipse_image(w, h, seed=21):
    sky = nebula(w, h, seed, TEAL, star_density=0.0006) * 0.45
    r = int(min(w, h) * 0.22)
    cx, cy = int(w * 0.5), int(h * 0.48)
    y, x = np.mgrid[0:h, 0:w].astype(np.float32)
    dx, dy = x - cx, y - cy
    d = np.sqrt(dx ** 2 + dy ** 2) / r
    theta = np.arctan2(dy, dx)
    rng = np.random.default_rng(seed)
    harmonics = np.zeros_like(theta)
    for k in range(3, 40, 2):
        harmonics += rng.random() * np.cos(k * theta + rng.random() * 6.28) / k ** 0.6
    harmonics = (harmonics - harmonics.min()) / (harmonics.max() - harmonics.min())
    corona = np.clip(1 - (d - 1) / (1.6 + 1.6 * harmonics), 0, 1) ** 2.6
    corona = np.where(d < 1, 0, corona)
    inner = np.clip(1 - (d - 1) / 0.12, 0, 1) ** 1.5
    inner = np.where(d < 1, 0, inner)
    col = corona[..., None] * np.array([0.95, 0.88, 0.78]) * 0.95 + inner[..., None] * np.array([1.0, 0.98, 0.92])
    # anillo de diamante
    bx, by = cx + r * math.cos(-0.7), cy + r * math.sin(-0.7)
    bd = np.sqrt((x - bx) ** 2 + (y - by) ** 2)
    col += (np.exp(-bd / 6) * 1.6 + np.exp(-bd / 40) * 0.35)[..., None] * np.array([1.0, 0.95, 0.85])
    out = np.where((d < 1)[..., None], np.array([0.008, 0.01, 0.02]), sky + col)
    out += grain(w, h, seed, 0.012)
    return np.clip(out * vignette(w, h, 0.35), 0, 1)


def draw_overlay(w, h, draw_fn, scale=3, blur_glow=6, color=(232, 205, 150)):
    big = Image.new("L", (w * scale, h * scale), 0)
    dr = ImageDraw.Draw(big)
    draw_fn(dr, scale)
    mask = big.resize((w, h), Image.LANCZOS)
    m = np.asarray(mask, np.float32) / 255
    glow = np.asarray(mask.filter(ImageFilter.GaussianBlur(blur_glow)), np.float32) / 255
    c = np.array(color, np.float32) / 255
    return m, glow, c


def bodygraph_image(w, h, seed=33):
    base = nebula(w, h, seed, VIOLET, star_density=0.0007) * 0.8
    cx = w / 2
    top = h * 0.1
    S = h * 0.8

    def P(px, py):
        return (cx + px * S, top + py * S)

    centers = {
        "head": ("tri_up", P(0, 0.05), 0.055),
        "ajna": ("tri_down", P(0, 0.17), 0.055),
        "throat": ("sq", P(0, 0.32), 0.05),
        "g": ("dia", P(0, 0.48), 0.065),
        "heart": ("tri_side", P(0.12, 0.55), 0.035),
        "sacral": ("sq", P(0, 0.72), 0.055),
        "spleen": ("tri_r", P(-0.26, 0.72), 0.06),
        "solar": ("tri_l", P(0.26, 0.72), 0.06),
        "root": ("sq", P(0, 0.9), 0.055),
    }
    links = [("head", "ajna"), ("ajna", "throat"), ("throat", "g"), ("g", "sacral"), ("sacral", "root"),
             ("throat", "spleen"), ("throat", "solar"), ("spleen", "root"), ("solar", "root"), ("g", "heart"),
             ("heart", "solar"), ("spleen", "sacral"), ("sacral", "solar"), ("heart", "throat"), ("spleen", "g")]

    def fn(dr, s):
        lw = max(2, int(1.6 * s))
        for a, b in links:
            (_, pa, _), (_, pb, _) = centers[a], centers[b]
            dr.line([(pa[0] * s, pa[1] * s), (pb[0] * s, pb[1] * s)], fill=150, width=lw)
        for kind, (px, py), size in centers.values():
            r = size * S * s
            X, Y = px * s, py * s
            if kind == "tri_up":
                pts = [(X, Y - r), (X - r, Y + r * 0.8), (X + r, Y + r * 0.8)]
            elif kind == "tri_down":
                pts = [(X - r, Y - r * 0.8), (X + r, Y - r * 0.8), (X, Y + r)]
            elif kind == "sq":
                pts = [(X - r, Y - r), (X + r, Y - r), (X + r, Y + r), (X - r, Y + r)]
            elif kind == "dia":
                pts = [(X, Y - r * 1.2), (X + r * 1.2, Y), (X, Y + r * 1.2), (X - r * 1.2, Y)]
            elif kind == "tri_r":
                pts = [(X - r, Y - r), (X + r, Y), (X - r, Y + r)]
            elif kind == "tri_l":
                pts = [(X + r, Y - r), (X - r, Y), (X + r, Y + r)]
            else:
                pts = [(X - r, Y + r), (X + r, Y - r * 0.2), (X - r * 0.2, Y - r)]
            dr.polygon(pts, fill=40, outline=255, width=lw + 1)

    m, glow, c = draw_overlay(w, h, fn)
    out = base * (1 - m[..., None] * 0.5) + m[..., None] * c + glow[..., None] * c * 0.9
    return np.clip(out, 0, 1)


def hexagram_image(w, h, seed=44, lines=(1, 0, 1, 1, 0, 1)):
    base = nebula(w, h, seed, [
        (0.0, (0.03, 0.02, 0.06)), (0.4, (0.12, 0.06, 0.2)), (0.7, (0.42, 0.24, 0.42)),
        (0.88, (0.85, 0.62, 0.5)), (1.0, (1.0, 0.9, 0.75))], star_density=0.0007) * 0.75
    bw, bh, gap = w * 0.36, h * 0.045, h * 0.04

    def fn(dr, s):
        total = 6 * bh + 5 * gap
        y0 = (h - total) / 2
        for i, solid in enumerate(lines):
            y = y0 + i * (bh + gap)
            x0 = (w - bw) / 2
            if solid:
                dr.rounded_rectangle([x0 * s, y * s, (x0 + bw) * s, (y + bh) * s], radius=int(bh * s / 2), fill=255)
            else:
                seg = bw * 0.42
                dr.rounded_rectangle([x0 * s, y * s, (x0 + seg) * s, (y + bh) * s], radius=int(bh * s / 2), fill=255)
                dr.rounded_rectangle([(x0 + bw - seg) * s, y * s, (x0 + bw) * s, (y + bh) * s], radius=int(bh * s / 2), fill=255)

    m, glow, c = draw_overlay(w, h, fn, blur_glow=14)
    shimmer = fbm(w, h, seed + 7, octaves=4, base=6)[..., None]
    gold = c * (0.8 + 0.35 * shimmer)
    out = base * (1 - m[..., None]) + m[..., None] * gold + glow[..., None] * c * 0.8
    return np.clip(out, 0, 1)


def galaxy_image(w, h, seed=55):
    y, x = np.mgrid[0:h, 0:w].astype(np.float32)
    # banda diagonal
    nxy = (x / w - 0.5) * 0.8 + (y / h - 0.5) * -0.6
    band = np.exp(-(nxy / 0.16) ** 2)
    n = fbm(w, h, seed, octaves=7, base=4)
    dust = fbm(w, h, seed + 1, octaves=6, base=8)
    t = np.clip(band * (0.55 + 0.6 * n) - 0.35 * band * np.clip((dust - 0.5) * 3, 0, 1), 0, 1)
    col = lerp_palette(t, [
        (0.0, (0.015, 0.02, 0.05)), (0.3, (0.06, 0.07, 0.17)), (0.6, (0.38, 0.3, 0.45)),
        (0.85, (0.88, 0.76, 0.66)), (1.0, (1.0, 0.96, 0.9))])
    rng_density = 0.0016
    col += stars(w, h, seed + 3, rng_density)
    col += stars(w, h, seed + 4, 0.004, glow=False) * band[..., None] * 0.9
    col *= vignette(w, h, 0.45)
    col += grain(w, h, seed, 0.016)
    return np.clip(col, 0, 1)


def twilight_image(w, h, seed=66):
    y, x = np.mgrid[0:h, 0:w].astype(np.float32)
    t = y / h
    sky = lerp_palette(t, [
        (0.0, (0.03, 0.04, 0.12)), (0.45, (0.12, 0.13, 0.3)), (0.7, (0.42, 0.3, 0.45)),
        (0.85, (0.88, 0.58, 0.45)), (1.0, (0.98, 0.8, 0.55))])
    sky += stars(w, h, seed, 0.0006) * np.clip(1 - t * 1.6, 0, 1)[..., None]
    # luna creciente
    cx, cy, r = w * 0.62, h * 0.3, h * 0.07
    d1 = np.sqrt((x - cx) ** 2 + (y - cy) ** 2) / r
    d2 = np.sqrt((x - cx - r * 0.38) ** 2 + (y - cy + r * 0.12) ** 2) / r
    crescent = np.clip((1 - d1) * r / 1.2, 0, 1) * np.clip((d2 - 1) * r / 1.2, 0, 1)
    glow = np.exp(-np.clip(d1 - 1, 0, None) * 2.2) * 0.25 * (d1 > 1)
    sky += crescent[..., None] * np.array([1.0, 0.95, 0.82]) + glow[..., None] * np.array([0.8, 0.7, 0.6])
    # Venus
    vx, vy = w * 0.47, h * 0.42
    vd = np.sqrt((x - vx) ** 2 + (y - vy) ** 2)
    sky += (np.exp(-vd / 2.5) * 1.6 + np.exp(-vd / 14) * 0.3)[..., None] * np.array([1.0, 0.97, 0.9])
    # horizonte (colinas)
    n = fbm(w, 4, seed + 5, octaves=5, base=3)[0]
    hill = h * (0.8 + 0.08 * (n - 0.5)) + 0.05 * h * np.sin(np.linspace(0, 3.2, w))
    mask = (y > hill[None, :]).astype(np.float32)
    mask = np.asarray(Image.fromarray((mask * 255).astype(np.uint8)).filter(ImageFilter.GaussianBlur(1.2)), np.float32) / 255
    out = sky * (1 - mask[..., None]) + np.array([0.025, 0.025, 0.06]) * mask[..., None]
    out += grain(w, h, seed, 0.014)
    return np.clip(out, 0, 1)


def soft_light_image(w, h, seed, palette, shape="arch"):
    """Imágenes claras para la creadora wellness (María): fondo arena + forma orgánica."""
    y, x = np.mgrid[0:h, 0:w].astype(np.float32)
    rng = random.Random(seed)
    base = np.ones((h, w, 3), np.float32) * np.array(palette[0])
    for i in range(3):
        cx, cy = rng.uniform(0.1, 0.9) * w, rng.uniform(0.1, 0.9) * h
        rr = rng.uniform(0.35, 0.6) * min(w, h)
        d = np.sqrt((x - cx) ** 2 + (y - cy) ** 2) / rr
        a = np.clip(1 - d, 0, 1) ** 1.3 * 0.55
        c = np.array(palette[1 + i % (len(palette) - 1)])
        base = base * (1 - a[..., None]) + c * a[..., None]
    col = np.array(palette[-1], np.float32)
    if shape == "arch":
        cx, r = w * 0.5, min(w, h) * 0.3
        top = h * 0.32
        inside = (((x - cx) ** 2 + (y - (top + r)) ** 2 <= r ** 2) & (y <= top + r)) | ((np.abs(x - cx) <= r) & (y >= top + r) & (y <= h * 0.88))
        m = inside.astype(np.float32)
    elif shape == "sun":
        cx, cy, r = w * 0.5, h * 0.62, min(w, h) * 0.26
        m = (((x - cx) ** 2 + (y - cy) ** 2 <= r ** 2) & (y <= h * 0.62)).astype(np.float32)
        for k in range(3):
            yy = h * (0.68 + k * 0.07)
            m = np.maximum(m, ((np.abs(y - yy) < h * 0.012) & (np.abs(x - cx) < r * (1.1 - k * 0.18))).astype(np.float32))
    elif shape == "circle":
        cx, cy, r = w * 0.56, h * 0.46, min(w, h) * 0.27
        m = (((x - cx) ** 2 + (y - cy) ** 2) <= r ** 2).astype(np.float32)
    else:  # waves
        m = np.zeros((h, w), np.float32)
        for k in range(4):
            yy = h * (0.42 + k * 0.1) + np.sin(x / w * 6.28 * 1.2 + k) * h * 0.035
            m = np.maximum(m, (np.abs(y - yy) < h * 0.016).astype(np.float32))
    m = np.asarray(Image.fromarray((m * 255).astype(np.uint8)).filter(ImageFilter.GaussianBlur(1.5)), np.float32) / 255
    base = base * (1 - 0.92 * m[..., None]) + col * 0.92 * m[..., None]
    n = fbm(w, h, seed, octaves=5, base=3)[..., None]
    base *= 0.95 + 0.07 * n
    base += grain(w, h, seed, 0.022)
    return np.clip(base, 0, 1)


def avatar_image(s=640, seed=88):
    img = nebula(s, s, seed, NIGHT, star_density=0.0007)
    m = moon_image(s, s, seed + 1, phase=0.78)
    y, x = np.mgrid[0:s, 0:s].astype(np.float32)
    return np.clip(img * 0.4 + m * 0.9, 0, 1)


if __name__ == "__main__":
    W, H = 1200, 900
    save(np.clip(nebula(1800, 1000, 3, NIGHT, star_density=0.0009) * 1.45 + 0.01, 0, 1), "ana-cover.webp")
    save(avatar_image(), "ana-avatar.webp")
    save(moon_image(W, H, 7), "astrologia.webp")
    save(bodygraph_image(W, H), "human-design.webp")
    save(hexagram_image(W, H), "gene-keys.webp")
    save(eclipse_image(W, H), "curso.webp")
    save(twilight_image(W, H), "sesion.webp")
    save(galaxy_image(W, H), "comunidad.webp")
    # Landing
    save(nebula(1920, 1200, 101, NIGHT, star_density=0.001), "hero.webp", q=78)
    # Creadora wellness (María)
    sage = [(0.95, 0.93, 0.88), (0.80, 0.85, 0.76), (0.92, 0.84, 0.74), (0.45, 0.55, 0.43)]
    sand = [(0.96, 0.93, 0.87), (0.92, 0.80, 0.68), (0.84, 0.87, 0.79), (0.76, 0.55, 0.42)]
    clay = [(0.95, 0.92, 0.87), (0.88, 0.86, 0.8), (0.93, 0.83, 0.74), (0.62, 0.68, 0.55)]
    save(soft_light_image(1800, 1000, 201, sage, "waves"), "maria-cover.webp")
    save(soft_light_image(640, 640, 202, sand, "circle"), "maria-avatar.webp")
    save(soft_light_image(W, H, 203, sage, "arch"), "maria-meditacion.webp")
    save(soft_light_image(W, H, 204, sand, "sun"), "maria-respira.webp")
    save(soft_light_image(W, H, 205, clay, "circle"), "maria-sesion.webp")
