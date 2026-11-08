"""Printed listening transcripts (text layer): section text, question ranges and the question stems.
Used when the audio holds the passages only, without the spoken questions."""
import re
from difflib import SequenceMatcher

import pymupdf

from doc import norm

SPEAKER = re.compile(r"^[A-Z][A-Za-z]{1,12}\s*:\s*")


def parse_transcript(pdf: str) -> dict:
    """{part: [{"text", "opening", "first", "last", "stems"}]} for parts 1-3."""
    with pymupdf.open(pdf) as d:
        lines = [norm(l) for p in d for l in p.get_text().splitlines()]
    parts, part, sec, stems_mode = {}, 1, None, False

    def new_section():
        s = {"text": [], "first": None, "last": None, "stems": []}
        parts.setdefault(part, []).append(s)
        return s

    for line in lines:
        if not line:
            continue
        m = re.match(r"^Part\s+(\d)\s*:", line)
        if m:
            part, sec, stems_mode = int(m.group(1)), None, False
            continue
        if re.match(r"^Section\s+\d\s*:?$", line):
            sec, stems_mode = new_section(), False
            continue
        m = re.match(r"^Now answer questions?\s+(\d+)(?:\s*(?:-|to|and)\s*(\d+))?", line, re.I)
        if m:
            sec = sec or new_section()
            sec["first"], sec["last"] = int(m.group(1)), int(m.group(2) or m.group(1))
            stems_mode = True
            continue
        if sec is None:
            if part == 1:  # document title before "Section 1:"
                continue
            sec = new_section()
        (sec["stems"] if stems_mode else sec["text"]).append(line)
    out = {}
    for n, secs in parts.items():
        if n > 3:
            continue
        for s in secs:
            s["stems"] = [x.strip() for x in re.findall(r"[^?]+\?", " ".join(s["stems"]))]
            text = " ".join(SPEAKER.sub("", t) for t in s["text"])
            s["text"] = norm(text)
            s["opening"] = " ".join(s["text"].split()[:12])
        out[n] = secs
    return out


def _letters(t: str) -> str:
    return re.sub(r"[^a-z ]", "", t.lower())


def locate(segs: list, opening: str, after: float) -> float:
    """Start time of the transcribed segment that best matches a section's opening words."""
    a = _letters(opening)
    best, best_t = 0.0, None
    for j, s in enumerate(segs):
        if s["start"] <= after + 5:
            continue
        b = _letters(" ".join(x["text"] for x in segs[j:j + 3]))[:len(a)]
        r = SequenceMatcher(None, a, b).ratio()
        if r > best:
            best, best_t = r, s["start"]
    return best_t
