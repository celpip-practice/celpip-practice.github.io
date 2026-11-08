"""Turn OCR'd PDF pages into an ordered stream of text rows and picture items."""
import os
import re

from images import crop, detect_in_band, detect_regions, is_real_text
from ocr_pdf import ocr_pdf

BULLETS = "•*·●▪"


def norm(t: str) -> str:
    t = t.replace("’", "'").replace("‘", "'").replace("“", '"').replace("”", '"').replace("—", "-").replace("–", "-")
    t = re.sub(r"(\w)\s*'\s+(t|s|ll|re|ve|d|m)\b", r"\1'\2", t)
    t = re.sub(r"(\w) '(t|s|ll|re|ve|d|m)\b", r"\1'\2", t)
    t = re.sub(r"\s+([,.;:?!])(\s|$)", r"\1\2", t)
    t = re.sub(r"\s{2,}", " ", t)
    return t.strip()


class Row:
    """A visual row of text: one or more OCR lines with overlapping vertical centres."""

    def __init__(self, page: int, lines: list):
        lines = sorted(lines, key=lambda l: l["x"])
        self.page = page
        self.lines = lines
        self.x = lines[0]["x"]
        self.y = min(l["y"] for l in lines)
        self.h = max(l["y"] + l["h"] for l in lines) - self.y
        self.right = max(l["x"] + l["w"] for l in lines)
        raw = " ".join(l["t"] for l in lines)
        self.bullet = bool(re.match(rf"^\s*[{BULLETS}]", raw))
        # x where the actual words start (after any bullet glyph).
        first_text = next((l for l in lines if l["t"].strip() and l["t"].strip() not in BULLETS), lines[0])
        self.text_x = first_text["x"] + (0.02 if first_text["t"].lstrip()[:1] in BULLETS else 0)
        self.text = norm(re.sub(rf"^\s*[{BULLETS}]+\s*", "", raw))
        self.kind = "row"

    @property
    def cy(self):
        return self.y + self.h / 2

    @property
    def w(self):
        return self.right - self.x

    def __repr__(self):
        return f"<Row p{self.page} y={self.y:.3f} x={self.x:.3f}{' •' if self.bullet else ''} {self.text!r}>"


class Pic:
    def __init__(self, page: int, region: dict, path: str):
        self.page = page
        self.region = region
        self.x, self.y, self.w, self.h = region["x"], region["y"], region["w"], region["h"]
        self.path = path
        self.kind = "pic"

    @property
    def cy(self):
        return self.y + self.h / 2

    def __repr__(self):
        return f"<Pic p{self.page} y={self.y:.3f} x={self.x:.3f} {os.path.basename(self.path or '-')}>"


def _absorb_captions(page: dict, regions: list) -> None:
    """Grow picture regions downward over small caption text printed right under them (e.g. option cards)."""
    lines = sorted((l for l in page["lines"] if is_real_text(l)), key=lambda l: l["y"])
    for r in regions:
        grown = True
        while grown:
            grown = False
            bottom = r["y"] + r["h"]
            for l in lines:
                if l["y"] < bottom - 0.002:
                    continue
                if l["y"] - bottom > 0.022:
                    break
                if l["x"] >= r["x"] - 0.06 and l["x"] + l["w"] <= r["x"] + r["w"] + 0.06 and l["h"] < 0.014:
                    r["h"] = l["y"] + l["h"] - r["y"]
                    grown = True
                    break


def merge_fragments(regions: list, hgap: float, vgap: float = 0.0) -> list:
    """Union regions that sit side by side on one row (a picture split apart by text erasure)."""
    rs = [dict(r) for r in regions]
    merged = True
    while merged:
        merged = False
        for i in range(len(rs)):
            for j in range(i + 1, len(rs)):
                a, b = rs[i], rs[j]
                dx = max(a["x"], b["x"]) - min(a["x"] + a["w"], b["x"] + b["w"])
                dy = max(a["y"], b["y"]) - min(a["y"] + a["h"], b["y"] + b["h"])
                if dx <= hgap and dy <= vgap:
                    x, y = min(a["x"], b["x"]), min(a["y"], b["y"])
                    a.update(x=x, y=y, w=max(a["x"] + a["w"], b["x"] + b["w"]) - x, h=max(a["y"] + a["h"], b["y"] + b["h"]) - y)
                    rs.pop(j)
                    merged = True
                    break
            if merged:
                break
    return sorted(rs, key=lambda r: (r["y"], r["x"]))


def build_stream(pdf: str, img_dir: str = None, img_prefix: str = "img", min_w=0.08, min_h=0.05,
                 columns: list = None, captions: bool = False, pictures: bool = True, merge_hgap: float = None) -> list:
    """Return ordered items (Row / Pic). `columns` = x split points: stream each column separately per page."""
    pages = ocr_pdf(pdf)
    items = []
    for pi, page in enumerate(pages):
        regions = detect_regions(page, min_w=min_w, min_h=min_h) if pictures else []
        if merge_hgap is not None:
            regions = merge_fragments(regions, merge_hgap)
            # Pale pictures (e.g. a white blouse) are invisible to the normal ink mask.
            overlaps = lambda a, b: not (a["x"] > b["x"] + b["w"] or b["x"] > a["x"] + a["w"] or
                                         a["y"] > b["y"] + b["h"] or b["y"] > a["y"] + a["h"])
            light = merge_fragments(detect_in_band(page, 0, 1, min_w=min_w, min_h=min_h), merge_hgap)
            regions = sorted(regions + [r for r in light if not any(overlaps(r, o) for o in regions)],
                             key=lambda r: (r["y"], r["x"]))
        if captions:
            _absorb_captions(page, regions)
        in_region = lambda l: any(r["x"] <= l["x"] + l["w"] / 2 <= r["x"] + r["w"] and r["y"] <= l["y"] + l["h"] / 2 <= r["y"] + r["h"] for r in regions)
        lines = [l for l in page["lines"] if is_real_text(l) and not in_region(l)]
        page_items = []
        for ri, r in enumerate(regions):
            path = None
            if img_dir:
                os.makedirs(img_dir, exist_ok=True)
                path = os.path.join(img_dir, f"{img_prefix}_p{pi + 1}_{ri + 1}.jpg")
                crop(page, r, path)
            page_items.append(Pic(pi, r, path))
        bounds = [0.0] + (columns or []) + [1.01]
        for ci in range(len(bounds) - 1):
            col = [l for l in lines if bounds[ci] <= l["x"] < bounds[ci + 1]]
            col.sort(key=lambda l: l["y"] + l["h"] / 2)
            rows, cur = [], []
            for l in col:
                c = l["y"] + l["h"] / 2
                if cur and abs(c - (cur[-1]["y"] + cur[-1]["h"] / 2)) > 0.007:
                    rows.append(cur); cur = []
                cur.append(l)
            if cur:
                rows.append(cur)
            for r in rows:
                row = Row(pi, r)
                row.col = ci
                row.png = page["png"]
                if row.text or row.bullet:
                    page_items.append(row)
        if columns:
            page_items.sort(key=lambda it: (getattr(it, "col", 0), it.y))
        else:
            page_items.sort(key=lambda it: it.y)
        items.extend(page_items)
    # Lone bullet glyph rows mark the next/previous text row as a bullet item.
    out = []
    for i, it in enumerate(items):
        if it.kind == "row" and not it.text and it.bullet:
            continue
        out.append(it)
    for i, it in enumerate(items):
        if it.kind == "row" and not it.text and it.bullet:
            near = [o for o in out if o.kind == "row" and o.page == it.page and abs(o.cy - it.cy) < 0.009 and o.x > it.x]
            if near:
                near[0].bullet = True
    return out


def paragraphs(rows: list, gap: float = 0.0135) -> list:
    """Group consecutive rows into paragraphs using vertical gaps."""
    paras, cur, prev = [], [], None
    maxw = max((r.w for r in rows), default=1)
    header = re.compile(r"^(Subject|To|From|Date|Re)\s*:", re.I)
    for r in rows:
        if prev is not None:
            new = False
            if r.page != prev.page:
                new = prev.w < 0.8 * maxw and prev.text.rstrip().endswith((".", "!", "?", ":", '"'))
            elif r.y - (prev.y + prev.h) > gap:
                new = True
            # Salutations / sign-offs / email headers sit on their own line.
            if header.match(r.text) or header.match(prev.text):
                new = True
            if prev.w < 0.45 * maxw and prev.text.rstrip().endswith(",") and len(prev.text.split()) <= 4:
                new = True
            if new and cur:
                paras.append(" ".join(cur)); cur = []
        cur.append(r.text)
        prev = r
    if cur:
        paras.append(" ".join(cur))
    return [norm(p) for p in paras if p.strip()]
