"""Render PDF pages to PNG and OCR them with the macOS Vision helper (bin/ocr). Results are cached.

Usage as a module: ocr_pdf(path) -> list of pages, each {"png": path, "w":, "h":, "lines": [...]}
"""
import hashlib
import json
import os
import re
import subprocess
import sys

import pymupdf

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
CACHE = os.path.join(ROOT, "work", "ocr")
OCR_BIN = os.path.join(ROOT, "bin", "ocr")
DPI = 200


def _key(path: str) -> str:
    st = os.stat(path)
    return hashlib.sha1(f"{os.path.abspath(path)}|{st.st_size}|{st.st_mtime}".encode()).hexdigest()[:16]


def ocr_image(png: str) -> dict:
    out = subprocess.run([OCR_BIN, png], check=True, capture_output=True, text=True).stdout
    return json.loads(out.strip().splitlines()[0])


def _clean_band(img, y0: int, y1: int, x0: int, x1: int):
    """Crop a band, whiten the pale watermark (everything light), and return it upscaled 2x."""
    import cv2

    band = img[y0:y1, x0:x1]
    gray = cv2.cvtColor(band, cv2.COLOR_BGR2GRAY)
    gray[band.min(axis=2) > 150] = 255
    return cv2.resize(gray, None, fx=2, fy=2, interpolation=cv2.INTER_CUBIC)


def ocr_region(png: str, x0: float, y0: float, x1: float, y1: float, scale: int = 3) -> str:
    """OCR a small normalized region (e.g. a lone answer letter Vision skipped on the full page)."""
    import cv2

    img = cv2.imread(png)
    H, W = img.shape[:2]
    band = _clean_band(img, max(0, int(y0 * H)), min(H, int(y1 * H)), max(0, int(x0 * W)), min(W, int(x1 * W)))
    band = cv2.resize(band, None, fx=scale / 2, fy=scale / 2, interpolation=cv2.INTER_CUBIC)
    band = cv2.copyMakeBorder(band, 40, 40, 40, 40, cv2.BORDER_CONSTANT, value=255)
    tmp = os.path.join(os.path.dirname(png), "_region.png")
    cv2.imwrite(tmp, band)
    try:
        return " ".join(l["t"] for l in ocr_image(tmp)["lines"]).strip()
    finally:
        os.remove(tmp)


def ocr_letter(png: str, x0: float, y0: float, x1: float, y1: float) -> str:
    """Read one isolated capital letter. Vision often returns nothing for a lone glyph, so the glyph is
    cropped tight and tiled three times ("C C C"); the majority reading wins."""
    import cv2
    import numpy as np
    from collections import Counter

    img = cv2.imread(png)
    H, W = img.shape[:2]
    band = _clean_band(img, max(0, int(y0 * H)), min(H, int(y1 * H)), max(0, int(x0 * W)), min(W, int(x1 * W)))
    ys, xs = np.where(band < 128)
    if len(xs) < 20:
        return ""
    glyph = band[ys.min():ys.max() + 1, xs.min():xs.max() + 1]
    h = glyph.shape[0]
    gap = np.full((h, max(8, h // 2)), 255, np.uint8)
    tiled = np.hstack([glyph, gap, glyph, gap, glyph])
    tiled = cv2.copyMakeBorder(tiled, h, h, h, h, cv2.BORDER_CONSTANT, value=255)
    tmp = os.path.join(os.path.dirname(png), "_letter.png")
    cv2.imwrite(tmp, tiled)
    try:
        text = " ".join(l["t"] for l in ocr_image(tmp)["lines"])
    finally:
        os.remove(tmp)
    letters = re.findall(r"[A-Z]", text.upper())
    return Counter(letters).most_common(1)[0][0] if letters else ""


def _uncovered_bands(img, lines: list, pictures: list) -> list:
    """Pixel rows of dark text that no OCR line covers -> [(y0, y1, x0, x1)] in pixels."""
    import cv2
    import numpy as np

    H, W = img.shape[:2]
    dark = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY) < 110
    for r in pictures:
        dark[int(r["y"] * H):int((r["y"] + r["h"]) * H) + 1, int(r["x"] * W):int((r["x"] + r["w"]) * W) + 1] = False
    for l in lines:
        if l["c"] >= 0.6 or l["h"] <= 0.02:
            dark[max(0, int((l["y"] - 0.003) * H)):int((l["y"] + l["h"] + 0.003) * H),
                 max(0, int((l["x"] - 0.004) * W)):int((l["x"] + l["w"] + 0.004) * W)] = False
    # Ink no line covers; a lone bullet dot is too small to count.
    dark = cv2.morphologyEx(dark.astype(np.uint8), cv2.MORPH_OPEN, np.ones((2, 2), np.uint8)).astype(bool)
    text_row = dark.sum(axis=1) >= 3
    bands, y = [], 0
    pad, min_h = int(0.004 * H), int(0.004 * H)
    while y < H:
        if not text_row[y]:
            y += 1
            continue
        y0 = y
        while y < H and (text_row[y] or text_row[y:y + pad].any()):
            y += 1
        if y - y0 < min_h:
            continue
        cols = np.where(dark[y0:y].any(axis=0))[0]
        if len(cols) and cols[-1] - cols[0] > 0.012 * W and dark[y0:y].sum() > 60:
            bands.append((max(0, y0 - pad), min(H, y + pad), max(0, cols[0] - int(0.02 * W)), min(W, cols[-1] + int(0.02 * W))))
    return bands


def _repair(page: dict) -> dict:
    """Recover text lines Vision lost to the watermark.

    Two symptoms: a line read as one tall low-confidence blob, or a line skipped entirely. Both bands are
    re-OCR'd with the watermark removed and the recovered lines spliced in.
    """
    import cv2
    from images import detect_regions

    pictures = detect_regions(page, min_w=0.04, min_h=0.025)
    img = cv2.imread(page["png"])
    H, W = img.shape[:2]
    lines = list(page["lines"])
    jobs = []  # (y0, y1, x0, x1, junk line to replace or None)
    for l in [l for l in lines if (l["c"] < 0.6 and l["h"] > 0.022 or l["h"] > 0.035) and l["w"] > 0.1]:
        overlaps = lambda r: not (r["x"] > l["x"] + l["w"] or r["x"] + r["w"] < l["x"] or
                                  r["y"] > l["y"] + l["h"] or r["y"] + r["h"] < l["y"])
        if any(overlaps(r) for r in pictures):
            continue
        jobs.append((max(0, int((l["y"] - 0.005) * H)), min(H, int((l["y"] + l["h"] + 0.005) * H)),
                     max(0, int((l["x"] - 0.05) * W)), min(W, int((l["x"] + l["w"] + 0.05) * W)), l))
    for y0, y1, x0, x1 in _uncovered_bands(img, lines, pictures):
        row = [l for l in lines if l["y"] * H < y1 and (l["y"] + l["h"]) * H > y0 and l["h"] <= 0.035]
        x0 = min([x0] + [max(0, int((l["x"] - 0.01) * W)) for l in row])
        x1 = max([x1] + [min(W, int((l["x"] + l["w"] + 0.01) * W)) for l in row])
        jobs.append((y0, y1, x0, x1, None))
    for y0, y1, x0, x1, junk in jobs:
        band = _clean_band(img, y0, y1, x0, x1)
        tmp = os.path.join(os.path.dirname(page["png"]), "_band.png")
        cv2.imwrite(tmp, band)
        got = [g for g in ocr_image(tmp)["lines"] if g["c"] >= 0.8]
        os.remove(tmp)
        if not got:
            continue
        bw, bh = x1 - x0, y1 - y0
        if junk is not None and junk in lines:
            lines.remove(junk)
        for g in got:
            new = {"t": g["t"], "c": g["c"], "x": (x0 + g["x"] * bw) / W, "y": (y0 + g["y"] * bh) / H,
                   "w": g["w"] * bw / W, "h": g["h"] * bh / H, "repaired": True}
            cy = new["y"] + new["h"] / 2
            same = [o for o in lines if abs(o["y"] + o["h"] / 2 - cy) < 0.006 and
                    o["x"] < new["x"] + new["w"] and new["x"] < o["x"] + o["w"]]
            # A fuller reading of the same line replaces the fragments Vision got from the watermarked page.
            if same and all(len(o["t"]) < len(new["t"]) and o["x"] >= new["x"] - 0.01 and
                            o["x"] + o["w"] <= new["x"] + new["w"] + 0.01 for o in same):
                for o in same:
                    lines.remove(o)
                same = []
            if not any(o["c"] >= 0.6 for o in same):
                lines.append(new)
    lines.sort(key=lambda l: (round(l["y"], 3), l["x"]))
    return {**page, "lines": lines}


def _blank(pages: list) -> bool:
    return not any(p["lines"] for p in pages)


def ocr_pdf(path: str) -> list:
    d = os.path.join(CACHE, _key(path))
    repaired = os.path.join(d, "pages.v7.json")
    if os.path.exists(repaired):
        with open(repaired) as f:
            pages = json.load(f)
        if not _blank(pages):
            return pages
    pages = _ocr_pages(path, d)
    if _blank(pages):  # Vision is unavailable in some sandboxed shells; never cache that
        raise RuntimeError(f"OCR produced no text for {path}")
    pages = [_repair(p) for p in pages]
    with open(repaired, "w") as f:
        json.dump(pages, f)
    return pages


def _ocr_pages(path: str, d: str) -> list:
    meta = os.path.join(d, "pages.json")
    if os.path.exists(meta):
        with open(meta) as f:
            pages = json.load(f)
        if not _blank(pages):
            return pages
    os.makedirs(d, exist_ok=True)
    doc = pymupdf.open(path)
    pngs = []
    for i, page in enumerate(doc):
        png = os.path.join(d, f"p{i + 1:02d}.png")
        page.get_pixmap(dpi=DPI).save(png)
        pngs.append(png)
    pages = []
    for png in pngs:
        r = ocr_image(png)
        r["png"] = png
        r["lines"].sort(key=lambda l: (round(l["y"], 3), l["x"]))
        pages.append(r)
    if _blank(pages):
        return pages
    with open(meta, "w") as f:
        json.dump(pages, f)
    return pages


def page_text(page: dict) -> str:
    return "\n".join(l["t"] for l in page["lines"])


if __name__ == "__main__":
    for p in sys.argv[1:]:
        print(f"######## {p}")
        for i, pg in enumerate(ocr_pdf(p)):
            print(f"=== page {i + 1}")
            print(page_text(pg))
