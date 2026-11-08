"""Debug helper: print the row/picture stream of one source PDF.

Usage: dump.py <test-id> <source-key> [pattern [rows-before [rows-after]]]
  e.g. dump.py s02-t1 listening_answers "Part 2"
Only rows after the first one matching `pattern` (and the next 60 items) are printed.
"""
import re
import sys

sys.path.insert(0, __import__("os").path.dirname(__file__))

from doc import build_stream  # noqa: E402
from sources import discover  # noqa: E402

KEYS = {"listening_booklet", "listening_answers", "listening_transcript", "reading_booklet", "reading_answers",
        "writing_booklet", "writing_samples", "speaking_booklet"}

if __name__ == "__main__":
    test_id, key = sys.argv[1], sys.argv[2]
    m = re.fullmatch(r"s(\d+)-t(\d)", test_id)
    if not m or key not in KEYS:
        sys.exit(f"usage: dump.py sNN-tK <{'|'.join(sorted(KEYS))}> [pattern]")
    src = discover(int(m.group(1)), int(m.group(2)))[key]
    print(src)
    stream = build_stream(src, min_w=0.04, min_h=0.025, merge_hgap=0.06)
    pat = re.compile(sys.argv[3], re.I) if len(sys.argv) > 3 else None
    start = 0
    if pat:
        start = next((i for i, it in enumerate(stream) if it.kind == "row" and pat.search(it.text)), 0)
    before = int(sys.argv[4]) if len(sys.argv) > 4 else 0
    count = int(sys.argv[5]) if len(sys.argv) > 5 else 60
    for it in stream[max(0, start - before):start + count]:
        if it.kind == "row":
            print(f"p{it.page} y={it.y:.3f} x={it.x:.3f} tx={it.text_x:.3f}{' •' if it.bullet else '  '} "
                  + " | ".join(f"{l['x']:.2f}:{l['t']}" for l in it.lines))
        else:
            print(it)
