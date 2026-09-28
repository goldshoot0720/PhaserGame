#!/usr/bin/env python3
"""
Generate game sprites + select-screen portraits from the reference character images.

- Plain light / white backgrounds: flood-fill from the image border with a colour tolerance.
- Photo-style subjects (the two cats, plus the two real-photo people whose white
  shoes blend into the backdrop): subject mask via `rembg` (pip install rembg onnxruntime).
  If rembg is not available, fall back to an elliptical upper-body crop with a clean border.

Originals are never modified; outputs go to assets/characters/:
  <id>.png          full-body sprite, trimmed, height SPRITE_H
  <id>_face.png     square head-shot portrait, PORTRAIT px

Env: REMBG_MODEL (default u2netp, 4.7 MB; isnet-general-use is larger and sharper).

Usage:  python3 scripts/process_images.py
"""
import os
from collections import deque
from pathlib import Path

from PIL import Image, ImageChops, ImageDraw, ImageFilter

SRC_DIR = Path("/Users/fengxiong/Documents/基準圖片")
OUT_DIR = Path(__file__).resolve().parent.parent / "assets" / "characters"
PREFIX = "ChatGPT Image 2026年9月22日 上午"

SPRITE_H = 240      # sprite height in px (game scales further down)
PORTRAIT = 128      # portrait square size
TOLERANCE = 20      # flood-fill step colour distance for plain backgrounds

# id, source time-stamp, background kind ("plain" | "photo")
CHARACTERS = [
    ("whale",   "12_05_39", "plain"),
    ("penguin", "12_07_22", "plain"),
    ("glasses", "12_13_00", "photo"),
    ("shiang",  "12_13_57", "photo"),
    ("calico",  "12_14_54", "photo"),
    ("whitecat", "12_15_54", "photo"),
    ("redcat",  "12_16_57", "plain"),
    ("sailor",  "12_18_04", "plain"),
]


def flood_mask(img, tol):
    """Return an L mask: 0 where the pixel is border-connected background, 255 elsewhere."""
    rgb = img.convert("RGB")
    w, h = rgb.size
    px = rgb.load()
    visited = bytearray(w * h)
    q = deque()
    for x in range(w):
        q.append((x, 0)); q.append((x, h - 1))
    for y in range(h):
        q.append((0, y)); q.append((w - 1, y))
    tol2 = tol * tol
    while q:
        x, y = q.popleft()
        i = y * w + x
        if visited[i]:
            continue
        r, g, b = px[x, y]
        # background is light, low-saturation and neutral/cool (skin tones are warm: r >> b)
        if r + g + b < 600 or max(r, g, b) - min(r, g, b) > 22 or r - b > 4:
            continue
        visited[i] = 1
        for nx, ny in ((x + 1, y), (x - 1, y), (x, y + 1), (x, y - 1)):
            if 0 <= nx < w and 0 <= ny < h and not visited[ny * w + nx]:
                nr, ng, nb = px[nx, ny]
                if (nr - r) ** 2 + (ng - g) ** 2 + (nb - b) ** 2 <= tol2:
                    q.append((nx, ny))
    mask = Image.frombytes("L", (w, h), bytes(0 if v else 255 for v in visited))
    # remove speckles, then soften the edge by one pixel
    mask = mask.filter(ImageFilter.MinFilter(3)).filter(ImageFilter.MaxFilter(3))
    return mask.filter(ImageFilter.GaussianBlur(0.8))


def rembg_mask(img):
    from rembg import new_session, remove  # noqa: WPS433 (optional dependency)
    session = new_session(os.getenv("REMBG_MODEL", "u2netp"))
    cut = remove(img.convert("RGB"), session=session, post_process_mask=True)
    alpha = cut.getchannel("A")
    # drop faint haze (floor reflections / light rays) and keep a clean edge
    alpha = alpha.point(lambda a: 0 if a < 40 else min(255, int(a * 1.15)))
    return alpha


def ellipse_fallback(img):
    """Upper-body elliptical crop with a white border (used when rembg is missing)."""
    w, h = img.size
    mask = Image.new("L", (w, h), 0)
    ImageDraw.Draw(mask).ellipse((w * 0.12, h * 0.02, w * 0.88, h * 0.62), fill=255)
    return mask


def head_box(alpha):
    """Square box around the head: top of the silhouette, centred on the top rows' centroid."""
    bbox = alpha.getbbox()
    x0, y0, x1, y1 = bbox
    fig_h = y1 - y0
    band = alpha.crop((x0, y0, x1, y0 + int(fig_h * 0.10)))
    bw, bh = band.size
    data = band.load()
    xs = [x for y in range(bh) for x in range(bw) if data[x, y] > 128]
    cx = x0 + (sum(xs) / len(xs) if xs else bw / 2)
    size = int(fig_h * 0.24)
    top = max(0, y0 - int(size * 0.06))
    return (int(cx - size / 2), top, int(cx + size / 2), top + size)


def process(cid, stamp, kind):
    src = SRC_DIR / f"{PREFIX}{stamp}.png"
    img = Image.open(src).convert("RGBA")
    method = "flood-fill"
    if kind == "plain":
        mask = flood_mask(img, TOLERANCE)
    else:
        try:
            mask = rembg_mask(img)
            method = "rembg"
        except ImportError:
            mask = ellipse_fallback(img)
            method = "ellipse-fallback"

    cut = img.copy()
    cut.putalpha(ImageChops.multiply(mask, img.getchannel("A")))
    bbox = cut.getchannel("A").point(lambda a: 255 if a > 60 else 0).getbbox()
    cut = cut.crop(bbox)

    # full-body sprite
    scale = SPRITE_H / cut.height
    sprite = cut.resize((max(1, round(cut.width * scale)), SPRITE_H), Image.LANCZOS)
    sprite.save(OUT_DIR / f"{cid}.png", optimize=True)

    # head-shot portrait on a transparent square
    hb = head_box(cut.getchannel("A"))
    face = Image.new("RGBA", (hb[2] - hb[0], hb[3] - hb[1]), (0, 0, 0, 0))
    face.paste(cut.crop(hb), (0, 0))
    face = face.resize((PORTRAIT, PORTRAIT), Image.LANCZOS)
    face.save(OUT_DIR / f"{cid}_face.png", optimize=True)
    print(f"{cid:9s} {method:16s} sprite={sprite.size} face={face.size}")


def main():
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    for cid, stamp, kind in CHARACTERS:
        process(cid, stamp, kind)


if __name__ == "__main__":
    main()
