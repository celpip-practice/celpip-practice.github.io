"""Warm the transcript cache for every standard test's listening audio and Part 5 video."""
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

import audio as A  # noqa: E402
from build import WORK, all_ids  # noqa: E402
from sources import discover  # noqa: E402

if __name__ == "__main__":
    for tid in all_ids():
        s, t = int(tid[1:3]), int(tid[-1])
        src = discover(s, t)
        for key in ("listening_audio", "listening_video"):
            if src.get(key):
                print(tid, key, flush=True)
                A.transcribe(src[key], os.path.join(WORK, "transcripts"))
