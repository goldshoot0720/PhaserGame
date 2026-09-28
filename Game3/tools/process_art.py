#!/usr/bin/env python3
"""把 基準圖片 的角色原圖處理成遊戲素材（不修改原檔）。

輸出到 public/assets/characters/：
  portrait_<id>.png  256x256 頭像/半身像（選角、HUD、排名）
  head_<id>.png      128x128 小頭像（放在卡丁車上，盡量透明背景）
用法：python3 tools/process_art.py
"""
import os
from PIL import Image, ImageDraw, ImageFilter, ImageChops

SRC = "/Users/fengxiong/Documents/基準圖片"
OUT = os.path.join(os.path.dirname(__file__), "..", "public", "assets", "characters")
PREFIX = "ChatGPT Image 2026年9月22日 上午"

# id, 檔名時間, 頭像框 (cx, cy, size), 小頭框 (cx, cy, size), 背景可去除?
CHARS = [
    ("whale",   "12_05_39", (510, 255, 520), (505, 250, 440), True),
    ("penguin", "12_07_22", (510, 260, 500), (510, 245, 420), True),
    ("glasses", "12_13_00", (512, 230, 360), (512, 205, 230), True),
    ("boy",     "12_13_57", (512, 240, 380), (512, 215, 250), True),
    ("calico",  "12_14_54", (512, 320, 420), (512, 300, 300), False),
    ("snow",    "12_15_54", (541, 280, 420), (541, 262, 300), False),
    ("redcat",  "12_16_57", (510, 270, 470), (510, 245, 400), True),
    ("sailor",  "12_18_04", (510, 240, 400), (510, 220, 330), True),
]


def crop(img, box):
    cx, cy, s = box
    return img.crop((cx - s // 2, cy - s // 2, cx + s // 2, cy + s // 2))


def key_background(img, thresh=28):
    """從邊緣做 flood fill，把接近背景色的淺色區域變透明。"""
    rgb = img.convert("RGB")
    w, h = rgb.size
    marker = (255, 0, 254)
    work = rgb.copy()
    seeds = []
    step = 6
    for x in range(0, w, step):
        seeds += [(x, 0)]
    for y in range(0, h, step):
        seeds += [(0, y), (w - 1, y)]
    for sx, sy in seeds:
        px = work.getpixel((sx, sy))
        if px == marker:
            continue
        # 只從淺色背景開始填
        if sum(px) / 3 < 200:
            continue
        ImageDraw.floodfill(work, (sx, sy), marker, thresh=thresh)
    # 建立 alpha：marker 位置 = 0
    diff = ImageChops.difference(work, Image.new("RGB", (w, h), marker)).convert("L")
    alpha = diff.point(lambda v: 0 if v == 0 else 255)
    alpha = alpha.filter(ImageFilter.MinFilter(3)).filter(ImageFilter.GaussianBlur(1.2))
    out = rgb.convert("RGBA")
    out.putalpha(alpha)
    return out


def circle_badge(img, size, ring=(255, 255, 255)):
    """圓形遮罩頭像（用於複雜背景的角色）。"""
    big = size * 4
    im = img.convert("RGB").resize((big, big), Image.LANCZOS)
    mask = Image.new("L", (big, big), 0)
    d = ImageDraw.Draw(mask)
    pad = int(big * 0.04)
    d.ellipse((pad, pad, big - pad, big - pad), fill=255)
    out = Image.new("RGBA", (big, big), (0, 0, 0, 0))
    out.paste(im, (0, 0), mask)
    d2 = ImageDraw.Draw(out)
    d2.ellipse((pad, pad, big - pad, big - pad), outline=ring + (255,), width=int(big * 0.04))
    return out.resize((size, size), Image.LANCZOS)


def main():
    os.makedirs(OUT, exist_ok=True)
    for cid, t, pbox, hbox, keyable in CHARS:
        path = os.path.join(SRC, f"{PREFIX}{t}.png")
        img = Image.open(path)
        img.load()
        portrait = crop(img.convert("RGB"), pbox).resize((256, 256), Image.LANCZOS)
        portrait.save(os.path.join(OUT, f"portrait_{cid}.png"), optimize=True)

        head_src = crop(img.convert("RGB"), hbox)
        if keyable:
            head = key_background(head_src).resize((128, 128), Image.LANCZOS)
        else:
            head = circle_badge(head_src, 128)
        head.save(os.path.join(OUT, f"head_{cid}.png"), optimize=True)
        print("ok", cid)


if __name__ == "__main__":
    main()
