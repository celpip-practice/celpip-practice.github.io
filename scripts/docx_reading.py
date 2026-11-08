"""Reading tests saved from the online practice site as Word documents (set 11): no part headings, '▾' marks
each drop-down, options are list paragraphs, the Part 2 diagram is the embedded picture.
Answers come as screenshots of the results table ('Reading Part N: ... - Qk | answer')."""
import os
import re

import docx

from doc import norm
from ocr_pdf import ocr_image, ocr_letter

NS = {"w": "http://schemas.openxmlformats.org/wordprocessingml/2006/main",
      "a": "http://schemas.openxmlformats.org/drawingml/2006/main",
      "r": "http://schemas.openxmlformats.org/officeDocument/2006/relationships"}
BLANK = "▾"
NUMBERED = re.compile(rf"^(?:{BLANK}\s*-\s*)?(\d{{1,2}})\s*\.\s*(.+?)\s*{BLANK}?\s*$")
INTRO = {
    1: ("Read the following message.",
        "Choose the best option according to the information given in the message.",
        "Here is a response to the message. Complete the response by filling in the blanks. "
        "Select the best choice for each blank from the drop-down menu."),
    2: ("Read the following diagram and email message.",
        "Choose the best option according to the information given in the diagram and email.",
        "Read the following email message about the diagram on the left. Complete the email by filling in the "
        "blanks. Select the best choice for each blank from the drop-down menu."),
    3: ("Read the following passage.",
        "Decide which paragraph, A to D, has the information given in each statement below. "
        "Select E if the information is not given in any of the paragraphs.", None),
    4: ("Read the following article.",
        "Choose the best option according to the information given in the article.",
        "The following is a comment by a visitor to the website. Complete the comment by choosing the best "
        "option to fill in each blank."),
}


def _paragraphs(path: str, img_dir: str, prefix: str) -> list:
    """[(kind, value)]: ('text', str) / ('bullet', str) / ('sep', None) / ('img', path), in document order."""
    d = docx.Document(path)
    out, k = [], 0
    for p in d.paragraphs:
        for blip in p._p.findall(".//a:blip", NS):
            rid = blip.get(f"{{{NS['r']}}}embed")
            part = d.part.related_parts.get(rid)
            if part is None:
                continue
            k += 1
            ext = os.path.splitext(part.partname)[1] or ".png"
            dst = os.path.join(img_dir, f"{prefix}_{k}{ext}")
            os.makedirs(img_dir, exist_ok=True)
            with open(dst, "wb") as f:
                f.write(part.blob)
            out.append(("img", dst))
        t = norm(p.text.replace("\xa0", " "))
        if p._p.find(".//w:numPr", NS) is not None:
            out.append(("bullet", t) if t else ("sep", None))
        elif t:
            out.append(("text", t))
        else:
            out.append(("sep", None))
    return out


def _tokens(paras: list) -> list:
    """('text', s) / ('img', p) / ('q', num, prompt, options) / ('group', options) / ('stmt', num, s)."""
    toks, i = [], 0
    while i < len(paras):
        kind, val = paras[i]
        if kind == "bullet":
            opts = []
            while i < len(paras) and paras[i][0] == "bullet":
                opts.append(paras[i][1]); i += 1
            last = toks[-1] if toks else None
            if last and last[0] == "numbered":
                toks[-1] = ("q", last[1], last[2], opts)
            else:
                toks.append(("group", opts))
            continue
        if kind == "text":
            m = NUMBERED.match(val)
            toks.append(("numbered", int(m.group(1)), m.group(2)) if m else ("text", val))
        elif kind == "img":
            toks.append(("img", val))
        i += 1
    return [("stmt", t[1], t[2]) if t[0] == "numbered" else t for t in toks]


def _take(toks: list, i: int, kind: str) -> tuple:
    out = []
    while i < len(toks) and toks[i][0] == kind:
        out.append(toks[i]); i += 1
    return out, i


def _until(toks: list, i: int, kinds: tuple) -> tuple:
    out = []
    while i < len(toks) and toks[i][0] not in kinds:
        out.append(toks[i]); i += 1
    return out, i


def _questions(qs: list) -> list:
    return [{"num": q[1], "prompt": q[2], "options": [{"text": o} for o in q[3]]} for q in qs]


def _short(t: tuple) -> bool:
    return t[0] == "text" and BLANK not in t[1] and len(t[1]) < 60


def _cloze(texts: list, toks: list, i: int, first: int, n: int) -> tuple:
    """Blank options follow the text in fours, but list formatting is unreliable: an option may be a plain
    paragraph and adjacent groups may run together. Collect 4 options per blank, then regroup."""
    texts = list(texts)
    need = 4 * sum(t[1].count(BLANK) for t in texts if t[0] == "text")
    opts = []
    while i < len(toks) and len(opts) < need and (toks[i][0] == "group" or _short(toks[i])):
        opts += toks[i][1] if toks[i][0] == "group" else [toks[i][1]]
        i += 1
    while len(opts) < need and texts and _short(texts[-1]):
        opts.insert(0, texts.pop()[1])
    opts = [o.lstrip(". ") for o in opts]
    num = iter(range(first, first + need // 4))
    paras = [re.sub(BLANK, lambda _m: f"{{{{{next(num)}}}}}", t[1]) for t in texts if t[0] == "text"]
    items = [{"num": first + k, "prompt": "", "options": [{"text": o} for o in opts[4 * k: 4 * k + 4]]}
             for k in range(need // 4)]
    return {"type": "cloze", "intro": INTRO[n][2], "paragraphs": paras, "items": items}, i


def parse_reading(path: str, img_dir: str) -> dict:
    toks = _tokens(_paragraphs(path, img_dir, "reading"))
    parts, i = {}, 0
    # Part 1: letter, questions, reply with blanks, blank options.
    passage, i = _until(toks, i, ("q",))
    qs, i = _take(toks, i, "q")
    reply, i = _until(toks, i, ("group",))
    cloze, i = _cloze(reply, toks, i, qs[-1][1] + 1 if qs else 1, 1)
    parts[1] = {"left": [{"type": "text", "paragraphs": [t[1] for t in passage if t[0] == "text"]}],
                "right": [{"type": "questions", "intro": INTRO[1][1], "style": "dropdown", "items": _questions(qs)},
                          cloze]}
    # Part 2: diagram, email with blanks, blank options, questions.
    email, i = _until(toks, i, ("group",))
    cloze, i = _cloze(email, toks, i, 1, 2)
    qs, i = _take(toks, i, "q")
    left = [{"type": "image", "src": t[1]} for t in email if t[0] == "img"]
    parts[2] = {"left": left, "right": [cloze, {"type": "questions", "intro": INTRO[2][1], "style": "dropdown",
                                                "items": _questions(qs)}]}
    # Part 3: paragraphs A-E, statements.
    paras, i = _until(toks, i, ("stmt",))
    stmts, i = _take(toks, i, "stmt")
    parts[3] = {"left": [{"type": "text", "intro": INTRO[3][0], "paragraphs": [t[1] for t in paras if t[0] == "text"]}],
                "right": [{"type": "questions", "intro": INTRO[3][1], "style": "paragraph",
                           "items": [{"num": s[1], "prompt": s[2], "options": list("ABCDE")} for s in stmts]}]}
    # Part 4: article, questions, comment with blanks, blank options.
    article, i = _until(toks, i, ("q",))
    qs, i = _take(toks, i, "q")
    comment, i = _until(toks, i, ("group",))
    cloze, i = _cloze(comment, toks, i, qs[-1][1] + 1 if qs else 1, 4)
    parts[4] = {"left": [{"type": "text", "paragraphs": [t[1] for t in article if t[0] == "text"]}],
                "right": [{"type": "questions", "intro": INTRO[4][1], "style": "dropdown", "items": _questions(qs)},
                          cloze]}
    return parts


def _cell_letter(png: str, x0: float, y0: float, x1: float, y1: float) -> str:
    """A lone grey letter in a small screenshot: upscale, binarize, tile it three times, OCR, majority vote."""
    import cv2
    import numpy as np
    from collections import Counter

    img = cv2.imread(png, cv2.IMREAD_GRAYSCALE)
    H, W = img.shape[:2]
    cell = img[max(0, int(y0 * H)):int(y1 * H), max(0, int(x0 * W)):int(x1 * W)]
    cell = cv2.resize(cell, None, fx=8, fy=8, interpolation=cv2.INTER_CUBIC)
    _, bw = cv2.threshold(cell, 0, 255, cv2.THRESH_BINARY + cv2.THRESH_OTSU)
    ys, xs = np.where(bw == 0)
    if len(xs) < 20:
        return ""
    glyph = bw[ys.min():ys.max() + 1, xs.min():xs.max() + 1]
    h = glyph.shape[0]
    gap = np.full((h, max(8, h // 2)), 255, np.uint8)
    tiled = cv2.copyMakeBorder(np.hstack([glyph, gap, glyph, gap, glyph]), h, h, h, h, cv2.BORDER_CONSTANT, value=255)
    tmp = os.path.splitext(png)[0] + "_cell.png"
    cv2.imwrite(tmp, tiled)
    try:
        text = " ".join(l["t"] for l in ocr_image(tmp)["lines"])
    finally:
        os.remove(tmp)
    letters = re.findall(r"[A-E]", text.upper())
    return Counter(letters).most_common(1)[0][0] if letters else ""


QNUM = re.compile(r"^[Q0O]?\s*(\d{1,2})\b\W*")  # Vision reads "Q5" as "05"


def parse_answer_screens(pngs: list, work_dir: str) -> dict:
    """{(part, num): {"text", "pics"}} from screenshots of the results table. A row is
    'Reading Part N: <title> - Qk | answer'; long titles wrap 'Qk' onto a second line, Vision often merges the
    label and answer cells, and it skips lone answer letters (Part 3)."""
    key, counters = {}, {}
    os.makedirs(work_dir, exist_ok=True)
    for src in pngs:
        png = os.path.join(work_dir, os.path.basename(src))  # ocr_letter writes scratch files next to the image
        with open(src, "rb") as f, open(png, "wb") as g:
            g.write(f.read())
        lines = sorted(ocr_image(png)["lines"], key=lambda l: (l["y"], l["x"]))
        rows = [l for l in lines if re.search(r"Reading Part\s*\d", l["t"])]
        label_x1 = max((l["x"] + l["w"] for l in rows if not re.search(r" - \S", l["t"])), default=0.3)
        answer_x = min((l["x"] for l in lines if l["x"] > 0.3 and l not in rows), default=label_x1 + 0.01)
        cy = lambda l: l["y"] + l["h"] / 2
        cells = {}  # each answer cell belongs to its nearest label row (cells may sit a little above or below)
        for l in lines:
            if l["x"] >= answer_x - 0.01 and l not in rows and rows and not re.match(r"(Answer Key|Your Answer)", l["t"]):
                near = min(rows, key=lambda r: abs(cy(r) - cy(l)))
                if abs(cy(near) - cy(l)) < 0.03:
                    cells.setdefault(id(near), []).append(l)
        for r_i, lab in enumerate(rows):
            part = int(re.search(r"Part\s*(\d)", lab["t"]).group(1))
            rest = lab["t"].split(" - ", 1)[1] if " - " in lab["t"] else ""
            num = None
            m = QNUM.match(rest)
            if m:
                num, rest = int(m.group(1)), rest[m.end():]
            else:  # 'Qk' wrapped onto the next line
                nxt = next((l for l in lines if 0 < l["y"] - lab["y"] < 0.08 and abs(l["x"] - lab["x"]) < 0.02
                            and re.fullmatch(r"[Q0O]?\s*\d{1,2}\W*", l["t"].strip())), None)
                if nxt:
                    num = int(QNUM.match(nxt["t"].strip()).group(1))
            num = num or counters.get(part, 0) + 1
            counters[part] = num
            text = rest.strip()
            if not text and cells.get(id(lab)):
                text = min(cells[id(lab)], key=lambda l: (abs(cy(l) - cy(lab)), l["x"]))["t"]
            if not text and part == 3:
                box = (answer_x - 0.01, lab["y"] - 0.002, answer_x + 0.08, lab["y"] + lab["h"] + 0.002)
                text = ocr_letter(png, *box) or _cell_letter(png, *box)
            if text:
                key[(part, num)] = {"text": norm(text), "pics": []}
    return key
