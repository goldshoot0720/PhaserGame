"""Build game sprites from the reference images (originals are only read, never modified).

Plain backgrounds: flood-fill from the image edges over bright, low-saturation pixels.
Photo backgrounds: OpenCV GrabCut seeded with a rectangle + sure-background border,
then largest connected component and hole filling.
Outputs (in assets/): fighters/fN.png, portraits/pN.png, stages/bgN.png
"""
import sys
from pathlib import Path

import numpy as np
from PIL import Image, ImageFilter, ImageEnhance
from scipy import ndimage

SRC = Path("/Users/fengxiong/Documents/基準圖片")
OUT = Path(__file__).resolve().parent.parent / "assets"
FILES = [
    "ChatGPT Image 2026年9月22日 上午12_05_39.png",
    "ChatGPT Image 2026年9月22日 上午12_07_22.png",
    "ChatGPT Image 2026年9月22日 上午12_13_00.png",
    "ChatGPT Image 2026年9月22日 上午12_13_57.png",
    "ChatGPT Image 2026年9月22日 上午12_14_54.png",
    "ChatGPT Image 2026年9月22日 上午12_15_54.png",
    "ChatGPT Image 2026年9月22日 上午12_16_57.png",
    "ChatGPT Image 2026年9月22日 上午12_18_04.png",
]
PHOTO = {5: (0.02, 0.08, 0.96, 0.95), 6: (0.03, 0.05, 0.97, 0.95)}  # GrabCut rect as fractions
# Extra GrabCut hints in source pixels: (label, x0, y0, x1, y1), label = fg / bg / maybe (probable fg)
HINTS = {
    5: [("maybe", 640, 770, 830, 1005), ("fg", 715, 840, 780, 940),  # tail
        ("bg", 690, 570, 1024, 765), ("bg", 835, 780, 1024, 1100)],
}
SPRITE_H = 440
PORTRAIT = 200


def largest_component(mask):
    lab, n = ndimage.label(mask)
    if n == 0:
        return mask
    sizes = ndimage.sum(mask, lab, range(1, n + 1))
    return lab == (np.argmax(sizes) + 1)


def fill_small_holes(mask, max_area):
    holes = ndimage.binary_fill_holes(mask) & ~mask
    lab, n = ndimage.label(holes)
    if n == 0:
        return mask
    sizes = ndimage.sum(holes, lab, range(1, n + 1))
    small = np.isin(lab, np.nonzero(sizes <= max_area)[0] + 1)
    return mask | small


def plain_mask(rgb):
    f = rgb.astype(np.int16)
    sat = f.max(axis=2) - f.min(axis=2)
    bright = f.min(axis=2)
    candidate = (sat < 22) & (bright > 188)
    lab, _ = ndimage.label(candidate)
    edge = np.unique(np.concatenate([lab[0], lab[-1], lab[:, 0], lab[:, -1]]))
    bg = np.isin(lab, edge[edge > 0])
    fg = largest_component(~bg)
    fg = ndimage.binary_opening(fg, iterations=1)
    return fill_small_holes(largest_component(fg), 400)


def photo_mask(rgb, rect, hints):
    import cv2
    h, w = rgb.shape[:2]
    scale = 0.5
    small = cv2.resize(rgb, (int(w * scale), int(h * scale)), interpolation=cv2.INTER_AREA)
    sh, sw = small.shape[:2]
    x0, y0, x1, y1 = rect
    r = (int(x0 * sw), int(y0 * sh), int((x1 - x0) * sw), int((y1 - y0) * sh))
    mask = np.zeros((sh, sw), np.uint8)
    bgd, fgd = np.zeros((1, 65), np.float64), np.zeros((1, 65), np.float64)
    bgr = cv2.cvtColor(small, cv2.COLOR_RGB2BGR)
    cv2.grabCut(bgr, mask, r, bgd, fgd, 8, cv2.GC_INIT_WITH_RECT)
    if hints:
        labels = {"fg": cv2.GC_FGD, "bg": cv2.GC_BGD, "maybe": cv2.GC_PR_FGD}
        for label, *box in hints:
            a, b, c, d = (int(v * scale) for v in box)
            mask[b:d, a:c] = labels[label]
        cv2.grabCut(bgr, mask, None, bgd, fgd, 6, cv2.GC_INIT_WITH_MASK)
    fg = (mask == cv2.GC_FGD) | (mask == cv2.GC_PR_FGD)
    fg = ndimage.binary_opening(fg, iterations=2)
    body = largest_component(fg)
    lab, _ = ndimage.label(fg)
    sure = np.unique(lab[mask == cv2.GC_FGD])  # keep parts attached to sure-foreground hints
    fg = fill_small_holes(body | np.isin(lab, sure[sure > 0]), 1500)
    fg = cv2.resize(fg.astype(np.uint8) * 255, (w, h), interpolation=cv2.INTER_LINEAR) > 127
    return fg


def to_rgba(rgb, mask):
    alpha = Image.fromarray((mask * 255).astype(np.uint8)).filter(ImageFilter.GaussianBlur(1.2))
    a = np.array(alpha)
    a[a < 40] = 0  # drop faint halo
    img = Image.fromarray(np.dstack([rgb, a]).astype(np.uint8), "RGBA")
    return img.crop(img.getbbox())


def make_stage(rgb, mask, idx):
    """Backdrop: remove the character (inpaint at low resolution), blur and darken."""
    import cv2
    h, w = rgb.shape[:2]
    sw, sh = w // 4, h // 4
    small = cv2.resize(rgb, (sw, sh), interpolation=cv2.INTER_AREA)
    hole = cv2.resize(ndimage.binary_dilation(mask, iterations=40).astype(np.uint8), (sw, sh)) > 0
    small = cv2.inpaint(small, hole.astype(np.uint8), 12, cv2.INPAINT_TELEA)
    img = Image.fromarray(cv2.resize(small, (w, h), interpolation=cv2.INTER_CUBIC)).filter(ImageFilter.GaussianBlur(8))
    img = ImageEnhance.Brightness(img).enhance(0.72)
    w, h = img.size
    target = 1280 / 720
    ch = int(w / target)
    top = max(0, int(h * 0.45) - ch // 2)
    img = img.crop((0, top, w, top + ch)).resize((1280, 720), Image.LANCZOS)
    img.save(OUT / "stages" / f"bg{idx}.jpg", quality=85)


def main(only=None):
    for sub in ("fighters", "portraits", "stages"):
        (OUT / sub).mkdir(parents=True, exist_ok=True)
    for i, name in enumerate(FILES, start=1):
        if only and i not in only:
            continue
        rgb = np.array(Image.open(SRC / name).convert("RGB"))
        mask = photo_mask(rgb, PHOTO[i], HINTS.get(i)) if i in PHOTO else plain_mask(rgb)
        sprite = to_rgba(rgb, mask)
        full = sprite
        sw = round(sprite.width * SPRITE_H / sprite.height)
        sprite.resize((sw, SPRITE_H), Image.LANCZOS).save(OUT / "fighters" / f"f{i}.png", optimize=True)
        # portrait: centred square around the head (top part of the trimmed figure)
        side = int(full.height * 0.30)
        cx = full.width // 2
        box = (cx - side // 2, 0, cx + side // 2, side)
        full.crop(box).resize((PORTRAIT, PORTRAIT), Image.LANCZOS).save(OUT / "portraits" / f"p{i}.png", optimize=True)
        if i in PHOTO:
            make_stage(rgb, mask, i)
        print("done", i, sprite.size, "->", sw, SPRITE_H)


if __name__ == "__main__":
    main({int(a) for a in sys.argv[1:]} or None)
