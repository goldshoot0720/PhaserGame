"""Cut out the source character art and write game-sized PNGs into assets/.

Plain-background images: flood-fill from the image border with a colour tolerance.
Photo-background images: rembg subject mask (falls back to flood-fill if rembg is missing).
The source images are only read, never modified.

Usage: python tools/process_sprites.py  (run with a venv that has pillow, numpy, rembg)
"""
from collections import deque
from pathlib import Path

import numpy as np
from PIL import Image, ImageFilter

SRC_DIR = Path.home() / "Documents" / "基準圖片"
PREFIX = "ChatGPT Image 2026年9月22日 上午"
OUT_DIR = Path(__file__).resolve().parent.parent / "assets"

# key, source time stamp, background method
CHARACTERS = [
    ("whale", "12_05_39", "flood"),
    ("penguin", "12_07_22", "flood"),
    ("glasses", "12_13_00", "flood"),
    ("tshirt", "12_13_57", "flood"),
    ("calico", "12_14_54", "rembg"),
    ("library", "12_15_54", "rembg"),
    ("redcat", "12_16_57", "flood"),
    ("sailor", "12_18_04", "flood"),
]

SPRITE_HEIGHT = 256      # stored at 4x game size so bosses can scale up cleanly
PORTRAIT_SIZE = 160
FLOOD_TOLERANCE = 38


def flood_mask(rgb: np.ndarray, tol: int) -> np.ndarray:
    """Return a boolean foreground mask by flood-filling background from the border."""
    h, w, _ = rgb.shape
    rgb = rgb.astype(np.int32)
    bg = np.zeros((h, w), bool)
    seen = np.zeros((h, w), bool)
    queue = deque()
    for x in range(w):
        queue.append((0, x, rgb[0, x])); queue.append((h - 1, x, rgb[h - 1, x]))
    for y in range(h):
        queue.append((y, 0, rgb[y, 0])); queue.append((y, w - 1, rgb[y, w - 1]))
    # Compare each pixel with the corner-average background colour.
    ref = np.median(np.concatenate([rgb[0], rgb[-1], rgb[:, 0], rgb[:, -1]]), axis=0)
    close = np.abs(rgb - ref).max(axis=2) <= tol
    while queue:
        y, x, _ = queue.popleft()
        if seen[y, x]:
            continue
        seen[y, x] = True
        if not close[y, x]:
            continue
        bg[y, x] = True
        if y > 0: queue.append((y - 1, x, None))
        if y < h - 1: queue.append((y + 1, x, None))
        if x > 0: queue.append((y, x - 1, None))
        if x < w - 1: queue.append((y, x + 1, None))
    return ~bg


def rembg_alpha(img: Image.Image) -> np.ndarray:
    from rembg import new_session, remove
    session = new_session("isnet-general-use")
    cut = remove(img, session=session, post_process_mask=True)
    return np.array(cut.split()[-1])


def largest_component(mask: np.ndarray) -> np.ndarray:
    """Keep only the biggest connected blob (drops stray background specks)."""
    h, w = mask.shape
    labels = np.zeros((h, w), np.int32)
    best, best_size, cur = 0, 0, 0
    for sy, sx in zip(*np.nonzero(mask)):
        if labels[sy, sx]:
            continue
        cur += 1
        size = 0
        stack = [(sy, sx)]
        labels[sy, sx] = cur
        while stack:
            y, x = stack.pop()
            size += 1
            for ny, nx in ((y - 1, x), (y + 1, x), (y, x - 1), (y, x + 1)):
                if 0 <= ny < h and 0 <= nx < w and mask[ny, nx] and not labels[ny, nx]:
                    labels[ny, nx] = cur
                    stack.append((ny, nx))
        if size > best_size:
            best, best_size = cur, size
    return labels == best


def cut_out(key: str, stamp: str, method: str) -> Image.Image:
    src = Image.open(SRC_DIR / f"{PREFIX}{stamp}.png").convert("RGB")
    if method == "rembg":
        alpha = rembg_alpha(src)
        solid = largest_component(alpha > 128)
        alpha = np.where(solid, alpha, 0).astype(np.uint8)
    else:
        small = src.resize((src.width // 2, src.height // 2), Image.LANCZOS)
        mask = flood_mask(np.array(small), FLOOD_TOLERANCE)
        mask = largest_component(mask)
        alpha_small = Image.fromarray((mask * 255).astype(np.uint8))
        alpha_img = alpha_small.resize(src.size, Image.LANCZOS).filter(ImageFilter.MinFilter(3))
        alpha = np.array(alpha_img.filter(ImageFilter.GaussianBlur(1)))
    rgba = src.copy()
    rgba.putalpha(Image.fromarray(alpha))
    return rgba.crop(rgba.getbbox())


def main() -> None:
    (OUT_DIR / "characters").mkdir(parents=True, exist_ok=True)
    (OUT_DIR / "portraits").mkdir(parents=True, exist_ok=True)
    for key, stamp, method in CHARACTERS:
        full = cut_out(key, stamp, method)
        ratio = SPRITE_HEIGHT / full.height
        sprite = full.resize((max(1, round(full.width * ratio)), SPRITE_HEIGHT), Image.LANCZOS)
        sprite.save(OUT_DIR / "characters" / f"{key}.png", optimize=True)

        # Square bust crop: top of the figure, centred on the head.
        side = int(full.height * 0.30)
        alpha = np.array(full.split()[-1])
        top_rows = alpha[: side // 2] > 0
        cols = np.nonzero(top_rows.any(axis=0))[0]
        cx = int(cols.mean()) if len(cols) else full.width // 2
        left = max(0, min(full.width - side, cx - side // 2))
        bust = full.crop((left, 0, left + side, side)).resize((PORTRAIT_SIZE, PORTRAIT_SIZE), Image.LANCZOS)
        bust.save(OUT_DIR / "portraits" / f"{key}.png", optimize=True)
        print(key, method, full.size, "->", sprite.size)


if __name__ == "__main__":
    main()
