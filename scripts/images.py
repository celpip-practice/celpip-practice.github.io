"""Detect picture regions on scanned pages (ignoring text lines and the light-pink watermark)."""
import cv2
import numpy as np


def ink_mask(img: np.ndarray) -> np.ndarray:
    """Pixels that are real content: dark, or saturated colour. The watermark is pale pink."""
    hsv = cv2.cvtColor(img, cv2.COLOR_BGR2HSV)
    gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
    dark = gray < 170
    colourful = (hsv[:, :, 1] > 60) & ((hsv[:, :, 2] < 245) | (hsv[:, :, 1] > 120))
    return ((dark | colourful) * 255).astype(np.uint8)


def split_on_blank_rows(img: np.ndarray, r: dict, min_h: float, min_gap_px: int = 3) -> list:
    """Split a region where a fully white horizontal line crosses it (stacked photos with thin gaps)."""
    H, W = img.shape[:2]
    x0, x1 = int(r["x"] * W), int((r["x"] + r["w"]) * W)
    y0, y1 = int(r["y"] * H), int((r["y"] + r["h"]) * H)
    gray = cv2.cvtColor(img[y0:y1, x0:x1], cv2.COLOR_BGR2GRAY)
    blank = (gray < 225).mean(axis=1) < 0.004
    pieces, start, y = [], 0, 0
    while y < len(blank):
        if blank[y]:
            g0 = y
            while y < len(blank) and blank[y]:
                y += 1
            if y - g0 >= min_gap_px:
                pieces.append((start, g0))
                start = y
        else:
            y += 1
    pieces.append((start, len(blank)))
    pieces = [(a, b) for a, b in pieces if b - a >= min_h * H]
    if len(pieces) < 2:
        return [r]
    return [{"x": r["x"], "y": (y0 + a) / H, "w": r["w"], "h": (b - a) / H} for a, b in pieces]


def is_real_text(l: dict) -> bool:
    """Vision sometimes 'reads' a word out of a photo: low confidence and unusually tall."""
    return l["c"] >= 0.6 or l["h"] <= 0.02


def detect_regions(page: dict, min_w: float = 0.08, min_h: float = 0.05, text_pad: float = 0.004) -> list:
    """Return picture regions [{x,y,w,h}] (normalized, top-left origin) for an OCR'd page dict."""
    img = cv2.imread(page["png"])
    H, W = img.shape[:2]
    mask = ink_mask(img)
    # Erase plain-text lines that sit outside pictures, so paragraphs don't become "images".
    text_only = np.zeros_like(mask)
    for l in page["lines"]:
        if not is_real_text(l) or l["t"].strip() in ("•", "*", "-"):
            continue
        x0 = int((l["x"] - text_pad) * W); y0 = int((l["y"] - text_pad) * H)
        x1 = int((l["x"] + l["w"] + text_pad) * W); y1 = int((l["y"] + l["h"] + text_pad) * H)
        text_only[max(0, y0):y1, max(0, x0):x1] = 255
    nontext = cv2.bitwise_and(mask, cv2.bitwise_not(text_only))
    nontext = cv2.morphologyEx(nontext, cv2.MORPH_OPEN, np.ones((3, 3), np.uint8))
    merged = cv2.dilate(nontext, np.ones((15, 15), np.uint8))
    n, _labels, stats, _ = cv2.connectedComponentsWithStats(merged)
    out = []
    for i in range(1, n):
        x, y, w, h, area = stats[i]
        if w < min_w * W or h < min_h * H:
            continue
        # Fill ratio of real ink inside the box: skips long thin rules / table borders.
        sub = nontext[y:y + h, x:x + w]
        if (sub > 0).mean() < 0.03:
            continue
        out.extend(split_on_blank_rows(img, {"x": x / W, "y": y / H, "w": w / W, "h": h / H}, min_h))
    # Pull in text lines that overlap a picture (e.g. captions printed inside a diagram).
    for r in out:
        changed = True
        while changed:
            changed = False
            for l in page["lines"]:
                cx = l["x"] + l["w"] / 2; cy = l["y"] + l["h"] / 2
                if r["x"] <= cx <= r["x"] + r["w"] and r["y"] <= cy <= r["y"] + r["h"]:
                    nx0 = min(r["x"], l["x"]); ny0 = min(r["y"], l["y"])
                    nx1 = max(r["x"] + r["w"], l["x"] + l["w"]); ny1 = max(r["y"] + r["h"], l["y"] + l["h"])
                    if (nx0, ny0, nx1 - nx0, ny1 - ny0) != (r["x"], r["y"], r["w"], r["h"]):
                        r.update(x=nx0, y=ny0, w=nx1 - nx0, h=ny1 - ny0)
                        changed = True
    out.sort(key=lambda r: (round(r["y"], 2), r["x"]))
    return out


def detect_in_band(page: dict, y0: float, y1: float, x0: float = 0.0, x1: float = 1.0,
                   min_w: float = 0.04, min_h: float = 0.025) -> list:
    """Sensitive re-detection inside a band: light-grey objects count, the pinkish watermark does not."""
    img = cv2.imread(page["png"])
    H, W = img.shape[:2]
    b, g, r = [img[:, :, i].astype(int) for i in range(3)]
    gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
    pinkish = (r - np.minimum(g, b) > 20) & (gray > 200) & (np.abs(g - b) < 40)
    mask = (((gray < 232) & ~pinkish) | (ink_mask(img) > 0)).astype(np.uint8) * 255
    keep = np.zeros_like(mask)
    keep[int(y0 * H):int(y1 * H), int(x0 * W):int(x1 * W)] = 255
    mask = cv2.bitwise_and(mask, keep)
    for l in page["lines"]:
        if is_real_text(l) and l["t"].strip() not in ("•", "*", "-"):
            mask[max(0, int((l["y"] - 0.004) * H)):int((l["y"] + l["h"] + 0.004) * H),
                 max(0, int((l["x"] - 0.004) * W)):int((l["x"] + l["w"] + 0.004) * W)] = 0
    # Table rules would chain every cell into one sparse blob.
    rules = cv2.morphologyEx(mask, cv2.MORPH_OPEN, np.ones((1, int(0.15 * W)), np.uint8)) | \
        cv2.morphologyEx(mask, cv2.MORPH_OPEN, np.ones((int(0.15 * H), 1), np.uint8))
    mask = cv2.bitwise_and(mask, cv2.bitwise_not(cv2.dilate(rules, np.ones((3, 3), np.uint8))))
    mask = cv2.morphologyEx(mask, cv2.MORPH_OPEN, np.ones((3, 3), np.uint8))
    merged = cv2.dilate(mask, np.ones((11, 11), np.uint8))
    n, _labels, stats, _ = cv2.connectedComponentsWithStats(merged)
    out = []
    for i in range(1, n):
        x, y, w, h, _area = stats[i]
        big = w >= min_w * W and h >= min_h * H
        tall_narrow = w >= 0.015 * W and h >= 0.035 * H and h > 1.4 * w  # e.g. a ladder photo
        if (big or tall_narrow) and (mask[y:y + h, x:x + w] > 0).mean() >= 0.03:
            out.extend(split_on_blank_rows(img, {"x": x / W, "y": y / H, "w": w / W, "h": h / H}, min_h))
    out.sort(key=lambda r: (round(r["y"], 2), r["x"]))
    return out


def split_column(page: dict, y0: float, y1: float, lo: float = 0.4, hi: float = 0.6) -> float:
    """x (normalized) of the emptiest column between two side-by-side boxes."""
    img = cv2.imread(page["png"])
    H, W = img.shape[:2]
    gray = cv2.cvtColor(img[int(y0 * H):int(y1 * H), int(lo * W):int(hi * W)], cv2.COLOR_BGR2GRAY)
    ink = (gray < 225).sum(axis=0)
    return lo + float(np.argmin(ink)) / W if len(ink) else 0.5


def content_box(page: dict, x0: float, y0: float, x1: float, y1: float, pad: float = 0.006):
    """Tight box around real content (not the pale watermark) inside a normalized area, or None if empty."""
    img = cv2.imread(page["png"])
    H, W = img.shape[:2]
    a, b, c, d = int(x0 * W), int(y0 * H), int(x1 * W), int(y1 * H)
    sub = img[b:d, a:c]
    if sub.size == 0:
        return None
    bl, gr, rd = [sub[:, :, i].astype(int) for i in range(3)]
    gray = cv2.cvtColor(sub, cv2.COLOR_BGR2GRAY)
    ink = (gray < 225) & ~((rd - np.minimum(gr, bl) > 20) & (gray > 190) & (np.abs(gr - bl) < 40))
    ink = cv2.morphologyEx(ink.astype(np.uint8), cv2.MORPH_OPEN, np.ones((2, 2), np.uint8)) > 0
    ys, xs = np.where(ink)
    if len(xs) < 50:
        return None
    return {"x": max(0.0, (a + xs.min()) / W - pad), "y": max(0.0, (b + ys.min()) / H - pad),
            "w": (xs.max() - xs.min()) / W + 2 * pad, "h": (ys.max() - ys.min()) / H + 2 * pad}


def lines_outside(page: dict, regions: list) -> list:
    """OCR lines whose centre is not inside any picture region."""
    res = []
    for l in page["lines"]:
        cx = l["x"] + l["w"] / 2; cy = l["y"] + l["h"] / 2
        if not any(r["x"] <= cx <= r["x"] + r["w"] and r["y"] <= cy <= r["y"] + r["h"] for r in regions):
            res.append(l)
    return res


def crop(page: dict, r: dict, out_path: str, pad: float = 0.004, max_w: int = 1400) -> None:
    img = cv2.imread(page["png"])
    H, W = img.shape[:2]
    x0 = max(0, int((r["x"] - pad) * W)); y0 = max(0, int((r["y"] - pad) * H))
    x1 = min(W, int((r["x"] + r["w"] + pad) * W)); y1 = min(H, int((r["y"] + r["h"] + pad) * H))
    sub = img[y0:y1, x0:x1]
    if sub.shape[1] > max_w:
        s = max_w / sub.shape[1]
        sub = cv2.resize(sub, (max_w, int(sub.shape[0] * s)), interpolation=cv2.INTER_AREA)
    cv2.imwrite(out_path, sub, [cv2.IMWRITE_JPEG_QUALITY, 85] if out_path.endswith(".jpg") else [])


def similarity(a_path: str, b_path: str) -> float:
    """Rough visual similarity in [0,1] (colour thumbnails)."""
    a = cv2.resize(cv2.imread(a_path), (48, 48)).astype(np.float32)
    b = cv2.resize(cv2.imread(b_path), (48, 48)).astype(np.float32)
    return 1.0 - float(np.abs(a - b).mean()) / 255.0
