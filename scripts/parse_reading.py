"""Parse a reading booklet into parts made of blocks (passage text, diagram, questions, cloze)."""
import re

from doc import norm, paragraphs
from parse_common import group_options, is_noise_row, split_missing_headers, strip_junk
from parse_listening import split_parts

INSTR_START = re.compile(
    r"^(Using the drop-?down|Here is a response|Read the following|Decide which paragraph|"
    r"The following is a comment|Complete the|Choose the best)\b", re.I)
INSTR_END = re.compile(r"(\)\.?|\.|drop-?down menu.{0,6})\s*$", re.I)
HEADER = re.compile(r"^(\d{1,2})\s*[.,]?\s*(\S{0,2})$")


def _is_instruction_line(t: str) -> bool:
    return bool(INSTR_START.match(t))


def _blocks(items: list) -> list:
    """Split a part into ('text', rows) / ('instr', text) / ('pic', Pic) / ('q', rows) runs."""
    out, i = [], 0
    rows_only = lambda b: b
    while i < len(items):
        it = items[i]
        if it.kind == "pic":
            out.append(("pic", it)); i += 1; continue
        if _is_instruction_line(it.text):
            buf = [it.text]
            i += 1
            while not INSTR_END.search(buf[-1]) and i < len(items) and items[i].kind == "row" and len(buf) < 4 \
                    and not _header(items[i]):
                buf.append(items[i].text); i += 1
            out.append(("instr", norm(" ".join(buf))))
            continue
        if out and out[-1][0] == "rows":
            out[-1][1].append(it)
        else:
            out.append(("rows", [it]))
        i += 1
    return rows_only(out)


def _header(r):
    """Match a question header row 'N. prompt'. Some booklets indent headers to the bullet column;
    those carry only a drop-down glyph."""
    m = re.match(r"^(\d{1,2})\s*[.,]\s*(.*)$", r.text)
    if m and not r.bullet and (r.text_x < 0.17 or r.text_x < 0.2 and len(m.group(2).strip()) <= 2):
        return m
    return None


def _split_body_and_questions(rows: list, first_num: int) -> tuple:
    """Rows of a cloze/passage followed by numbered question headers. Body ends at the first header row."""
    for k, r in enumerate(rows):
        m = _header(r)
        if m and int(m.group(1)) == first_num:
            rest = m.group(2).strip()
            # A real header is followed by indented options, and carries a prompt or just a glyph.
            nxt = rows[k + 1] if k + 1 < len(rows) else None
            if nxt is not None and (nxt.bullet or nxt.text_x > 0.17) and len(rest.split()) <= 14:
                return rows[:k], rows[k:]
    return rows, []


def _questions(rows: list, first: int = 1) -> list:
    qs, cur = [], None
    for r in rows:
        m = _header(r)
        if m:
            cur = {"num": int(m.group(1)), "prompt": [m.group(2)], "rows": [], "hx": min(r.text_x, 0.16)}
            qs.append(cur); continue
        if cur is None:
            lost = re.match(r"^[.,]\s*(\w.*)$", r.text)
            if lost and not r.bullet and r.text_x < 0.17:  # OCR kept only the period of the first header
                cur = {"num": first, "prompt": [lost.group(1)], "rows": [], "hx": min(r.text_x, 0.16)}
                qs.append(cur)
            continue
        # Option rows are indented from the header; booklets differ in absolute margins.
        at_header = not r.bullet and r.text_x < cur["hx"] + 0.017
        glued = re.match(rf"^{cur['num'] + 1}\s*\.\s+(.+)$", r.text)
        if glued and len(cur["rows"]) >= 4:
            # OCR glued the next header ("10.") onto that question's first option.
            r.text = glued.group(1)
            cur = {**cur, "num": cur["num"] + 1, "prompt": [""], "rows": [r]}
            qs.append(cur)
            continue
        if len(cur["rows"]) >= 4 and not r.bullet and r.text_x < cur["hx"] + 0.04 and len(r.text.strip()) <= 2 \
                and re.search(r"\w", r.text):
            # The next header's number was OCR'd as a stray glyph ("4." -> "A").
            cur = {**cur, "num": cur["num"] + 1, "prompt": [""], "rows": []}
            qs.append(cur)
            continue
        if len(cur["rows"]) >= 4 and at_header and len(r.text.split()) >= 3:
            # The next header's number was lost, leaving its prompt.
            cur = {**cur, "num": cur["num"] + 1, "prompt": [r.text], "rows": []}
            qs.append(cur)
            continue
        if is_noise_row(r):
            continue
        if at_header and not cur["rows"]:
            cur["prompt"].append(r.text)
        else:
            cur["rows"].append(r)
    return [{"num": q["num"], "prompt": strip_junk(" ".join(p for p in q["prompt"] if p)),
             "options": group_options(q["rows"])} for q in split_missing_headers(qs)]


def _cloze(paras: list, nums: list) -> list:
    """Replace inline 'N. <glyph>' blank markers with {{N}} tokens, in order."""
    text = "\n\n".join(paras)
    pos = 0
    for n in nums:
        # OCR reads "11." as "1l."; a leading "l"/"I" right after a letter is a word like "canmail.ca", not a blank
        num = str(n).replace("1", "[1lI]")
        if num.startswith("[1lI]"):
            num = "(?:1|(?<![A-Za-z])[lI])" + num[len("[1lI]"):]
        # the ▼ glyph OCRs as a symbol, a lone letter, "v"/"r" before punctuation, or "v" glued to a conjunction
        pat = re.compile(rf"(?<![\d$.@]){num}\s*\.(?:\s+(?:[^\w\s]{{1,3}}|[A-Za-z0-9]|™)(?=\s|$)"
                         rf"|\s*[vrY*~](?=[\s.,;:])|-(?=\s)|\s+v(?=(?:and|but|or|so)\b))?")
        m = pat.search(text, pos)
        if not m:  # OCR dropped the period: a bare number between words
            m = re.compile(rf"(?<=[a-z,] ){n}(?:\s+[^\w\s]{{1,3}})?(?=\s|$)").search(text, pos)
        if not m:
            raise ValueError(f"cloze blank {n} not found")
        token = (" " if text[m.start() - 1:m.start()].isalnum() else "") + f"{{{{{n}}}}}" \
            + (" " if text[m.end():m.end() + 1].isalnum() else "")
        text = text[:m.start()] + token + text[m.end():]
        pos = m.start() + len(token)
    return [p.strip() for p in text.split("\n\n")]


def _p3_statements(rows: list) -> list:
    """Part 3: '- 1. statement' lines followed by A-E option rows."""
    qs = []
    for r in rows:
        t = re.sub(r"^(?:[•*\-\s]|[A-Za-z](?=\s*-\s*\d))+", "", r.text)
        m = re.match(r"^(\d{1,2})\s*\.?\s+(.{8,})$", t)
        if m:
            qs.append({"num": int(m.group(1)), "prompt": norm(m.group(2)), "options": list("ABCDE")})
        elif qs and len(t) > 3 and not re.fullmatch(r"[A-E]", t.strip()):
            qs[-1]["prompt"] = norm(qs[-1]["prompt"] + " " + t)
    return qs


def parse_part(n: int, items: list) -> dict:
    blocks = _blocks(items)
    left, right = [], []
    if n == 3:
        passage_rows, q_rows, intro, instr = [], [], None, None
        for kind, b in blocks:
            if kind == "instr":
                if b.lower().startswith("read the following"):
                    intro = b
                else:
                    instr = b
            elif kind == "rows":
                (q_rows if instr else passage_rows).extend(b)
        paras = []
        for r in passage_rows:
            if re.match(r"^[A-E]\.\s", r.text) or not paras:
                paras.append(r.text)
            else:
                paras[-1] += " " + r.text
        left.append({"type": "text", "intro": intro, "paragraphs": [norm(p) for p in paras]})
        right.append({"type": "questions", "intro": instr, "style": "paragraph", "items": _p3_statements(q_rows)})
        return {"left": left, "right": right}

    side = left
    pending_instr = None
    next_num = 1
    for kind, b in blocks:
        if kind == "pic":
            left.append({"type": "image", "src": b.path}); continue
        if kind == "instr":
            low = b.lower()
            if low.startswith("read the following") and "email" not in low and "diagram" not in low:
                left.append({"type": "text", "intro": b, "paragraphs": []}); continue
            pending_instr = b
            side = right
            continue
        rows = b
        if pending_instr is None:
            # Passage text before any instruction.
            if left and left[-1]["type"] == "text" and not left[-1]["paragraphs"]:
                left[-1]["paragraphs"] = paragraphs(rows)
            else:
                left.append({"type": "text", "paragraphs": paragraphs(rows)})
            continue
        low = pending_instr.lower()
        is_cloze = any(k in low for k in ("filling in the blanks", "fill in each blank", "complete the comment",
                                         "complete the response", "complete the email"))
        if is_cloze:
            body, qrows = _split_body_and_questions(rows, next_num)
            qs = _questions(qrows)
            for q in qs:
                q["prompt"] = ""
            nums = [q["num"] for q in qs]
            right.append({"type": "cloze", "intro": pending_instr, "paragraphs": _cloze(paragraphs(body), nums),
                          "items": qs})
        else:
            qs = _questions(rows, next_num)
            right.append({"type": "questions", "intro": pending_instr, "style": "dropdown", "items": qs})
        if qs:
            next_num = qs[-1]["num"] + 1
        pending_instr = None
    return {"left": left, "right": right}


def parse_reading_booklet(stream: list) -> dict:
    parts = split_parts(stream, "Reading")
    return {n: parse_part(n, items) for n, items in parts.items() if n > 0}
