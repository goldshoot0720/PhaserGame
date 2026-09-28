"""
角色素材處理腳本（可重複執行）。

讀取使用者的原始參考圖（絕不修改原檔），輸出至 public/assets/chars/：
  c{N}_full.png  全身立繪（去背、裁切、縮到 420px 高）— 角色選擇卡片
  c{N}_head.png  128x128 圓形頭像（透明背景）— 遊戲中 token、記分板、擊殺訊息

去背方式：
  - 純色背景：從邊緣做 flood fill（容差）
  - 照片背景（#5、#6）：優先使用 rembg；沒有 rembg 時改用柔邊橢圓暈影裁切

用法：
  python3 tools/prepare_assets.py
  （若要使用 rembg： pip install rembg onnxruntime，建議在 venv 內）
"""
from pathlib import Path
from PIL import Image, ImageDraw, ImageFilter, ImageChops

SRC_DIR = Path("/Users/fengxiong/Documents/基準圖片")
OUT_DIR = Path(__file__).resolve().parent.parent / "public" / "assets" / "chars"
FULL_HEIGHT = 420
HEAD_SIZE = 128
FLOOD_TOLERANCE = 28

# (檔名, 背景類型, 頭部中心 x, y 與半徑 — 以原圖座標計)
CHARACTERS = [
    ("ChatGPT Image 2026年9月22日 上午12_05_39.png", "plain", 512, 285, 200),
    ("ChatGPT Image 2026年9月22日 上午12_07_22.png", "plain", 512, 255, 200),
    ("ChatGPT Image 2026年9月22日 上午12_13_00.png", "plain", 508, 205, 115),
    ("ChatGPT Image 2026年9月22日 上午12_13_57.png", "plain", 512, 190, 110),
    ("ChatGPT Image 2026年9月22日 上午12_14_54.png", "photo", 512, 340, 150),
    ("ChatGPT Image 2026年9月22日 上午12_15_54.png", "photo", 540, 225, 160),
    ("ChatGPT Image 2026年9月22日 上午12_16_57.png", "plain", 512, 225, 140),
    ("ChatGPT Image 2026年9月22日 上午12_18_04.png", "plain", 512, 190, 120),
]

MAGIC = (255, 0, 254)


def flood_fill_mask(img: Image.Image) -> Image.Image:
    """從邊緣多個種子點 flood fill，回傳前景遮罩（L 模式，255=角色）。"""
    work = img.convert("RGB").copy()
    w, h = work.size
    step = 32
    seeds = [(x, 0) for x in range(0, w, step)] + [(x, h - 1) for x in range(0, w, step)]
    seeds += [(0, y) for y in range(0, h, step)] + [(w - 1, y) for y in range(0, h, step)]
    for s in seeds:
        if work.getpixel(s) != MAGIC:
            ImageDraw.floodfill(work, s, MAGIC, thresh=FLOOD_TOLERANCE)
    r, g, b = work.split()
    is_bg = ImageChops.multiply(
        ImageChops.multiply(r.point(lambda v: 255 if v == 255 else 0),
                            g.point(lambda v: 255 if v == 0 else 0)),
        b.point(lambda v: 255 if v == 254 else 0))
    mask = ImageChops.invert(is_bg)
    # 輕微收邊並柔化，去掉殘留的背景色邊
    return mask.filter(ImageFilter.MinFilter(3)).filter(ImageFilter.GaussianBlur(0.8))


def photo_mask(img: Image.Image) -> Image.Image:
    try:
        from rembg import remove
        cut = remove(img.convert("RGB"))
        print("    使用 rembg 分割主體")
        return cut.split()[3]
    except Exception as exc:  # rembg 不可用時的後備方案
        print(f"    rembg 無法使用（{exc.__class__.__name__}），改用柔邊橢圓暈影")
        w, h = img.size
        mask = Image.new("L", (w, h), 0)
        ImageDraw.Draw(mask).ellipse((w * 0.08, h * 0.03, w * 0.92, h * 0.97), fill=255)
        return mask.filter(ImageFilter.GaussianBlur(40))


def make_full(img: Image.Image, mask: Image.Image) -> Image.Image:
    rgba = img.convert("RGBA")
    rgba.putalpha(mask)
    bbox = mask.point(lambda v: 255 if v > 40 else 0).getbbox()
    rgba = rgba.crop(bbox)
    scale = FULL_HEIGHT / rgba.height
    return rgba.resize((max(1, round(rgba.width * scale)), FULL_HEIGHT), Image.LANCZOS)


def make_head(img: Image.Image, cx: int, cy: int, r: int) -> Image.Image:
    """圓形頭像：保留原背景（在圓內），token 上看起來較完整。"""
    crop = img.convert("RGBA").crop((cx - r, cy - r, cx + r, cy + r))
    crop = crop.resize((HEAD_SIZE, HEAD_SIZE), Image.LANCZOS)
    big = HEAD_SIZE * 4
    circle = Image.new("L", (big, big), 0)
    ImageDraw.Draw(circle).ellipse((0, 0, big - 1, big - 1), fill=255)
    crop.putalpha(circle.resize((HEAD_SIZE, HEAD_SIZE), Image.LANCZOS))
    return crop


def main():
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    for i, (name, kind, cx, cy, r) in enumerate(CHARACTERS, start=1):
        src = SRC_DIR / name
        print(f"[{i}] {name} ({kind})")
        img = Image.open(src)
        img.load()
        mask = flood_fill_mask(img) if kind == "plain" else photo_mask(img)
        make_full(img, mask).save(OUT_DIR / f"c{i}_full.png", optimize=True)
        make_head(img, cx, cy, r).save(OUT_DIR / f"c{i}_head.png", optimize=True)
    print(f"完成，輸出於 {OUT_DIR}")


if __name__ == "__main__":
    main()
