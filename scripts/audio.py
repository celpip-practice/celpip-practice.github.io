"""Split a full listening recording into passage / question clips using Whisper timestamps."""
import json
import os
import re
import subprocess

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PY = os.path.join(ROOT, ".venv", "bin", "python")

PART_PATTERNS = {
    1: r"problem[- ]solving|conversation in three sections",
    2: r"daily[- ]life conversation|conversation followed by five questions",
    3: r"listening for information|followed by six questions",
    4: r"news item",
    5: r"listening to a discussion|watch a (video|discussion)",
    6: r"(listening (to|for) )?viewpoints|hear a report once",
}
NUMWORDS = "one|two|three|four|five|six|seven|eight|nine|ten"
QUESTION = re.compile(rf"^\s*question\s+(\d+|{NUMWORDS})\b[.,!]?", re.I)
INTRO_GAP = 2.6     # silence between the spoken instructions and the passage
ANSWER_GAP = 3.0    # silence left for answering after each spoken question


def transcribe(src: str, cache_dir: str) -> list:
    os.makedirs(cache_dir, exist_ok=True)
    st = os.stat(src)
    out = os.path.join(cache_dir, re.sub(r"[^\w.-]", "_", os.path.basename(src)) + f".{st.st_size}.v2.json")
    if not os.path.exists(out):
        env = dict(os.environ, HF_HUB_OFFLINE="1")
        subprocess.run([PY, os.path.join(ROOT, "scripts", "transcribe.py"), src, out], check=True, env=env)
    with open(out) as f:
        return json.load(f)


def _end(seg: dict) -> float:
    if seg.get("words"):
        return min(seg["end"], seg["words"][-1]["e"])
    return seg["end"]


def _start(seg: dict) -> float:
    if seg.get("words"):
        return max(seg["start"], seg["words"][0]["s"])
    return seg["start"]


def find_part_starts(segs: list, parts=range(1, 7)) -> dict:
    starts, i = {}, 0
    for p in parts:
        pat = re.compile(PART_PATTERNS[p], re.I)
        for j in range(i, len(segs)):
            # A part header opens an announcement; it is not a phrase inside a conversation.
            m = pat.search(segs[j]["text"])
            if m and (len(segs[j]["text"]) < 90 or m.start() < 30):
                starts[p] = j; i = j + 1
                break
    return starts


def _strip_intro(body: list) -> tuple:
    """Return (intro_segments, rest). Intro = header + instructions, ended by a long pause."""
    k = 0
    while k + 1 < len(body) and _start(body[k + 1]) - _end(body[k]) < INTRO_GAP:
        k += 1
    return body[:k + 1], body[k + 1:]


WORDNUM = {w: i + 1 for i, w in enumerate(NUMWORDS.split("|"))}
STEM_GAP = 1.5      # a spoken question stem follows its "Question N." almost immediately


BARE_QUESTION = re.compile(r"^\s*(\d{1,2})\.\s+(?=(what|why|how|where|when|who|which|according)\b)", re.I)


def _qnum(text: str):
    m = QUESTION.match(text) or BARE_QUESTION.match(text)  # Whisper may write "6. How ..." for "Question 6."
    if not m:
        return None
    n = m.group(1).lower()
    return int(n) if n.isdigit() else WORDNUM[n]


def _seg_from_words(words: list) -> dict:
    return {"start": words[0]["s"], "end": words[-1]["e"], "text": "".join(w["w"] for w in words).strip(), "words": words}


def split_question_markers(segs: list) -> list:
    """Split segments so that every spoken 'Question N' starts its own segment."""
    out = []
    for s in segs:
        ws = s.get("words") or []
        cuts = [i for i in range(1, len(ws) - 1)
                if re.fullmatch(r"\s*question", ws[i]["w"], re.I)
                and re.fullmatch(rf"\s*({NUMWORDS}|\d+)[.,!]?", ws[i + 1]["w"], re.I)]
        if not cuts:
            out.append(s)
            continue
        bounds = [0] + cuts + [len(ws)]
        out.extend(_seg_from_words(ws[a:b]) for a, b in zip(bounds, bounds[1:]) if b > a)
    return out


STEM_START = re.compile(r"^\s*(what|why|how|where|when|who|which|whose|according|in what)\b", re.I)
MIN_PASSAGE = 10.0  # seconds; real passages are long conversations, shorter "passages" are transcription noise


def _synthetic(a: float, b: float) -> dict:
    """Placeholder for question audio Whisper did not transcribe; build.py trims it to the speech inside."""
    return {"start": a, "end": b, "text": "", "synthetic": True}


def _duration(segs: list) -> float:
    return _end(segs[-1]) - _start(segs[0]) if segs else 0.0


def segment_part(body: list, kind: str, expected: int = None, sections: int = None, has_intro: bool = True) -> dict:
    """kind 'qa' (parts 1-3: passages followed by spoken questions) or 'passage' (parts 4/6).

    `expected` (spoken questions in the part) and `sections` (passages) come from the booklet and let
    gaps in the transcript be recovered: a dropped "Question N." marker, a dropped stem, or a question
    Whisper skipped entirely (returned as a synthetic segment spanning the untranscribed audio).
    """
    intro, rest = _strip_intro(body) if has_intro else ([], body)
    if kind == "passage":
        return {"intro": intro, "groups": [{"passage": rest, "questions": []}]}
    rest = split_question_markers(rest)
    groups = [{"passage": [], "questions": []}]
    last_num, i = 0, 0

    def last_end():
        g = groups[-1]
        return _end(g["questions"][-1][-1]) if g["questions"] else (_end(g["passage"][-1]) if g["passage"] else None)

    def next_numbered(k):
        return next((_qnum(r["text"]) for r in rest[k:] if _qnum(r["text"]) is not None), None)

    while i < len(rest):
        s = rest[i]
        n = _qnum(s["text"])
        in_questions = bool(groups[-1]["questions"])
        if n is None and in_questions and len(s["text"]) < 120 \
                and (s["text"].rstrip().endswith("?") or STEM_START.match(s["text"])) \
                and _start(s) - last_end() >= ANSWER_GAP:
            # Whisper sometimes drops a spoken "Question N." and keeps only its stem.
            nxt = next_numbered(i + 1)
            if (nxt is not None and nxt > last_num + 1) or (nxt is None and expected and last_num < expected):
                last_num += 1
                groups[-1]["questions"].append([s])
                i += 1
                continue
        if n is None:
            if in_questions and len(s["text"].strip()) < 15 and (i + 1 >= len(rest) or _qnum(rest[i + 1]["text"])):
                i += 1  # "You" / "Thank you." hallucinated in the answer silence
                continue
            if in_questions:
                groups.append({"passage": [], "questions": []})
            groups[-1]["passage"].append(s)
            i += 1
            continue
        q = [s]
        i += 1
        asked = bool(question_stem(q)) and s["text"].rstrip().endswith("?")
        while not asked and i < len(rest) and _qnum(rest[i]["text"]) is None and len(q) < 3 \
                and _start(rest[i]) - _end(q[-1]) < (STEM_GAP + 1.0 if len(q) == 1 else STEM_GAP):
            q.append(rest[i])
            asked = rest[i]["text"].rstrip().endswith("?")
            i += 1
        # A stem segment that runs on past its "?" swallowed the start of the next passage: split it there.
        ws = q[-1].get("words") or []
        k = next((j for j, w in enumerate(ws[:-1]) if w["w"].rstrip().endswith("?")), None)
        if k is not None and len(q) > 1:
            q[-1] = _seg_from_words(ws[:k + 1])
            i -= 1
            rest[i] = _seg_from_words(ws[k + 1:])
        # Question numbers only go up within a part; repeats are Whisper hallucinations in silence.
        if n <= last_num or (expected and n > expected):
            continue
        prev = last_end()
        if n > last_num + 1 and prev is not None and _start(q[0]) - prev > 2 * ANSWER_GAP:
            for _ in range(last_num + 1, n):  # skipped entirely; the audio is still between the neighbours
                groups[-1]["questions"].append([_synthetic(prev + 0.3, _start(q[0]) - 0.3)])
        if not question_stem(q):  # marker heard, stem not transcribed
            nxt_start = _start(rest[i]) if i < len(rest) else _end(q[-1]) + 12.0
            q.append(_synthetic(_end(q[-1]), nxt_start - 0.3))
        last_num = n
        groups[-1]["questions"].append(q)
    # A passage-only group is either leading/trailing noise or a passage split by a hallucination.
    merged = []
    for g in groups:
        if merged and not merged[-1]["questions"]:
            g = {"passage": merged.pop()["passage"] + g["passage"], "questions": g["questions"]}
        merged.append(g)
    if merged and not merged[-1]["questions"]:
        merged.pop()
    # A short "passage" between questions is noise inside the answer silence: fold it into the previous section.
    folded = []
    for g in merged:
        if folded and _duration(g["passage"]) < MIN_PASSAGE:
            folded[-1]["questions"].extend(g["questions"])
        else:
            folded.append(g)
    while sections and len(folded) > sections:
        k = min(range(1, len(folded)), key=lambda j: _duration(folded[j]["passage"]))
        folded[k - 1]["questions"].extend(folded.pop(k)["questions"])
    return {"intro": intro, "groups": folded}


def speech_islands(src: str, start: float, end: float, min_silence: float = 2.0) -> list:
    """Non-silent stretches [(s, e)] of `src` between start and end (absolute seconds), via ffmpeg silencedetect."""
    r = subprocess.run(["ffmpeg", "-nostdin", "-v", "info", "-ss", f"{start:.2f}", "-to", f"{end:.2f}", "-i", src, "-vn",
                        "-af", f"silencedetect=n=-35dB:d={min_silence}", "-f", "null", "-"],
                       capture_output=True, text=True)
    sil_starts = [float(x) for x in re.findall(r"silence_start: ([\d.]+)", r.stderr)]
    sil_ends = [float(x) for x in re.findall(r"silence_end: ([\d.]+)", r.stderr)]
    length = end - start
    islands, t = [], 0.0
    for k, ss in enumerate(sil_starts):
        if ss - t > 0.3:
            islands.append((start + t, start + ss))
        t = sil_ends[k] if k < len(sil_ends) else length
    if length - t > 0.3:
        islands.append((start + t, start + length))
    return islands


def question_span(src: str, segs: list) -> tuple:
    """Clip span for a spoken question, resolving synthetic placeholders against the audio itself."""
    real = [s for s in segs if not s.get("synthetic")]
    synth = [s for s in segs if s.get("synthetic")]
    if not synth:
        return span(real, 0.25, 0.5)
    a, b = synth[0]["start"], synth[0]["end"]
    islands = [x for x in speech_islands(src, a, b) if x[1] - x[0] >= 0.6]
    if real:  # the stem follows the marker within a second or two
        s0, e0 = span(real, 0.25, 0.5)
        follow = [x for x in islands if x[0] < e0 + 3.0]
        return s0, (follow[-1][1] + 0.5 if follow else e0)
    if islands:
        return max(a, islands[0][0] - 0.25), islands[0][1] + 0.5
    return a, b


def text_of(segs: list) -> str:
    return " ".join(s["text"] for s in segs).strip()


def span(segs: list, pad_before=0.3, pad_after=0.6) -> tuple:
    return (max(0.0, _start(segs[0]) - pad_before), _end(segs[-1]) + pad_after)


def cut(src: str, start: float, end: float, out: str) -> None:
    os.makedirs(os.path.dirname(out), exist_ok=True)
    subprocess.run(["ffmpeg", "-nostdin", "-v", "error", "-y", "-ss", f"{start:.2f}", "-to", f"{end:.2f}", "-i", src,
                    "-vn", "-ac", "1", "-ar", "22050", "-b:a", "48k", out], check=True)


def convert_audio(src: str, out: str) -> None:
    os.makedirs(os.path.dirname(out), exist_ok=True)
    subprocess.run(["ffmpeg", "-nostdin", "-v", "error", "-y", "-i", src, "-vn", "-ac", "1", "-ar", "22050", "-b:a", "48k", out], check=True)


def convert_video(src: str, out: str) -> None:
    """Re-encode for the web. Encoding is slow, so results are cached per source file under work/video."""
    import shutil

    os.makedirs(os.path.dirname(out), exist_ok=True)
    st = os.stat(src)
    cache = os.path.join(ROOT, "work", "video", re.sub(r"[^\w.-]", "_", os.path.basename(src)) + f".{st.st_size}.mp4")
    if not os.path.exists(cache):
        os.makedirs(os.path.dirname(cache), exist_ok=True)
        tmp = cache + ".part.mp4"
        subprocess.run(["ffmpeg", "-nostdin", "-v", "error", "-y", "-i", src, "-vf", "scale='min(854,iw)':-2", "-c:v", "libx264",
                        "-preset", "veryfast", "-crf", "28", "-c:a", "aac", "-b:a", "64k", "-ac", "1",
                        "-movflags", "+faststart", tmp], check=True)
        os.replace(tmp, cache)
    shutil.copyfile(cache, out)


def duration(path: str) -> float:
    r = subprocess.run(["ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", path],
                       check=True, capture_output=True, text=True)
    return float(r.stdout.strip() or 0)


def question_stem(segs: list) -> str:
    t = text_of(segs)
    t = re.sub(rf"^(\s*question\s+(\d+|{NUMWORDS})[.,!]?\s*)+", "", t, flags=re.I)
    return t.strip()
