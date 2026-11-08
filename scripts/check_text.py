"""Parser check without audio: build with CELPIP_SKIP_AUDIO=1 and report non-media problems.

Usage: check_text.py s03-t1 [s03-t2 ...] | all
"""
import os
import sys

os.environ["CELPIP_SKIP_AUDIO"] = "1"
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from build import all_ids, build_test  # noqa: E402
from validate import validate_test  # noqa: E402

MEDIA = ("section without media", "sections (expected", "missing audio", "media file", "audio: missing media")

if __name__ == "__main__":
    ids = all_ids() if sys.argv[1:] == ["all"] else sys.argv[1:]
    for tid in ids:
        t = build_test(tid)
        probs = [p for p in validate_test(tid) if not any(m in p for m in MEDIA)]
        weak = [w for w in t["warnings"] if "weak answer" in w or "no answer key" in w or "cannot read" in w]
        print(f"## {tid}: {len(probs)} problem(s)")
        for p in probs + weak:
            print("   -", p)
