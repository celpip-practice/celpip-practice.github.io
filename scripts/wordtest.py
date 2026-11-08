"""Tests shipped entirely as Word documents (set 13): question + explanation documents in Chinese and English,
writing prompts as screenshots of the test screen, one audio clip per listening passage and question.

The explanation documents (解析) interleave the English test with Chinese translations and explanations; every
line containing Chinese is dropped to recover the test, and the explanations are kept only to cross-check the
hand-verified answer key in data/set13_key.json."""
import glob
import json
import os
import re

import docx
import pymupdf
from docx.text.paragraph import Paragraph

from doc import norm
from ocr_pdf import ocr_image
from parse_ws import SPEAKING_TIMES, SPEAKING_TITLES

NS_BLIP = "{http://schemas.openxmlformats.org/drawingml/2006/main}blip"
NS_EMBED = "{http://schemas.openxmlformats.org/officeDocument/2006/relationships}embed"
CJK = re.compile(r"[\u3400-\u9fff\uff00-\uffef\u3000-\u303f]")
KEY_FILE = os.path.join(os.path.dirname(os.path.abspath(__file__)), "data", "set13_key.json")


def lines(path: str, img_dir: str = None, prefix: str = "img") -> list:
    """[('text', s) | ('img', path)] in body order; empty paragraphs dropped."""
    d = docx.Document(path)
    out, k = [], 0
    for el in d.element.body.iterchildren():
        if not el.tag.endswith("}p"):
            continue
        for blip in el.findall(f".//{NS_BLIP}"):
            part = d.part.related_parts.get(blip.get(NS_EMBED))
            if part is None or not img_dir:
                continue
            k += 1
            os.makedirs(img_dir, exist_ok=True)
            dst = os.path.join(img_dir, f"{prefix}_{k}{os.path.splitext(part.partname)[1] or '.png'}")
            with open(dst, "wb") as f:
                f.write(part.blob)
            out.append(("img", dst))
        for t in Paragraph(el, d).text.replace("\xa0", " ").replace("\u200b", "").split("\n"):
            t = norm(t)
            if t:
                out.append(("text", t))
    return out


def _answer_from_explanation(expl: list, options: list = None, letters: bool = False):
    """0-based option the explanation names as correct, or None when it does not say."""
    for t in expl:
        if letters:
            m = re.search(r"正确答案[^A-E]{0,6}([A-E])\s*段|^([A-E])\s*段(?:最能支持|直接回应)|选项\s*([A-E])\s*是正确答案"
                          r"|答案\s*[:：]\s*([A-E])\b", t)
            if m:
                return "ABCDE".index(next(g for g in m.groups() if g))
        elif "确答案" in t:
            m = re.search(r"第\s*([1-4])\s*项", t)
            if m:
                return int(m.group(1)) - 1
    if letters or not options:
        return None
    # otherwise the first option quoted in a line that is not itself a per-option note ('<option>: ...')
    texts = [o.rstrip(".").lower() for o in options]
    for t in expl:
        low = t.lower()
        if any(low.startswith(o) for o in texts) or re.match(r"^第\s*\d\s*项", t):
            continue
        hits = sorted((low.find(o), i) for i, o in enumerate(texts) if o and o in low)
        if hits:
            return hits[0][1]
    return None


def _complete(text: str, expl: list) -> str:
    """Options cut off mid-word in the source ('cancelling your chequ') are quoted in full by the explanation."""
    m = re.search(rf"{re.escape(text)}[A-Za-z]{{1,6}}\b", " ".join(expl)) if text and text[-1].isalpha() else None
    return m.group(0) if m else text


def blanks_to_tokens(paras: list, nums: list) -> list:
    """'I am 7.       about' -> 'I am {{7}} about', in order. Word documents have no OCR glyphs to strip."""
    text, pos = "\n\n".join(paras), 0
    for n in nums:
        m = re.compile(rf"(?<![\w$.@]){n}\.[ \t]*").search(text, pos)
        if not m:
            raise ValueError(f"cloze blank {n} not found")
        token = f"{{{{{n}}}}}" + (" " if text[m.end():m.end() + 1].isalnum() else "")
        text = text[:m.start()] + token + text[m.end():]
        pos = m.start() + len(token)
    return [re.sub(r"\}\}\s+([.,;:!?])", r"}}\1", p).strip() for p in text.split("\n\n")]


def load_key(test_id: str) -> tuple:
    """({('L'|'R', part, num): 0-based answer}, {(...): note on answers the explanation gets wrong or omits},
    [[old, new]] text fixes for words the source cut off)."""
    if not os.path.exists(KEY_FILE):
        return {}, {}, []
    with open(KEY_FILE) as f:
        data = json.load(f).get(test_id, {})
    key, notes = {}, {}
    for part, answers in data.get("answers", {}).items():
        skill, n = part[0], int(part[1:])
        for i, a in enumerate(answers):
            key[(skill, n, i + 1)] = "ABCDE".index(a) if isinstance(a, str) else a - 1
    for k, note in data.get("notes", {}).items():
        m = re.match(r"^([LR])(\d)-(\d+)$", k)
        notes[(m.group(1), int(m.group(2)), int(m.group(3)))] = note
    return key, notes, data.get("fixes", [])


def apply_fixes(obj, fixes: list):
    """Replace whole strings equal to a fix, or longer strings containing a distinctive (12+ chars) one."""
    if isinstance(obj, dict):
        return {k: apply_fixes(v, fixes) for k, v in obj.items()}
    if isinstance(obj, list):
        return [apply_fixes(v, fixes) for v in obj]
    if isinstance(obj, str):
        for old, new in fixes:
            if obj == old:
                return new
            if len(old) >= 12 and old in obj:
                obj = obj.replace(old, new)
    return obj


# ---------------------------------------------------------------- listening

LISTEN_HDR = re.compile(r"^Listening-(\d)$")
PART_HDR = re.compile(r"^(?:Listening\s+)?Part\s*(\d)\s*:\s*(.*)$")
SECTION = re.compile(r"^Section\s*(\d)\s*:?$")
NOW = re.compile(r"^Now answer questions?\b", re.I)
QHDR = re.compile(r"^Question\s+(\d+)\s+of\s+\d+$")
NUMSTEM = re.compile(r"^(\d{1,2})\s*\.\s*(\S.*)$")
CHOOSE = re.compile(r"^C?hoose the best", re.I)


def parse_listening(path: str, img_dir: str) -> dict:
    """{part: {"intro": [...], "sections": [{"transcript", "questions": [{num, stem, options, expl}]}]}}."""
    parts, part, q, mode = {}, None, None, None
    for kind, val in lines(path, img_dir, "listening"):
        if kind == "img":
            if q is not None and mode == "options":
                q["options"].append({"image": val})
            continue
        m = LISTEN_HDR.match(val)
        if m:
            part = parts.setdefault(int(m.group(1)), {"intro": [], "sections": [], "stems": {}})
            q, mode = None, None
            continue
        if part is None or val == "听力原文：":
            continue
        n = next(k for k, v in parts.items() if v is part)
        m = PART_HDR.match(val)
        if m:
            intro = re.search(r"\bYou will (hear|watch)\b.*$", m.group(2))
            if intro:
                part["intro"].append(intro.group(0))
            if n > 1:
                part["sections"].append({"transcript": [], "questions": []})
            mode = "transcript"
            continue
        if re.match(r"^You will (hear|watch)\b", val) and mode in (None, "transcript") and not \
                (part["sections"] and part["sections"][-1]["transcript"]):
            part["intro"].append(val)
            continue
        m = SECTION.match(val)
        if m:
            part["sections"].append({"transcript": [], "questions": []})
            mode = "transcript"
            continue
        if NOW.match(val):
            mode = "stems"
            continue
        if mode == "stems":
            m = NUMSTEM.match(val)
            if m:
                part["stems"][int(m.group(1))] = m.group(2)
                continue
        if CHOOSE.match(val):
            continue
        m = QHDR.match(val)
        if m or (n >= 4 and NUMSTEM.match(val) and not CJK.search(val) and mode != "options"):
            num = int(m.group(1)) if m else int(NUMSTEM.match(val).group(1))
            if not part["sections"]:
                part["sections"].append({"transcript": [], "questions": []})
            q = {"num": num, "stem": part["stems"].get(num) or (None if m else NUMSTEM.match(val).group(2)),
                 "options": [], "expl": []}
            part["sections"][-1]["questions"].append(q)
            mode = "stem" if (m and n >= 4) else "options"
            continue
        if val.startswith("解析"):
            mode = "expl"
            continue
        if mode == "stem":
            q["stem"], mode = val, "options"
        elif mode == "options" and not CJK.search(val):
            q["options"].append({"text": val})
        elif mode == "expl" and CJK.search(val):
            q["expl"].append(val)
        elif mode == "transcript" and part["sections"]:
            part["sections"][-1]["transcript"].append(val)
    for p in parts.values():
        p.pop("stems")
        for s in p["sections"]:
            for q in s["questions"]:
                q["options"] = [{"text": _complete(o["text"], q["expl"])} if "text" in o else o for o in q["options"]]
                q["explAnswer"] = _answer_from_explanation(q.pop("expl"), [o.get("text", "") for o in q["options"]])
    return parts


def listening_clips(audio_dir: str) -> dict:
    """{part: {"passages": [path per section], "questions": {num: path}, "passage": path}} from
    'Listening 1_Section2.mp3' / 'Listening 1_Section2_4.mp3' / 'Listening 3_5.mp3' / 'Listening 5.mp4'."""
    out = {}
    for f in sorted(glob.glob(os.path.join(audio_dir, "Listening *"))):
        name = os.path.splitext(os.path.basename(f))[0]
        m = re.match(r"^Listening (\d)(?:_Section(\d))?(?:_(\d+))?$", name)
        if not m:
            continue
        n, sec, num = int(m.group(1)), m.group(2), m.group(3)
        c = out.setdefault(n, {"passages": {}, "questions": {}, "passage": None})
        if num:
            c["questions"][int(num)] = f
        elif sec:
            c["passages"][int(sec)] = f
        else:
            c["passage"] = f
    return out


# ---------------------------------------------------------------- reading

READ_INTRO = {
    1: ("Read the following message.", "Choose the best option according to the information given in the message.",
        "Here is a response to the message. Complete the response by filling in the blanks. "
        "Select the best choice for each blank from the drop-down menu."),
    2: ("Read the following diagram and email message.",
        "Choose the best option according to the information given in the diagram and email.",
        "Read the following email message about the diagram on the left. Complete the email by filling in the "
        "blanks. Select the best choice for each blank from the drop-down menu."),
    3: ("Read the following passage.", "Decide which paragraph, A to D, has the information given in each "
        "statement below. Select E if the information is not given in any of the paragraphs.", None),
    4: ("Read the following article.", "Choose the best option according to the information given in the article.",
        "The following is a comment by a visitor to the website. Complete the comment by choosing the best "
        "option to fill in each blank."),
}
RNUM = re.compile(r"^(\d{1,2})\s*\.?\s*(.*)$")


def _english(items: list) -> list:
    """Drop translations/explanations (any line with Chinese) and the duplicates they leave behind:
    a repeated passage block, a signature repeated after its translation, bare 'A.' translation headings."""
    out, seen, expl = [], set(), {}
    for kind, val in items:
        if kind == "text" and CJK.search(val):
            if out and out[-1][0] == "text":
                expl.setdefault(len(out) - 1, []).append(val)
            continue
        if kind == "text":
            if re.match(r"^[A-E]\.$", val) or (out and out[-1] == (kind, val) and not re.match(r"^[A-E]$", val)):
                continue
            if len(val) > 60 and val in seen:
                continue
            seen.add(val)
        out.append((kind, val))
    return out, expl


def _is_q(val: str) -> bool:
    return bool(re.match(r"^\d{1,2}\s*\.", val)) or bool(re.match(r"^\d{1,2}$", val))


def _blocks(items: list, expl: dict, start: int, end: int, letters: bool = False) -> list:
    """Split items[start:end] into ('text', s) / ('img', p) / ('q', num, prompt, options, expl_answer)."""
    out, i = [], start
    while i < end:
        kind, val = items[i]
        if kind == "text" and _is_q(val):
            m = RNUM.match(val)
            num, prompt = int(m.group(1)), m.group(2).strip()
            opts, j = [], i + 1
            want = 5 if letters else 4
            while j < end and len(opts) < want and items[j][0] == "text" and not _is_q(items[j][1]):
                opts.append(items[j][1]); j += 1
            if not prompt and not letters and len(opts) > 4:
                prompt, opts = opts[0], opts[1:]
            explained = []
            for k in range(i, j):
                explained += expl.get(k, [])
            opts = [_complete(o, explained) for o in opts]
            out.append(("q", num, prompt, opts, _answer_from_explanation(explained, opts, letters)))
            i = j
            continue
        out.append((kind, val) if kind == "img" else ("text", val))
        i += 1
    return out


def parse_reading(path: str, img_dir: str) -> tuple:
    """(booklet in the docx_reading.parse_reading shape, {(part, num): explanation answer})."""
    items, expl = _english(lines(path, img_dir, "reading"))
    img = next(i for i, it in enumerate(items) if it[0] == "img")
    p3 = next(i for i in range(img, len(items)) if items[i][0] == "text" and re.match(r"^A\.\s+\S", items[i][1]))
    stmts_end = p3
    while stmts_end < len(items) and re.match(r"^([A-E]\.\s|[A-E]$|\d{1,2}\s*\.)", items[stmts_end][1]):
        stmts_end += 1
    parts, answers = {}, {}

    def record(n, qs):
        for q in qs:
            answers[(n, q[1])] = q[4]

    def questions(qs, n):
        return {"type": "questions", "intro": READ_INTRO[n][1], "style": "dropdown",
                "items": [{"num": q[1], "prompt": q[2], "options": q[3]} for q in qs]}

    def cloze(texts, qs, n):
        return {"type": "cloze", "intro": READ_INTRO[n][2], "paragraphs": blanks_to_tokens(texts, [q[1] for q in qs]),
                "items": [{"num": q[1], "prompt": "", "options": q[3]} for q in qs]}

    def split(blocks):
        """passage texts, first question run, texts after it, second question run."""
        groups, cur = [], []
        for b in blocks:
            if cur and (b[0] == "q") != (cur[-1][0] == "q"):
                groups.append(cur); cur = []
            cur.append(b)
        groups.append(cur)
        return groups

    for n, (a, b) in ((1, (0, img)), (4, (stmts_end, len(items)))):
        g = split(_blocks(items, expl, a, b))
        passage, qs, reply, blanks = [x[1] for x in g[0]], g[1], [x[1] for x in g[2]], g[3]
        record(n, qs + blanks)
        parts[n] = {"left": [{"type": "text", "paragraphs": passage}],
                    "right": [questions(qs, n), cloze(reply, blanks, n)]}
    g = split(_blocks(items, expl, img, p3))
    email, run = g[0], [b for grp in g[1:] for b in grp if b[0] == "q"]
    blanks, qs = [b for b in run if not b[2]], [b for b in run if b[2]]
    record(2, blanks + qs)
    parts[2] = {"left": [{"type": "image", "src": x[1]} for x in email if x[0] == "img"],
                "right": [cloze([x[1] for x in email if x[0] == "text"], blanks, 2), questions(qs, 2)]}
    g = split(_blocks(items, expl, p3, stmts_end, letters=True))
    record(3, g[1])
    parts[3] = {"left": [{"type": "text", "intro": READ_INTRO[3][0], "paragraphs": [x[1] for x in g[0]]}],
                "right": [{"type": "questions", "intro": READ_INTRO[3][1], "style": "paragraph",
                           "items": [{"num": q[1], "prompt": q[2], "options": list("ABCDE")} for q in g[1]]}]}
    return parts, answers


# ---------------------------------------------------------------- writing

def _ocr_task(png: str) -> dict:
    """Writing prompt screenshot: left column = heading + scenario, right column = instruction, bullets, options."""
    rows = sorted((l for l in ocr_image(png)["lines"] if l["y"] > 0.06 and not l["t"].startswith("*NOTE")),
                  key=lambda l: l["y"])
    strip = lambda t: re.sub(r"^[•©®@○◦●]\s*", "", t).strip()
    left = [strip(l["t"]) for l in rows if l["x"] < 0.33 and not re.match(r"^\W*Read the following", l["t"])]
    right = [strip(l["t"]) for l in rows if l["x"] >= 0.33]
    instr, bullets, options = [], [], []
    for t in right:
        if re.match(r"^Option\s+[A-C]\s*:", t):
            options.append(t)
        elif re.match(r"^Explain the reasons for your choice", t) and instr and instr[-1].endswith("words."):
            continue  # the practice site repeats task 2's instruction under task 1's bullets
        elif instr and instr[-1].endswith("words."):
            bullets.append(t)
        else:
            instr.append(t)
    instruction = norm(" ".join(instr))
    m = re.match(r"^(Write an? .+?)\.\s*(Your .+ following things:)\s*Write (about [\d-]+ words)\.$", instruction)
    if m:
        instruction = f"{m[1]} in {m[3]}. {m[2]}"
    return {"surveyTitle": left[0] if left else None, "scenario": [norm(" ".join(left[1:]))],
            "instruction": instruction, "bullets": bullets, "options": options}


def _samples(path: str, header: re.Pattern, level: re.Pattern) -> dict:
    """{task: [{"level", "paragraphs"}]} from a samples document with task headers and level headers."""
    out, cur, lvl = {}, None, None
    for kind, val in lines(path):
        if kind != "text":
            continue
        m = header.match(val)
        if m:
            cur, lvl = int(m.group(1)), None
            continue
        m = level.match(val)
        if m and cur:
            lvl = m.group(1).replace("5-4", "4-5")
            out.setdefault(cur, []).append({"level": lvl, "paragraphs": []})
            continue
        if cur and lvl:
            out[cur][-1]["paragraphs"].append(val)
    return out


def parse_writing(path: str, samples_path: str, work_dir: str) -> list:
    pngs = [v for k, v in lines(path, work_dir, "writing") if k == "img"]
    samples = _samples(samples_path, re.compile(r"^Practice Test \d+ - Writing Task (\d)\b"),
                       re.compile(r"^CELPIP\s+([\d-]+)\s+Response$", re.I)) if samples_path else {}
    titles = {1: "Writing an Email", 2: "Responding to Survey Questions"}
    return [{"n": n, "title": titles[n], **_ocr_task(png), "samples": samples.get(n, [])}
            for n, png in enumerate(pngs[:2], start=1)]


# ---------------------------------------------------------------- speaking

TASK_HDR = re.compile(r"^Task\s*(\d)\s*:?\s*(.*)$")
FONT = "/System/Library/Fonts/Supplemental/Arial.ttf"
FONT_BOLD = "/System/Library/Fonts/Supplemental/Arial Bold.ttf"


def _fix_initial(t: str) -> str:
    """The source lost the capital Y of a few opening words ('our cousin', 'ou are')."""
    return re.sub(r"^(our|ou)\b", lambda m: "Y" + m.group(1), t)


def _card(picture: str, title: str, bullets: list, path: str) -> str:
    """Option card like the test screen: picture, bold title, bullet list. Rendered through a PDF page."""
    pix = pymupdf.Pixmap(picture)
    W, pad = 360, 12
    ih = W * pix.height / pix.width
    th = 22 + 18 * sum(1 + len(b) // 42 for b in bullets)
    doc = pymupdf.open()
    page = doc.new_page(width=W + 2 * pad, height=ih + th + 3 * pad)
    page.insert_image(pymupdf.Rect(pad, pad, pad + W, pad + ih), filename=picture)
    page.insert_font(fontname="ar", fontfile=FONT)
    page.insert_font(fontname="arb", fontfile=FONT_BOLD)
    y = ih + 2 * pad
    page.insert_textbox(pymupdf.Rect(pad, y, pad + W, y + 20), title, fontname="arb", fontsize=13)
    page.insert_textbox(pymupdf.Rect(pad, y + 22, pad + W, y + th + pad),
                        "\n".join(f"\u2022 {b}" for b in bullets), fontname="ar", fontsize=11.5, lineheight=1.35)
    page.get_pixmap(dpi=144).save(path)
    doc.close()
    return path


def parse_speaking(path: str, img_dir: str, samples_path: str = None) -> list:
    tasks, cur = {}, None
    for kind, val in lines(path, img_dir, "speaking"):
        if kind == "text":
            m = TASK_HDR.match(val)
            if m:
                cur = tasks.setdefault(int(m.group(1)), [])
                continue
            if cur is None or re.match(r"^\W*(Preparation|Recording)\s*:", val):
                continue
        if cur is not None:
            cur.append((kind, _fix_initial(val) if kind == "text" else val))
    samples = _samples(samples_path, re.compile(r"^Task\s*(\d)$"), re.compile(r"^([\d-]+)分范例$")) \
        if samples_path else {}
    out = []
    for n in range(1, 9):
        items = tasks.get(n, [])
        texts = [v for k, v in items if k == "text"]
        task = {"n": n, "title": SPEAKING_TITLES[n], "prep": SPEAKING_TIMES[n][0], "speak": SPEAKING_TIMES[n][1]}
        if n == 5:
            persuade = [t for t in texts if re.search(r"\bsuggesting\b.*\bPersuade\b", t)]
            select, cards = [], []
            for k, v in items:
                if k == "img":
                    cards.append([v])
                elif cards:
                    cards[-1].append(v)
                elif v not in persuade:
                    select.append(v)
            paths = [_card(c[0], c[1], [re.sub(r"^-\s*", "", b) for b in c[2:]],
                           os.path.join(img_dir, f"speaking_t5_{i + 1}.png")) for i, c in enumerate(cards)]
            if not persuade:
                m = re.search(r"persuade (an? [\w ]+?|your [\w ]+?) that", " ".join(select), re.I)
                who = m.group(1) if m else "a family member"
                persuade = [f"{who[0].upper()}{who[1:]} is suggesting another option. Persuade them that the "
                            "option you chose is more suitable by comparing the two."]
            task.update({"selectPrompt": select, "options": paths[:2], "prompt": persuade,
                         "otherOption": paths[2] if len(paths) > 2 else None, "choose": 60})
        elif n == 6:
            text = norm(" ".join(texts))
            m = re.search(r"^(.*?)\s*Choose ONE\s*:?\s*EITHER\s*(.+?)\s+OR\s+(.+)$", text)
            task.update({"prompt": [m.group(1)], "choices": [m.group(2), m.group(3)]} if m else
                        {"prompt": [text], "choices": []})
        else:
            text = [re.sub(r"^((Answer the following question\.?|Question\s*:)\s*)+", "", t).strip() for t in texts]
            task["prompt"] = [t for t in text if t]
            task["images"] = [v for k, v in items if k == "img"][:1]
        if samples.get(n):
            task["samples"] = samples[n]
        out.append(task)
    if not out[3].get("images"):
        out[3]["images"] = out[2].get("images", [])
    return out
