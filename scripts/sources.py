"""Locate the source files for each practice test inside the downloaded material folder."""
import glob
import os
import re

SRC_ROOT = os.environ.get("CELPIP_SRC", "/Users/gaob/Downloads/官网真题合集(1-13)/官网真题1-13")


def _one(patterns: list, exclude: tuple = ()) -> str:
    for pat in patterns:
        hits = sorted(h for h in glob.glob(pat) if not any(x in os.path.basename(h) for x in exclude))
        if hits:
            return hits[0]
    return None


EXTRA_SET = 14  # the single pre-2021 test ('2021年3月前1套') is filed after the numbered sets
EXTRA_LABEL = "2021年3月前 · Test 1"


def standard_set_dirs() -> dict:
    """{set_number: folder} for the 'N听说读写' folders (plus the extra pre-2021 test)."""
    out = {}
    for d in os.listdir(SRC_ROOT):
        m = re.match(r"^0?(\d+)听说读写$", d)
        if m:
            out[int(m.group(1))] = os.path.join(SRC_ROOT, d)
        elif d.startswith("2021年3月前"):
            out[EXTRA_SET] = os.path.join(SRC_ROOT, d)
    return out


def discover_extra(base: str, test_no: int) -> dict:
    """Reading booklet + screenshot of the results page; writing prompts as screen captures.
    Listening questions and speaking exist only as screen recordings."""
    if test_no != 1:
        return {}
    g = lambda *p: os.path.join(base, *p)
    return {
        "id": f"s{EXTRA_SET:02d}-t1",
        "set": EXTRA_SET,
        "test": 1,
        "label": EXTRA_LABEL,
        "title": "Practice Test 1",
        "reading_booklet": _one([g("阅读", "1-1.pdf")]),
        "reading_answer_screens": sorted(glob.glob(g("阅读", "*答案*.jpg"))),
        "writing_booklet": _one([g("写作", "1-1.pdf")]),
    }


def _book_clips(audio_dir: str) -> dict:
    """{part: {"passages": {first_q: path}, "questions": {num: path}}} from per-part clip folders.
    Part 1 names passages '1-4' (section starting at question 4) and questions '1-4A'; parts 2-3 use
    '2-0' for the passage and '2-N' for question N."""
    out = {}
    for f in glob.glob(os.path.join(audio_dir, "*分段录音", "*")):
        m = re.search(r"(\d)-(\d+)(A?)\.\w+$", os.path.basename(f))
        if not m:
            continue
        part, num, q = int(m.group(1)), int(m.group(2)), m.group(3)
        c = out.setdefault(part, {"passages": {}, "questions": {}})
        if part == 1:
            c["questions" if q else "passages"][num] = f
        elif num == 0:
            c["passages"][1] = f
        else:
            c["questions"][num] = f
    return out


def discover_book(base: str, set_no: int, test_no: int) -> dict:
    """Per-skill booklets with a text layer ('12-1听说读写分科目资料') plus per-question audio clips."""
    k = f"{set_no}-{test_no}"
    d = os.path.join(base, f"{k}听说读写分科目资料")
    audio_dir = os.path.join(base, f"{k}听力录音")
    g = lambda name: _one([os.path.join(d, f"{k}{name}.pdf")])
    part_audio = {}
    for f in glob.glob(os.path.join(audio_dir, "*")):
        m = re.search(r"\](\d)\.(ogg|m4a|mp3|wav)$", os.path.basename(f))
        if m:
            part_audio[int(m.group(1))] = f
    return {
        "id": f"s{set_no:02d}-t{test_no}",
        "set": set_no,
        "test": test_no,
        "format": "book",
        "listening_booklet": g("听力题目"),
        "listening_answers": g("听力答案"),
        "listening_clips": _book_clips(audio_dir),
        "listening_part_audio": part_audio,
        "listening_video": _one([os.path.join(audio_dir, "*5.mp4")]),
        "reading_booklet": g("阅读题目"),
        "reading_answers": g("阅读答案"),
        "writing_booklet": g("写作题目"),
        "writing_samples": g("写作参考答案"),
        "speaking_booklet": g("口语题目"),
    }


def discover_word(base: str, set_no: int, test_no: int) -> dict:
    """Word documents per skill ('13听说读写/1/阅读题目+解析.docx') plus 'Listening N[_SectionS][_Q]' clips."""
    d = os.path.join(base, str(test_no))
    g = lambda *pats: _one([os.path.join(d, p) for p in pats])
    return {
        "id": f"s{set_no:02d}-t{test_no}",
        "set": set_no,
        "test": test_no,
        "format": "word",
        "listening_booklet": g("听力题目*.docx"),
        "listening_audio_dir": os.path.join(d, str(test_no)),
        "reading_booklet": g("阅读题目+*解析.docx"),
        "writing_booklet": g("写作题目.docx"),
        "writing_samples": g("写作范文.docx"),
        "speaking_booklet": g("口语题目.docx"),
        "speaking_samples": g("*口语范例.docx"),
    }


def discover(set_no: int, test_no: int) -> dict:
    base = standard_set_dirs().get(set_no)
    if not base:
        return {}
    if set_no == EXTRA_SET:
        return discover_extra(base, test_no)
    k = f"{set_no}-{test_no}"
    if os.path.isdir(os.path.join(base, f"{k}听说读写分科目资料")):
        return discover_book(base, set_no, test_no)
    if glob.glob(os.path.join(base, str(test_no), "阅读题目*.docx")):
        return discover_word(base, set_no, test_no)
    L = os.path.join(base, "听力", k)
    g = lambda *p: os.path.join(*p)
    short = os.path.join(base, "听", str(test_no))
    if os.path.isdir(short):  # '11听说读写/听/1': one audio file per listening part
        part_audio = {}
        for f in glob.glob(os.path.join(short, "*")):
            m = re.search(r"-(\d)\.(m4a|ogg|mp3|wav)$", os.path.basename(f))
            if m:
                part_audio[int(m.group(1))] = f
        return {
            "id": f"s{set_no:02d}-t{test_no}",
            "set": set_no,
            "test": test_no,
            "listening_booklet": _one([g(short, "*问题选项.pdf")]),
            "listening_answers": _one([g(short, "*答案*.pdf")]),
            "listening_transcript": _one([g(short, "*文本*.PDF"), g(short, "*文本*.pdf")]),
            "listening_part_audio": part_audio,
            "listening_video": _one([g(short, "*.mp4")]),
            "reading_docx": _one([g(base, "读", str(test_no), "*.docx")]),
            "reading_answer_screens": sorted(glob.glob(g(base, "读", str(test_no), "*.png"))),
        }
    audio_dir_pats = [g(L, "听力音频*", "*"), g(L, "*", "*")]
    audio = None
    for pat in audio_dir_pats:
        hits = sorted(h for h in glob.glob(pat) if h.lower().endswith((".m4a", ".mp3", ".ogg", ".wav")))
        if hits:
            audio = hits[0]; break
    return {
        "id": f"s{set_no:02d}-t{test_no}",
        "set": set_no,
        "test": test_no,
        "listening_booklet": _one([g(L, "*问题选项.pdf"), g(L, "*问题*.pdf")], exclude=("原文",)),
        "listening_answers": _one([g(L, "*答案*.pdf")]),
        "listening_transcript": _one([g(L, "*原文*.pdf")]),
        "listening_audio": audio,
        "listening_video": _one([g(L, "*", "*part5*.mp4"), g(L, "*part5*.mp4")]),
        "reading_booklet": _one([g(base, "阅读", f"{k}.pdf")]),
        "reading_answers": _one([g(base, "阅读", f"{k}答案*.pdf"), g(base, "阅读", f"{k}*答案*.pdf")]),
        "writing_booklet": _one([g(base, "写作", f"{k}.pdf")]),
        "writing_samples": _one([g(base, "写作", f"{k}*例文*.pdf")]),
        "speaking_booklet": _one([g(base, "口语", f"{k}*口语问题*.pdf"), g(base, "口语", f"{k}*问题*.pdf")]),
    }
