"""Build app content for one or more practice tests.

Usage: build.py s01-t1 [s01-t2 ...] | all
Writes public/content/tests/<id>/test.json (+ media/) and refreshes public/content/index.json.
"""
import json
import os
import re
import shutil
import sys
import traceback

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

import audio as A  # noqa: E402
import book  # noqa: E402
import docx_reading  # noqa: E402
import transcript  # noqa: E402
import wordtest  # noqa: E402
from doc import build_stream  # noqa: E402
from images import similarity  # noqa: E402
from parse_common import LISTENING_TITLES, READING_TITLES, best_match, parse_answer_key  # noqa: E402
from parse_listening import parse_listening_booklet  # noqa: E402
from parse_reading import parse_reading_booklet  # noqa: E402
from parse_ws import parse_speaking, parse_writing, parse_writing_from_samples  # noqa: E402
from sources import discover, standard_set_dirs  # noqa: E402

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, "public", "content")
WORK = os.path.join(ROOT, "work")
LISTEN_KIND = {1: "qa", 2: "qa", 3: "qa", 4: "passage", 5: "video", 6: "passage"}
READING_INTRO = {
    1: "Read the following message.",
    2: "Read the following diagram and email message.",
    3: "Read the following passage.",
    4: "Read the following article.",
}


class Report:
    def __init__(self):
        self.warnings = []

    def warn(self, msg):
        self.warnings.append(msg)
        print("  WARN:", msg)


def _rel(path: str, test_dir: str) -> str:
    return os.path.relpath(path, test_dir).replace(os.sep, "/")


def _move_into(src: str, test_dir: str, name: str) -> str:
    dst = os.path.join(test_dir, "media", name)
    os.makedirs(os.path.dirname(dst), exist_ok=True)
    shutil.copyfile(src, dst)
    return _rel(dst, test_dir)


def resolve_answer(q: dict, key: dict, rep: Report, label: str):
    if key is None:
        rep.warn(f"{label}: no answer key entry")
        return None
    opts = q["options"]
    if opts and isinstance(opts[0], dict) and "image" in opts[0]:
        if not key["pics"]:
            rep.warn(f"{label}: picture options but no picture in answer key")
            return None
        ans = key["pics"][0].path
        scores = [similarity(ans, o["image"]) for o in opts]
        return max(range(len(scores)), key=lambda i: scores[i])
    texts = [o["text"] if isinstance(o, dict) else o for o in opts]
    t = key["text"]
    if all(len(x) == 1 for x in texts):  # Reading part 3 letters
        m = re.findall(r"\b([A-E])\b", t)
        if m:
            return texts.index(m[-1])
        rep.warn(f"{label}: cannot read letter answer from {t!r}")
        return None
    idx, score = best_match(t, texts)
    if score < 70:
        rep.warn(f"{label}: weak answer match ({score:.0f}) {t!r} -> {texts[idx] if idx >= 0 else None!r}")
    return idx if idx >= 0 else None


def _part_bodies(src: dict) -> dict:
    """{part: (audio file, transcript segments starting at the part header)}."""
    tdir = os.path.join(WORK, "transcripts")
    if src.get("listening_audio"):
        segs = A.transcribe(src["listening_audio"], tdir)
        starts = A.find_part_starts(segs)
        order = sorted(starts)
        return {n: (src["listening_audio"], segs[starts[n]: starts[order[i + 1]] if i + 1 < len(order) else len(segs)],
                    True) for i, n in enumerate(order)}
    out = {}
    for n, f in src.get("listening_part_audio", {}).items():
        segs = A.transcribe(f, tdir)
        starts = A.find_part_starts(segs, parts=[n])
        out[n] = (f, segs[starts.get(n, 0):], n in starts)
    return out


def _sections_from_transcript(audio: str, n: int, qs: list, secs: list, test_dir: str, rep: Report) -> list:
    """Parts 1-3 whose audio holds only the passage(s): sections and question stems come from the printed
    transcript; part 1's sections are cut where each section's opening words are heard."""
    segs = A.transcribe(audio, os.path.join(WORK, "transcripts"))
    total = A.duration(audio)
    starts = [0.0]
    for s in secs[1:]:
        t = transcript.locate(segs, s["opening"], starts[-1])
        if t is None:
            rep.warn(f"listening part {n}: section start not found in audio")
            t = total
        starts.append(t)
    out = []
    for k, s in enumerate(secs):
        a, b = starts[k], starts[k + 1] if k + 1 < len(starts) else total
        dst = os.path.join(test_dir, "media", f"l{n}_s{k + 1}.mp3")
        A.cut(audio, max(0.0, a - 0.3), b - 0.2 if k + 1 < len(starts) else b, dst)
        sec_qs = [q for q in qs if s["first"] is None or s["first"] <= q["num"] <= s["last"]]
        if len(s["stems"]) != len(sec_qs):
            rep.warn(f"listening part {n} section {k + 1}: {len(sec_qs)} questions but {len(s['stems'])} stems")
        for q, stem in zip(sec_qs, s["stems"]):
            q["stem"] = stem
        out.append({"media": {"type": "audio", "src": _rel(dst, test_dir), "duration": round(A.duration(dst), 1)},
                    "transcript": s["text"], "questions": sec_qs})
    return out


def build_listening(src: dict, test_dir: str, rep: Report) -> dict:
    img_dir = os.path.join(test_dir, "media")
    booklet = parse_listening_booklet(build_stream(src["listening_booklet"], img_dir=img_dir, img_prefix="listening",
                                                   min_w=0.04, min_h=0.025, merge_hgap=0.06))
    key = parse_answer_key(build_stream(src["listening_answers"], img_dir=os.path.join(WORK, "keyimg", src["id"]),
                                        img_prefix="lkey", min_w=0.04, min_h=0.025, merge_hgap=0.06),
                           "Listening") if src.get("listening_answers") else {}
    skip_audio = os.environ.get("CELPIP_SKIP_AUDIO") == "1"  # quick parser checks while iterating
    bodies = {} if skip_audio else _part_bodies(src)
    # Per-part recordings without spoken questions: the printed transcript supplies sections and stems.
    tsecs = transcript.parse_transcript(src["listening_transcript"]) \
        if src.get("listening_part_audio") and src.get("listening_transcript") else {}
    parts = []
    for n in range(1, 7):
        qs = booklet.get(n, [])
        part = {"n": n, "title": LISTENING_TITLES[n], "kind": LISTEN_KIND[n], "intro": [], "sections": []}
        seg = None
        audio = None
        if n in bodies:
            audio, body, has_intro = bodies[n]
            seg = A.segment_part(body, "qa" if n <= 3 else "passage", expected=len(qs) or None,
                                 sections=3 if n == 1 else 1, has_intro=has_intro)
            intro_text = A.text_of(seg["intro"])
            part["intro"] = [s.strip() for s in re.split(r"(?<=[.!?])\s+", intro_text)][1:] if has_intro \
                else LISTEN_INTRO[n]
        elif n != 5:  # part 5 comes from its own video file
            rep.warn(f"listening part {n}: header not found in audio")
        for q in qs:
            q["answer"] = resolve_answer(q, key.get((n, q["num"])), rep, f"L{n}Q{q['num']}")
            q["id"] = f"L{n}-{q['num']}"
        if n <= 3 and tsecs.get(n) and audio:
            part["intro"] = LISTEN_INTRO[n]
            part["sections"] = _sections_from_transcript(audio, n, qs, tsecs[n], test_dir, rep)
        elif n <= 3:
            groups = seg["groups"] if seg else []
            qi = 0
            for gi, g in enumerate(groups):
                section = {"media": None, "transcript": A.text_of(g["passage"]), "questions": []}
                if g["passage"]:
                    s, e = A.span(g["passage"])
                    out = os.path.join(test_dir, "media", f"l{n}_s{gi + 1}.mp3")
                    A.cut(audio, s, e, out)
                    section["media"] = {"type": "audio", "src": _rel(out, test_dir), "duration": round(e - s, 1)}
                for qj, qsegs in enumerate(g["questions"]):
                    if qi >= len(qs):
                        rep.warn(f"listening part {n}: more spoken questions than booklet questions")
                        break
                    q = qs[qi]; qi += 1
                    s, e = A.question_span(audio, qsegs)
                    out = os.path.join(test_dir, "media", f"l{n}_q{q['num']}.mp3")
                    A.cut(audio, s, e, out)
                    q["audio"] = _rel(out, test_dir)
                    q["stem"] = A.question_stem(qsegs)
                    if not q["stem"].rstrip().endswith("?"):  # Whisper skipped it in the full recording
                        clip = A.transcribe(out, os.path.join(WORK, "transcripts", "clips", src["id"]))
                        q["stem"] = A.question_stem(clip) or q["stem"]
                    section["questions"].append(q)
                part["sections"].append(section)
            if not groups:
                part["sections"].append({"media": None, "transcript": "", "questions": qs})
                qi = len(qs)
            if qi != len(qs):
                rep.warn(f"listening part {n}: {len(qs)} booklet questions but {qi} spoken questions")
        elif n == 5:
            section = {"media": None, "transcript": "", "questions": qs}
            if src.get("listening_video") and not skip_audio:
                out = os.path.join(test_dir, "media", "l5_video.mp4")
                if not os.path.exists(out):
                    A.convert_video(src["listening_video"], out)
                vsegs = A.transcribe(src["listening_video"], os.path.join(WORK, "transcripts"))
                section["transcript"] = A.text_of(vsegs)
                section["media"] = {"type": "video", "src": _rel(out, test_dir), "duration": round(A.duration(out), 1)}
            else:
                rep.warn("listening part 5: no video")
            part["sections"].append(section)
        else:
            section = {"media": None, "transcript": "", "questions": qs}
            if seg and seg["groups"] and seg["groups"][0]["passage"]:
                g = seg["groups"][0]
                s, e = A.span(g["passage"])
                out = os.path.join(test_dir, "media", f"l{n}_passage.mp3")
                A.cut(audio, s, e, out)
                section["media"] = {"type": "audio", "src": _rel(out, test_dir), "duration": round(e - s, 1)}
                section["transcript"] = A.text_of(g["passage"])
            part["sections"].append(section)
        for sec in part["sections"]:
            for q in sec["questions"]:
                for o in q["options"]:
                    if "image" in o:
                        o["image"] = _rel(o["image"], test_dir)
        parts.append(part)
    return {"parts": parts}


LISTEN_INTRO = {
    1: ["You will hear a conversation in three sections.", "You will hear each section only once.",
        "After each section, you will hear two or three questions.", "You will hear the questions only once.",
        "Choose the best answer to each question."],
    2: ["You will hear a conversation followed by five questions.", "You will hear the conversation only once.",
        "You will hear the questions only once.", "Choose the best answer to each question."],
    3: ["You will hear a conversation followed by six questions.", "You will hear the conversation only once.",
        "You will hear the questions only once.", "Choose the best answer to each question."],
    4: ["You will hear a news item once.", "Then five questions will appear.",
        "Choose the best way to complete each statement from the drop-down menu."],
    5: ["You will watch a two-minute video, then eight questions will appear.",
        "Choose the best way to answer each question."],
    6: ["You will hear a report once.", "Then six questions will appear.",
        "Choose the best way to answer each question from the drop-down menu."],
}


def _audio_media(src_path: str, test_dir: str, name: str) -> dict:
    out = os.path.join(test_dir, "media", name)
    A.convert_audio(src_path, out)
    return {"type": "audio", "src": _rel(out, test_dir), "duration": round(A.duration(out), 1)}


def build_listening_book(src: dict, test_dir: str, rep: Report) -> dict:
    """Book-format tests ship one audio clip per passage and per spoken question."""
    media = os.path.join(test_dir, "media")
    booklet = book.parse_listening(src["listening_booklet"], media)
    key = book.parse_answers(src["listening_answers"], os.path.join(WORK, "keyimg", src["id"])) \
        if src.get("listening_answers") else {}
    tdir = os.path.join(WORK, "transcripts", "clips", src["id"])
    skip_audio = os.environ.get("CELPIP_SKIP_AUDIO") == "1"
    parts = []
    for n in range(1, 7):
        b = booklet.get(n, {"intro": [], "questions": []})
        qs = b["questions"]
        part = {"n": n, "title": LISTENING_TITLES[n], "kind": LISTEN_KIND[n], "intro": b["intro"] + LISTEN_INTRO[n],
                "sections": []}
        for q in qs:
            q["answer"] = resolve_answer(q, key.get((n, q["num"])), rep, f"L{n}Q{q['num']}")
            q["id"] = f"L{n}-{q['num']}"
        if n <= 3:
            clips = src["listening_clips"].get(n, {"passages": {}, "questions": {}})
            firsts = sorted(clips["passages"]) or [1]
            for si, first in enumerate(firsts):
                last = firsts[si + 1] if si + 1 < len(firsts) else 99
                section = {"media": None, "transcript": "", "questions": [q for q in qs if first <= q["num"] < last]}
                passage = clips["passages"].get(first)
                if passage and not skip_audio:
                    section["media"] = _audio_media(passage, test_dir, f"l{n}_s{si + 1}.mp3")
                    section["transcript"] = A.text_of(A.transcribe(passage, tdir))
                elif not skip_audio:
                    rep.warn(f"listening part {n}: no passage audio for section {si + 1}")
                for q in section["questions"]:
                    clip = clips["questions"].get(q["num"])
                    if not clip:
                        rep.warn(f"L{n}Q{q['num']}: no question audio")
                        continue
                    if not skip_audio:
                        q["audio"] = _audio_media(clip, test_dir, f"l{n}_q{q['num']}.mp3")["src"]
                        q["stem"] = A.question_stem(A.transcribe(clip, tdir))
                part["sections"].append(section)
        elif n == 5:
            section = {"media": None, "transcript": "", "questions": qs}
            if src.get("listening_video") and not skip_audio:
                out = os.path.join(media, "l5_video.mp4")
                A.convert_video(src["listening_video"], out)
                section["transcript"] = A.text_of(A.transcribe(src["listening_video"], os.path.join(WORK, "transcripts")))
                section["media"] = {"type": "video", "src": _rel(out, test_dir), "duration": round(A.duration(out), 1)}
            elif not skip_audio:
                rep.warn("listening part 5: no video")
            part["sections"].append(section)
        else:
            section = {"media": None, "transcript": "", "questions": qs}
            passage = src["listening_part_audio"].get(n)
            if passage and not skip_audio:
                section["media"] = _audio_media(passage, test_dir, f"l{n}_passage.mp3")
                section["transcript"] = A.text_of(A.transcribe(passage, tdir))
            elif not skip_audio:
                rep.warn(f"listening part {n}: no audio")
            part["sections"].append(section)
        for q in qs:
            for o in q["options"]:
                if "image" in o:
                    o["image"] = _rel(o["image"], test_dir)
        parts.append(part)
    return {"parts": parts}


def _verified(skill: str, n: int, q: dict, key: dict, notes: dict, expl, rep: Report):
    """Answer from the hand-verified key; any disagreement with the explanation document must carry a note."""
    k = (skill, n, q["num"])
    ans = key.get(k)
    if ans is None:
        rep.warn(f"{skill}{n}Q{q['num']}: not in the verified key, using the explanation's answer (unverified)")
        return expl
    if expl is not None and expl != ans and k not in notes:
        rep.warn(f"{skill}{n}Q{q['num']}: key says {ans + 1}, explanation says {expl + 1}, no note")
    return ans


def _speaker_lines(lines: list) -> str:
    return "\n".join(re.sub(r"^([A-Za-z]+):(?=\S)", r"\1: ", t) for t in lines)


def build_listening_word(src: dict, test_dir: str, rep: Report) -> dict:
    """Questions, options and transcripts come from the explanation document; audio is one clip per passage
    and per spoken question, so no transcription is needed."""
    media = os.path.join(test_dir, "media")
    booklet = wordtest.parse_listening(src["listening_booklet"], media)
    clips = wordtest.listening_clips(src["listening_audio_dir"])
    key, notes, fixes = wordtest.load_key(src["id"])
    skip_audio = os.environ.get("CELPIP_SKIP_AUDIO") == "1"
    parts = []
    for n in range(1, 7):
        b = booklet.get(n, {"intro": [], "sections": []})
        c = clips.get(n, {"passages": {}, "questions": {}, "passage": None})
        part = {"n": n, "title": LISTENING_TITLES[n], "kind": LISTEN_KIND[n], "intro": b["intro"] + LISTEN_INTRO[n],
                "sections": []}
        for si, s in enumerate(b["sections"]):
            passage = c["passages"].get(si + 1) if n == 1 else c["passage"]
            section = {"media": None, "transcript": _speaker_lines(s["transcript"]), "questions": []}
            if not passage:
                rep.warn(f"listening part {n}: no audio for section {si + 1}")
            elif skip_audio:
                pass
            elif n == 5:
                out = os.path.join(media, "l5_video.mp4")
                A.convert_video(passage, out)
                section["media"] = {"type": "video", "src": _rel(out, test_dir), "duration": round(A.duration(out), 1)}
            else:
                name = f"l{n}_s{si + 1}.mp3" if n == 1 else f"l{n}_passage.mp3"
                section["media"] = _audio_media(passage, test_dir, name)
            for q in s["questions"]:
                item = {"id": f"L{n}-{q['num']}", "num": q["num"], "options": q["options"],
                        "answer": _verified("L", n, q, key, notes, q["explAnswer"], rep)}
                if n <= 3:
                    item["stem"] = q["stem"]
                    clip = c["questions"].get(q["num"])
                    if not clip:
                        rep.warn(f"L{n}Q{q['num']}: no question audio")
                    elif not skip_audio:
                        item["audio"] = _audio_media(clip, test_dir, f"l{n}_q{q['num']}.mp3")["src"]
                else:
                    item["prompt"] = q["stem"]
                for o in item["options"]:
                    if "image" in o:
                        o["image"] = _rel(o["image"], test_dir)
                section["questions"].append(item)
            part["sections"].append(section)
        parts.append(part)
    return wordtest.apply_fixes({"parts": parts}, fixes)


def build_reading(src: dict, test_dir: str, rep: Report) -> dict:
    img_dir = os.path.join(test_dir, "media")
    if src.get("format") == "word":
        booklet, expl = wordtest.parse_reading(src["reading_booklet"], img_dir)
        key, notes, fixes = wordtest.load_key(src["id"])
        parts = []
        for n in range(1, 5):
            p = booklet[n]
            for b in p["left"] + p["right"]:
                if b["type"] == "image":
                    b["src"] = _rel(b["src"], test_dir)
                for q in b.get("items", []):
                    q["answer"] = _verified("R", n, q, key, notes, expl.get((n, q["num"])), rep)
                    q["id"] = f"R{n}-{q['num']}"
            parts.append({"n": n, "title": READING_TITLES[n], "intro": READING_INTRO[n], **p})
        return wordtest.apply_fixes({"parts": parts}, fixes)
    if src.get("reading_docx"):
        booklet = docx_reading.parse_reading(src["reading_docx"], img_dir)
    elif src.get("format") == "book":
        booklet = book.parse_reading(src["reading_booklet"], img_dir)
    else:
        booklet = parse_reading_booklet(build_stream(src["reading_booklet"], img_dir=img_dir, img_prefix="reading"))
    if src.get("reading_answer_screens"):
        key = docx_reading.parse_answer_screens(src["reading_answer_screens"], os.path.join(WORK, "keyimg", src["id"]))
    elif not src.get("reading_answers"):
        key = {}
    elif src.get("format") == "book":
        key = book.parse_answers(src["reading_answers"])
    else:
        key = parse_answer_key(build_stream(src["reading_answers"], pictures=False), "Reading")
    parts = []
    for n in range(1, 5):
        p = booklet.get(n)
        if not p:
            rep.warn(f"reading part {n}: missing")
            continue
        for b in p["left"] + p["right"]:
            if b["type"] == "image":
                b["src"] = _rel(b["src"], test_dir)
            for q in b.get("items", []):
                q["answer"] = resolve_answer(q, key.get((n, q["num"])), rep, f"R{n}Q{q['num']}")
                q["id"] = f"R{n}-{q['num']}"
        parts.append({"n": n, "title": READING_TITLES[n], "intro": READING_INTRO[n], **p})
    return {"parts": parts}


def build_writing(src: dict, test_dir: str, rep: Report) -> dict:
    if src.get("format") == "word":
        tasks = wordtest.parse_writing(src["writing_booklet"], src.get("writing_samples"),
                                       os.path.join(WORK, "wordocr", src["id"]))
    elif src.get("format") == "book":
        tasks = book.parse_writing(src["writing_booklet"], src.get("writing_samples"))
    elif src.get("writing_booklet"):
        tasks = parse_writing(src["writing_booklet"], src.get("writing_samples"))
    else:  # prompt booklet only exists as a video; the samples PDF repeats the prompts
        tasks = parse_writing_from_samples(src["writing_samples"])
    for t in tasks:
        t["minutes"] = 27 if t["n"] == 1 else 26
        if not t["instruction"]:
            rep.warn(f"writing task {t['n']}: no instruction parsed")
    return {"tasks": tasks}


def build_speaking(src: dict, test_dir: str, rep: Report) -> dict:
    if src.get("format") == "word":
        tasks = wordtest.parse_speaking(src["speaking_booklet"], os.path.join(test_dir, "media"),
                                        src.get("speaking_samples"))
    else:
        parse = book.parse_speaking if src.get("format") == "book" else parse_speaking
        tasks = parse(src["speaking_booklet"], os.path.join(test_dir, "media"))
    for t in tasks:
        for k in ("images", "options"):
            if t.get(k):
                t[k] = [_rel(x, test_dir) for x in t[k]]
        if t.get("otherOption"):
            t["otherOption"] = _rel(t["otherOption"], test_dir)
    return {"tasks": tasks}


def build_test(test_id: str) -> dict:
    m = re.match(r"^s(\d+)-t(\d)$", test_id)
    src = discover(int(m.group(1)), int(m.group(2)))
    print(f"== {test_id}")
    for k, v in src.items():
        if k not in ("id", "set", "test") and not v:
            print(f"  (missing source: {k})")
    test_dir = os.path.join(OUT, "tests", test_id)
    shutil.rmtree(test_dir, ignore_errors=True)
    os.makedirs(os.path.join(test_dir, "media"), exist_ok=True)
    rep = Report()
    test = {"id": test_id, "set": src["set"], "test": src["test"],
            "title": src.get("title") or f"Practice Test {src['set']}-{src['test']}"}
    if src.get("label"):
        test["label"] = src["label"]
    listening = {"book": build_listening_book, "word": build_listening_word}.get(src.get("format"), build_listening)
    for skill, fn, need in (("listening", listening, "listening_booklet"), ("reading", build_reading, "reading_booklet"),
                            ("writing", build_writing, "writing_booklet"), ("speaking", build_speaking, "speaking_booklet")):
        if not src.get(need) and not (skill == "writing" and src.get("writing_samples")) \
                and not (skill == "reading" and src.get("reading_docx")):
            rep.warn(f"{skill}: source missing")
            continue
        try:
            test[skill] = fn(src, test_dir, rep)
        except Exception as e:  # keep building the other skills
            traceback.print_exc()
            rep.warn(f"{skill}: build failed: {e}")
    test["warnings"] = rep.warnings
    with open(os.path.join(test_dir, "test.json"), "w") as f:
        json.dump(test, f, ensure_ascii=False, indent=1)
    return test


def write_index() -> None:
    tests = []
    tdir = os.path.join(OUT, "tests")
    for d in sorted(os.listdir(tdir)):
        p = os.path.join(tdir, d, "test.json")
        if not os.path.exists(p):
            continue
        with open(p) as f:
            t = json.load(f)
        tests.append({"id": t["id"], "set": t["set"], "test": t["test"], "title": t["title"], **({"label": t["label"]} if t.get("label") else {}),
                      "skills": [s for s in ("listening", "reading", "writing", "speaking") if s in t],
                      "warnings": len(t.get("warnings", []))})
    tests.sort(key=lambda t: (t["set"], t["test"]))
    with open(os.path.join(OUT, "index.json"), "w") as f:
        json.dump({"tests": tests}, f, ensure_ascii=False, indent=1)


def all_ids() -> list:
    ids = []
    for s in sorted(standard_set_dirs()):
        for t in (1, 2):
            if discover(s, t).get("reading_booklet") or discover(s, t).get("listening_booklet"):
                ids.append(f"s{s:02d}-t{t}")
    return ids


if __name__ == "__main__":
    ids = all_ids() if sys.argv[1:] == ["all"] else sys.argv[1:]
    for tid in ids:
        build_test(tid)
    write_index()
