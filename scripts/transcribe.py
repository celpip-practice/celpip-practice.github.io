"""Transcribe an audio file with word timestamps. Usage: transcribe.py <audio> <out.json>"""
import json
import subprocess
import sys

import numpy as np
from faster_whisper import WhisperModel


def load_audio(src: str) -> np.ndarray:
    # src is a local path chosen by the build pipeline, passed as a list arg (no shell).
    raw = subprocess.run(
        ["ffmpeg", "-nostdin", "-v", "error", "-i", src, "-f", "s16le", "-ac", "1", "-ar", "16000", "-"],
        check=True, capture_output=True,
    ).stdout
    return np.frombuffer(raw, np.int16).astype(np.float32) / 32768.0


def main(src: str, out: str) -> None:
    model = WhisperModel("base.en", device="cpu", compute_type="int8")
    # Not conditioning on previous text stops Whisper looping ("Question 4." repeated over a whole
    # conversation) after the long answering silences in these recordings.
    segs, _info = model.transcribe(load_audio(src), word_timestamps=True, vad_filter=False, beam_size=5,
                                   condition_on_previous_text=False)
    data = []
    for s in segs:
        data.append({
            "start": round(s.start, 2),
            "end": round(s.end, 2),
            "text": s.text.strip(),
            "words": [{"w": w.word, "s": round(w.start, 2), "e": round(w.end, 2)} for w in (s.words or [])],
        })
    with open(out, "w") as f:
        json.dump(data, f, indent=1)


if __name__ == "__main__":
    main(sys.argv[1], sys.argv[2])
