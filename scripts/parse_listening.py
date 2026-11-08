"""Parse the listening question booklet ('问题选项' PDF) into parts/questions."""
import re

from parse_common import group_options, split_missing_headers, strip_junk

INSTRUCTION = re.compile(r"^(Ch\w{2,4}se the best|Choose the sentence|\(\s*\)\.?$|\(\)\.?$|to the statement)", re.I)


def split_parts(stream: list, skill: str) -> dict:
    parts, cur = {}, None
    for it in stream:
        if it.kind == "row":
            m = re.search(rf"{skill}\s*Part\s+(\d)\b", it.text)
            if m and ("Practice Test" in it.text or it.text.startswith(skill)):
                cur = int(m.group(1)); parts[cur] = []; continue
            if re.search(rf"{skill} Practice Task", it.text):
                cur = 0; parts[cur] = []; continue
        if cur is not None:
            parts[cur].append(it)
    return parts


def parse_single_questions(items: list) -> list:
    """Parts 1-3: 'Question k of n' blocks, options only (the stem is heard, not shown)."""
    qs, cur = [], None
    for it in items:
        if it.kind == "row":
            m = re.match(r"^Question\s+(\d+)\s+of\s+(\d+)", it.text)
            if m:
                cur = {"num": int(m.group(1)), "rows": [], "pics": []}
                qs.append(cur); continue
            if INSTRUCTION.search(it.text):
                continue
        if cur is None:
            continue
        (cur["pics"] if it.kind == "pic" else cur["rows"]).append(it)
    out = []
    for q in qs:
        if q["pics"] and len([r for r in q["rows"] if len(r.text) > 3]) < 2:
            opts = [{"image": p.path} for p in q["pics"]]
        else:
            opts = [{"text": t} for t in group_options(q["rows"])]
        out.append({"num": q["num"], "options": opts})
    return out


def parse_numbered_questions(items: list, indent: float = 0.17) -> list:
    """Parts 4-6 (and reading): '1. prompt' at the left margin, options indented below."""
    qs, cur = [], None
    for it in items:
        if it.kind != "row":
            if cur is not None:
                cur["pics"].append(it)
            continue
        if INSTRUCTION.search(it.text):
            continue
        m = re.match(r"^(\d{1,2})\s*[.,]\s*(.*)$", it.text)
        if m and it.text_x < indent and not it.bullet:
            cur = {"num": int(m.group(1)), "prompt": [m.group(2)], "rows": [], "pics": []}
            qs.append(cur); continue
        if cur is None:
            continue
        if it.text_x < indent and not it.bullet and not cur["rows"]:
            cur["prompt"].append(it.text)
        else:
            cur["rows"].append(it)
    out = []
    for q in split_missing_headers(qs):
        out.append({
            "num": q["num"],
            "prompt": strip_junk(" ".join(p for p in q["prompt"] if p)),
            "options": [{"text": t} for t in group_options(q["rows"])],
        })
    return out


def parse_listening_booklet(stream: list) -> dict:
    parts = split_parts(stream, "Listening")
    res = {}
    for n, items in parts.items():
        if n == 0:
            continue
        items = [it for it in items if not (it.kind == "row" and re.fullmatch(r"\d{2,4}", it.text.strip()))]  # page numbers
        if n <= 3:
            res[n] = parse_single_questions(items)
        else:  # some booklets indent the whole page, headers included
            margin = min((it.text_x for it in items if it.kind == "row" and not it.bullet), default=0.12)
            res[n] = parse_numbered_questions(items, indent=max(0.17, margin + 0.03))
    return res
