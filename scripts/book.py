"""Tests from the per-skill booklets with a real text layer (set 12): no OCR, pictures are embedded images,
listening audio comes as one clip per passage / question."""
import os
import re

import pymupdf

from doc import Pic, Row, norm, paragraphs
from parse_ws import SPEAKING_TIMES, SPEAKING_TITLES

NOISE = re.compile(r"思培|celpip\.plus|^\d{2}-\d\s*\S*(题目|答案|原文|参考)")
PART = re.compile(r"^Part\s+(\d)\s*:?\s*(.*)$")
TASK = re.compile(r"^Task\s+(\d)\s*:?\s*(.*)$")
HEADER = re.compile(r"^(\d{1,2})\s*\.\s*(.*)$")


def _clean(t: str) -> str:
    t = t.replace("\u200b", "").replace("\ufeff", "").replace("\xa0", " ")
    t = re.sub(r"\b(\d{1,2})\s*\.\s*_{2,}", r"\1. -", t)  # numbered blank in a passage
    return re.sub(r"\s*_{2,}\s*$", "", t).strip()  # blank ending a statement prompt


def text_stream(pdf: str, img_dir: str = None, prefix: str = "img", min_img: float = 0.04) -> list:
    """Ordered Row / Pic items, built from the PDF text layer and its embedded images."""
    items = []
    with pymupdf.open(pdf) as doc:
        for pi, page in enumerate(doc):
            W, H = page.rect.width, page.rect.height
            page_items, k = [], 0
            for b in page.get_text("dict")["blocks"]:
                x0, y0, x1, y1 = b["bbox"]
                if b["type"] == 1:
                    w, h = (x1 - x0) / W, (y1 - y0) / H
                    if w > 0.9 or w < min_img or h < min_img:  # full-page watermark / tiny glyphs
                        continue
                    k += 1
                    path = None
                    if img_dir:
                        os.makedirs(img_dir, exist_ok=True)
                        path = os.path.join(img_dir, f"{prefix}_p{pi + 1}_{k}.png")
                        pix = pymupdf.Pixmap(b["image"])
                        if pix.alpha or pix.n > 3:
                            pix = pymupdf.Pixmap(pymupdf.csRGB, pix)
                        pix.save(path)
                    page_items.append(Pic(pi, {"x": x0 / W, "y": y0 / H, "w": w, "h": h}, path))
                    continue
                for line in b["lines"]:
                    t = _clean("".join(s["text"] for s in line["spans"]))
                    if not t or NOISE.search(t):
                        continue
                    lx0, ly0, lx1, ly1 = line["bbox"]
                    row = Row(pi, [{"t": t, "x": lx0 / W, "y": ly0 / H, "w": (lx1 - lx0) / W, "h": (ly1 - ly0) / H}])
                    row.pdf = pdf
                    if row.text or row.bullet:
                        page_items.append(row)
            page_items.sort(key=lambda it: (round(it.y, 2), it.x))
            items.extend(page_items)
    return items


def split_sections(items: list, pattern: re.Pattern) -> dict:
    """{n: (title, items)} for 'Part N: ...' / 'Task N: ...' headings."""
    out, cur = {}, None
    for it in items:
        m = pattern.match(it.text) if it.kind == "row" else None
        if m:
            cur = int(m.group(1))
            out.setdefault(cur, (norm(m.group(2)), []))
            continue
        if cur is not None:
            out[cur][1].append(it)
    return out


def _is_header(it) -> bool:
    return it.kind == "row" and not it.bullet and HEADER.match(it.text) is not None and it.text_x < 0.17


def parse_answers(pdf: str, img_dir: str = None) -> dict:
    """{(part, num): {"text", "pics"}} from a 'Part N' / 'N. answer' key."""
    items = text_stream(pdf, img_dir=img_dir, prefix="key")
    items.sort(key=lambda it: (it.page, it.x >= 0.5, it.y))  # two columns of parts
    key, part, cur, loose = {}, None, None, []
    for it in items:
        if it.kind == "pic":  # a picture answer sits next to its otherwise empty "N." label
            if cur and not key[cur]["text"] and not key[cur]["pics"]:
                key[cur]["pics"].append(it)
            else:
                loose.append(it)
            continue
        m = PART.match(it.text)
        if m:
            part, cur = int(m.group(1)), None
            continue
        m = HEADER.match(it.text)
        if m and part and not it.bullet:
            cur = (part, int(m.group(1)))
            key[cur] = {"text": norm(m.group(2)), "pics": []}
            if not key[cur]["text"] and loose:
                key[cur]["pics"].append(loose.pop())
        elif cur:
            key[cur]["text"] = norm(key[cur]["text"] + " " + it.text)
    return key


def parse_listening(pdf: str, img_dir: str) -> dict:
    """{part: {"intro": [...], "questions": [...]}} in the shape parse_listening_booklet produces."""
    out = {}
    for n, (_, items) in split_sections(text_stream(pdf, img_dir=img_dir, prefix="listening"), PART).items():
        intro, qs, q = [], [], None
        for it in items:
            if _is_header(it):
                m = HEADER.match(it.text)
                q = {"num": int(m.group(1)), "prompt": norm(m.group(2)), "options": []}
                qs.append(q)
            elif q is None:
                if it.kind == "row":
                    intro.append(it)
            elif it.kind == "pic":
                q["options"].append({"image": it.path})
            elif it.bullet:
                q["options"].append({"text": it.text})
            elif q["options"] and "text" in q["options"][-1]:
                q["options"][-1]["text"] = norm(q["options"][-1]["text"] + " " + it.text)
            else:
                q["prompt"] = norm(q["prompt"] + " " + it.text)
        for q in qs:
            if n <= 3 or not q["prompt"]:  # parts 1-3 ask the question in the audio only
                q.pop("prompt")
        out[n] = {"intro": paragraphs(intro), "questions": qs}
    return out


def parse_reading(pdf: str, img_dir: str) -> dict:
    from parse_reading import parse_part

    out = {}
    for n, (_, items) in split_sections(text_stream(pdf, img_dir=img_dir, prefix="reading"), PART).items():
        out[n] = parse_part(n, items)
    return out


LEVEL = re.compile(r"Celpip\s*(\d+)\s*-\s*(\d+)\s*response", re.I)


def parse_writing(pdf: str, samples_pdf: str = None) -> list:
    tasks = []
    for n, (title, items) in sorted(split_sections(text_stream(pdf), TASK).items()):
        rows = [it for it in items if it.kind == "row" and not re.match(r"^Read the following", it.text)]
        survey = None
        if n == 2 and rows and not rows[0].text.rstrip().endswith((".", "?")) and len(rows[0].text.split()) <= 8:
            survey, rows = rows[0].text, rows[1:]
        k = next((i for i, r in enumerate(rows) if re.match(r"^(Write an? |Choose the option|Write about)", r.text)), len(rows))
        instr, bullets, options = [], [], []
        for r in rows[k:]:
            if re.match(r"^Option\s+[A-C]\s*:", r.text):
                options.append(r.text)
            elif r.bullet:
                bullets.append(r.text)
            elif re.match(r"^Explain the reasons for your choice", r.text) and (n == 1 or r.text in " ".join(instr)):
                continue  # repeated instruction line, or one copied from task 2 into task 1
            elif options:
                options[-1] += " " + r.text
            elif bullets:
                bullets[-1] += " " + r.text
            else:
                instr.append(r.text)
        tasks.append({"n": n, "title": title, "scenario": paragraphs(rows[:k]), "instruction": norm(" ".join(instr)),
                      "bullets": [norm(b) for b in bullets], "options": [norm(o) for o in options],
                      "surveyTitle": survey, "samples": []})
    if samples_pdf:
        samples = parse_writing_samples(samples_pdf)
        for t in tasks:
            t["samples"] = samples.get(t["n"], [])
    return tasks


def parse_writing_samples(pdf: str) -> dict:
    out, cur, level, buf = {}, None, None, []

    def flush():
        if cur is not None and level and buf:
            out.setdefault(cur, []).append({"level": level, "paragraphs": paragraphs(buf)})

    for it in text_stream(pdf):
        m = TASK.match(it.text)
        if m:
            flush(); cur, level, buf = int(m.group(1)), None, []; continue
        m = LEVEL.search(it.text)
        if m:
            flush(); level, buf = f"{m.group(1)}-{m.group(2)}", []; continue
        if level:
            buf.append(it)
    flush()
    return out


def _card(pdf: str, page: int, items: list, path: str) -> str:
    """Render the page region covering an option card (picture + title + bullets)."""
    x0 = min(it.x for it in items) - 0.01
    y0 = min(it.y for it in items) - 0.01
    x1 = max(it.x + it.w for it in items) + 0.01
    y1 = max(it.y + it.h for it in items) + 0.01
    with pymupdf.open(pdf) as doc:
        p = doc[page]
        W, H = p.rect.width, p.rect.height
        for img in p.get_images(full=True):  # drop the full-page watermark (in memory only)
            if any(r.width > 0.9 * W for r in p.get_image_rects(img[0])):
                p.delete_image(img[0])
        p.get_pixmap(dpi=150, clip=pymupdf.Rect(x0 * W, y0 * H, x1 * W, y1 * H)).save(path)
    return path


def _task5(items: list, pdf: str, img_dir: str) -> dict:
    """Prompt rows, then option cards: a picture followed by a title row and bullet rows."""
    prompt, cards = [], []
    for it in items:
        if it.kind == "pic":
            cards.append([it])
        elif not cards:
            prompt.append(it)
        else:
            cards[-1].append(it)
    paths = []
    for i, c in enumerate(cards):
        same_page = [it for it in c if it.page == c[0].page]
        paths.append(_card(pdf, c[0].page, same_page, os.path.join(img_dir, f"speaking_t5_{i + 1}.png")))
    select = paragraphs(prompt)
    m = re.search(r"persuade (an? [\w ]+?|your [\w ]+?) that", " ".join(select), re.I)
    who = m.group(1) if m else "a family member"
    persuade = f"{who[0].upper()}{who[1:]} is suggesting another option. Persuade them that the option you chose " \
               "is more suitable by comparing the two."
    return {"selectPrompt": select, "options": paths[:2], "prompt": [persuade],
            "otherOption": paths[2] if len(paths) > 2 else None, "choose": 60}


def _task6(rows: list) -> dict:
    text = norm(" ".join(r.text for r in rows))
    m = re.search(r"Choose ONE\s*:?\s*EITHER\s*(.+?)\s+OR\s+(.+)$", text)
    if not m:
        return {"prompt": paragraphs(rows), "choices": []}
    k = next(i for i, r in enumerate(rows) if "Choose ONE" in r.text)
    return {"prompt": paragraphs(rows[:k]), "choices": [m.group(1).strip(), m.group(2).strip()]}


def parse_speaking(pdf: str, img_dir: str) -> list:
    out = []
    for n, (_, items) in sorted(split_sections(text_stream(pdf, img_dir=img_dir, prefix="speaking"), TASK).items()):
        items = [it for it in items if not (it.kind == "row" and re.match(r"^(Preparation|Recording)\s*:", it.text))]
        rows = [it for it in items if it.kind == "row"]
        task = {"n": n, "title": SPEAKING_TITLES[n], "prep": SPEAKING_TIMES[n][0], "speak": SPEAKING_TIMES[n][1]}
        if n == 5:
            task.update(_task5(items, pdf, img_dir))
        elif n == 6:
            task.update(_task6(rows))
        else:
            text = paragraphs(rows)
            text = [re.sub(r"^((Answer the following question\.?|Question\s*:)\s*)+", "", p).strip() for p in text]
            task["prompt"] = [p for p in text if p]
            task["images"] = [it.path for it in items if it.kind == "pic"][:1]
        out.append(task)
    by_n = {t["n"]: t for t in out}
    if 4 in by_n and not by_n[4].get("images") and 3 in by_n:
        by_n[4]["images"] = by_n[3]["images"]
    return out
