"""Check listening audio segmentation from cached transcripts, without cutting clips.

Usage: check_audio.py sNN-tK [...]
Reports, per test, missing part headers and spoken-question counts that differ from the official layout.
"""
import os
import re
import sys

sys.path.insert(0, os.path.dirname(__file__))

import audio as A  # noqa: E402
from sources import discover  # noqa: E402

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
EXPECTED = {1: (3, 8), 2: (1, 5), 3: (1, 6)}  # part: (sections, questions)


def check(test_id: str) -> list:
    m = re.fullmatch(r"s(\d+)-t(\d)", test_id)
    if not m:
        return [f"bad id {test_id}"]
    src = discover(int(m.group(1)), int(m.group(2)))
    if not src.get("listening_audio"):
        return ["no listening audio"]
    segs = A.transcribe(src["listening_audio"], os.path.join(ROOT, "work", "transcripts"))
    starts = A.find_part_starts(segs)
    order = sorted(starts)
    probs = [f"part {n}: header not found" for n in (1, 2, 3, 4, 6) if n not in starts]
    for n in order:
        i = order.index(n)
        body = segs[starts[n]: starts[order[i + 1]] if i + 1 < len(order) else len(segs)]
        want = EXPECTED.get(n, (1, None))
        seg = A.segment_part(body, "qa" if n <= 3 else "passage", expected=want[1], sections=want[0])
        if n in EXPECTED:
            want_g, want_q = EXPECTED[n]
            got_q = sum(len(g["questions"]) for g in seg["groups"])
            if len(seg["groups"]) != want_g or got_q != want_q:
                probs.append(f"part {n}: {len(seg['groups'])} sections / {got_q} questions "
                             f"(expected {want_g} / {want_q}) per-section {[len(g['questions']) for g in seg['groups']]}")
        elif n in (4, 6) and not (seg["groups"] and seg["groups"][0]["passage"]):
            probs.append(f"part {n}: no passage")
    return probs


if __name__ == "__main__":
    for tid in sys.argv[1:]:
        probs = check(tid)
        print(f"## {tid}: {len(probs)} problem(s)")
        for p in probs:
            print("   -", p)
