#!/usr/bin/env python3
"""Build card art (head + upper body crops) and full-body inspect images from the originals.
Originals are only read; processed copies are written to assets/."""
import glob, os
import numpy as np
from PIL import Image, ImageFilter
from scipy import ndimage

SRC_DIR = '/Users/fengxiong/Documents/基準圖片'
OUT = os.path.join(os.path.dirname(__file__), '..', 'assets')
CARD_SIZE = (360, 440)
FULL_HEIGHT = 900
# card id -> (source index, crop box (l, t, r, b), background tolerance or None to keep the scene)
# tolerance = summed RGB distance to the edge colours that still counts as background
CARDS = [
    ('luna',    0, (230, 20, 795, 710), 60),
    ('penguin', 1, (235, 30, 800, 720), 22),
    ('zhe',     2, (267, 90, 757, 690), 30),
    ('xiang',   3, (303, 110, 793, 710), 30),
    ('calico',  4, (246, 150, 778, 800), None),
    ('whitecat', 5, (294, 100, 801, 720), None),
    ('xiaohong', 6, (230, 20, 795, 710), 60),
    ('yukino',  7, (226, 50, 791, 740), 60),
]
EDGE_SAMPLE = 8            # columns sampled on each side for the background model
MIN_PART_RATIO = 0.05      # foreground islands smaller than this (vs largest) are dropped


def background_model(rgb):
    """Per-row blend of the left and right edge colours, so soft studio gradients count as background."""
    left = np.median(rgb[:, :EDGE_SAMPLE], axis=1)
    right = np.median(rgb[:, -EDGE_SAMPLE:], axis=1)
    t = np.linspace(0, 1, rgb.shape[1])[None, :, None]
    return left[:, None, :] * (1 - t) + right[:, None, :] * t


def remove_background(im, tolerance):
    """Clear the border-connected plain background, then drop stray islands (floor shadows)."""
    rgb = np.asarray(im.convert('RGB')).astype(np.int32)
    bg_like = np.abs(rgb - background_model(rgb)).sum(axis=2) <= tolerance
    labels, _ = ndimage.label(bg_like)
    border = np.unique(np.concatenate([labels[0], labels[-1], labels[:, 0], labels[:, -1]]))
    background = np.isin(labels, border[border > 0])
    fg_labels, count = ndimage.label(~background)
    sizes = ndimage.sum(np.ones_like(fg_labels), fg_labels, range(1, count + 1))
    keep = [i + 1 for i, size in enumerate(sizes) if size >= sizes.max() * MIN_PART_RATIO]
    mask = Image.fromarray((np.isin(fg_labels, keep) * 255).astype(np.uint8))
    mask = mask.filter(ImageFilter.MinFilter(3)).filter(ImageFilter.GaussianBlur(1))
    rgba = im.convert('RGBA')
    rgba.putalpha(mask)
    return rgba


def trim_logo():
    """The MCP logo sits on a large transparent canvas; trim it to the lettering."""
    logo = Image.open(os.path.join(OUT, 'ui', 'logo_raw.png'))
    logo.crop(logo.split()[3].getbbox()).save(os.path.join(OUT, 'ui', 'logo.png'))


def main():
    files = sorted(glob.glob(os.path.join(SRC_DIR, '*.png')))
    os.makedirs(os.path.join(OUT, 'cards'), exist_ok=True)
    os.makedirs(os.path.join(OUT, 'full'), exist_ok=True)
    for card_id, idx, box, tolerance in CARDS:
        src = Image.open(files[idx]).convert('RGB')
        src.crop(box).resize(CARD_SIZE, Image.LANCZOS).save(os.path.join(OUT, 'cards', f'{card_id}.png'))
        full = remove_background(src, tolerance) if tolerance else src.convert('RGBA')
        if tolerance:
            full = full.crop(full.split()[3].getbbox())
        scale = FULL_HEIGHT / full.height
        full = full.resize((round(full.width * scale), FULL_HEIGHT), Image.LANCZOS)
        full.save(os.path.join(OUT, 'full', f'{card_id}.png'))
        print(card_id, os.path.basename(files[idx]), full.size)
    trim_logo()


if __name__ == '__main__':
    main()
