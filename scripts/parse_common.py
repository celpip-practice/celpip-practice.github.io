"""Helpers shared by the listening / reading parsers."""
import re

from rapidfuzz import fuzz

from doc import norm
from ocr_pdf import ocr_letter, ocr_region

LISTENING_TITLES = {
    1: "Listening to Problem Solving",
    2: "Listening to a Daily Life Conversation",
    3: "Listening for Information",
    4: "Listening to a News Item",
    5: "Listening to a Discussion",
    6: "Listening for Viewpoints",
}
READING_TITLES = {
    1: "Reading Correspondence",
    2: "Reading to Apply a Diagram",
    3: "Reading for Information",
    4: "Reading for Viewpoints",
}

JUNK = r"(?:[^\w\s]{1,3}|[A-Za-z0-9]|™)"


def strip_junk(t: str) -> str:
    """Remove the stray glyph Vision reads from a drop-down arrow (e.g. 'Greg is hoping to r', '7. •')."""
    t = t.strip()
    t = re.sub(rf"\s+{JUNK}$", "", t) if not re.search(r"\s(a|I|A)$", t) else t
    t = re.sub(r"\s*[•*×™\"]+$", "", t)
    return t.strip()


def clean_option(t: str) -> str:
    t = norm(re.sub(r"^[•*·\-]\s+", "", t.strip()))
    return t


def group_options(rows: list, expected: int = 4) -> list:
    """Join wrapped option lines. Each option row usually carries a bullet; fall back on punctuation."""
    texts = [r for r in rows if r.text]
    if len(texts) == expected:
        return [clean_option(r.text) for r in texts]
    out, prev = [], None
    for r in texts:
        # A line only wraps when the previous one ran to the right margin; otherwise the radio button was missed.
        wrapped = prev is not None and prev.x + prev.w > 0.7 and r.page == prev.page
        starts_new = not out or r.bullet or not wrapped or out[-1].rstrip().endswith((".", "?", "!", ";", ","))
        if starts_new:
            out.append(r.text)
        else:
            out[-1] += " " + r.text
        prev = r
    return [clean_option(o) for o in out]


def is_noise_row(r) -> bool:
    """OCR debris among option rows: bare punctuation, or a fragment far right of the option column."""
    return not re.search(r"[A-Za-z0-9]{2}", r.text) or (not r.bullet and r.text_x > 0.3 and len(r.text) < 20)


def split_missing_headers(qs: list, expected: int = 4) -> list:
    """OCR sometimes drops a 'N.' header line, gluing two option groups onto one question.

    `qs` items are {"num", "prompt", "rows"}; a question with 2*expected option rows split by a clear
    vertical gap becomes two questions when the following number is missing.
    """
    nums = {q["num"] for q in qs}
    out = []

    def gap(a, b):
        return (b.y - (a.y + a.h)) if a.page == b.page else 1.0

    for q in qs:
        rows = [r for r in q["rows"] if r.text]
        if expected + 2 <= len(rows) <= 2 * expected and q["num"] + 1 not in nums:
            if len(rows) == 2 * expected and gap(rows[expected - 1], rows[expected]) > 0.018:
                k = expected
            else:
                k = max(range(2, len(rows) - 1), key=lambda i: gap(rows[i - 1], rows[i]))
                k = k if gap(rows[k - 1], rows[k]) > 0.035 else None
            if k:
                out.append({**q, "rows": rows[:k]})
                out.append({"num": q["num"] + 1, "prompt": [""], "rows": rows[k:]})
                nums.add(q["num"] + 1)
                continue
        out.append(q)
    return out


def best_match(text: str, options: list) -> tuple:
    """(index, score) of the option that best matches the answer-key text."""
    t = norm(text).lower()
    best = (-1, 0.0)
    for i, o in enumerate(options):
        if not isinstance(o, str):
            continue
        s = fuzz.ratio(t, o.lower())
        s = max(s, fuzz.partial_ratio(o.lower(), t) - 5 if len(o) > 8 else 0)
        if s > best[1]:
            best = (i, s)
    return best


def _words(s: str) -> list:
    return [w for w in re.split(r"\s+", s.strip()) if w]


def _canon(w: str) -> str:
    return re.sub(r"[^a-z0-9]", "", w.lower())


def parse_answer_key(stream: list, skill: str) -> dict:
    """Parse a 'Result Page' table. Returns {(part, q): {"text": str, "pics": [Pic]}}; part 0 = practice task."""
    titles = LISTENING_TITLES if skill == "Listening" else READING_TITLES
    split_x = 0.42
    cells = []  # {"part", "q", "rows": [(page, cy)], "frags": [(page, y, text)], "pics": []}
    cur = None
    template, ptr = [], 0
    frags, pics = [], []
    for it in stream:
        if it.kind == "pic":
            if it.x >= split_x - 0.05:
                pics.append(it)
            continue
        left = [l for l in it.lines if l["x"] < split_x]
        right = [l for l in it.lines if l["x"] >= split_x]
        ltext = norm(" ".join(l["t"] for l in left))
        rtext = norm(" ".join(l["t"] for l in right))
        if ltext:
            if re.match(r"^(Return to|Question$|Answer Key|Practice Test|Question Answer)", ltext):
                ltext = ""
                cur = None
            elif re.match(rf"^{skill} Practice Task", ltext):
                cur = {"part": 0, "q": 1, "rows": [], "frags": [], "pics": []}
                cells.append(cur)
                template = _words(f"{skill} Practice Task"); ptr = 0
            else:
                m = re.match(rf"^{skill}\s*Part\s+(\d)", ltext)
                if m:
                    n = int(m.group(1))
                    cur = {"part": n, "q": None, "rows": [], "frags": [], "pics": []}
                    cells.append(cur)
                    template = _words(f"{skill} Part {n}: {titles.get(n, '')} - Q#")
                    ptr = 0
            if cur is not None and ltext:
                cur["rows"].append((it.page, it.cy))
                cur.setdefault("png", getattr(it, "png", None))
                cur["lx1"] = max([cur.get("lx1", 0)] + [l["x"] + l["w"] for l in left])
                words = _words(ltext)
                i = 0
                while i < len(words) and ptr < len(template):
                    tw = template[ptr]
                    if tw == "Q#":
                        m = re.match(r"^Q(\d+)", words[i])
                        if m:
                            cur["q"] = int(m.group(1)); ptr += 1; i += 1
                            continue
                        if re.fullmatch(r"[OG06]\d", words[i]):  # garbled "Qn": number inferred below
                            ptr += 1; i += 1
                            continue
                        break
                    cw, ct = _canon(words[i]), _canon(tw)
                    if cw == ct or (not ct and not cw) or (len(ct) >= 6 and fuzz.ratio(cw, ct) >= 80):
                        ptr += 1; i += 1
                    elif not _canon(words[i]):
                        i += 1
                    else:
                        break
                rest = " ".join(words[i:])
                if rest:
                    rtext = (rest + " " + rtext).strip()
        if rtext:
            frags.append((it.page, it.y, it.cy, rtext))
    # Rows run in order; when OCR drops or garbles the "- Qn" fragment, infer n from the previous row.
    last = (None, 0)
    for c in cells:
        if c["q"] is None:
            c["q"] = last[1] + 1 if last[0] == c["part"] else 1
        last = (c["part"], c["q"])

    def nearest(page, cy):
        best, bd = None, 9
        for c in cells:
            ds = [abs(cy - y) for (p, y) in c["rows"] if p == page]
            if ds and min(ds) < bd:
                best, bd = c, min(ds)
        return best

    for (page, y, cy, t) in frags:
        c = nearest(page, cy)
        if c is not None:
            c["frags"].append((page, y, t))
    for p in pics:
        c = nearest(p.page, p.cy)
        if c is not None:
            c["pics"].append(p)
    out = {}
    for c in cells:
        text = norm(" ".join(t for (_, _, t) in sorted(c["frags"])))
        if not text and not c["pics"] and c.get("png"):
            # Vision skips some lone single-letter answers; look again at the answer column, zoomed in.
            page, ys = c["rows"][0][0], [y for (p, y) in c["rows"] if p == c["rows"][0][0]]
            x0 = max(split_x, c.get("lx1", 0) + 0.01)
            text = ""
            if skill == "Reading" and c["part"] == 3:  # paragraph answers are a lone letter A-E
                text = ocr_letter(c["png"], x0, min(ys) - 0.009, 0.98, max(ys) + 0.009)
                text = text if text in "ABCDE" else ""
            for scale, dy in ((3, 0.009), (4, 0.009), (3, 0.012)):
                if text:
                    break
                text = norm(ocr_region(c["png"], x0, min(ys) - dy, 0.98, max(ys) + dy, scale=scale))
        out[(c["part"], c["q"])] = {"text": text, "pics": c["pics"]}
    return out
