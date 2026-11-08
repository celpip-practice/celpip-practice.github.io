"""Validate built test content. Usage: validate.py [test_id ...]  (default: all built tests)"""
import json
import os
import re
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
TESTS = os.path.join(ROOT, "public", "content", "tests")

LISTENING_COUNTS = {1: 8, 2: 5, 3: 6, 4: 5, 5: 8, 6: 6}
READING_COUNTS = {1: 11, 2: 8, 3: 9, 4: 10}
# Defects printed in the source booklets themselves, verified against the page images.
KNOWN_SOURCE_DEFECTS = {
    "s06-t1": {"R4Q8: duplicate options"},
}


def _media_ok(test_dir, rel, errs, label):
    if not rel or not os.path.exists(os.path.join(test_dir, rel)) or os.path.getsize(os.path.join(test_dir, rel)) < 1000:
        errs.append(f"{label}: missing media {rel}")


def _check_q(q, n_opts, errs, label, test_dir):
    opts = q.get("options", [])
    if len(opts) != n_opts:
        errs.append(f"{label}: {len(opts)} options (expected {n_opts}) {opts}")
    for o in opts:
        text = o.get("text") if isinstance(o, dict) else o
        if isinstance(o, dict) and "image" in o:
            _media_ok(test_dir, o["image"], errs, label)
        elif not text or len(text.strip()) == 0:
            errs.append(f"{label}: empty option")
    if not isinstance(q.get("answer"), int) or not (0 <= q["answer"] < max(1, len(opts))):
        errs.append(f"{label}: invalid answer {q.get('answer')}")
    if len({(o.get('text') or o.get('image')) if isinstance(o, dict) else o for o in opts}) != len(opts):
        errs.append(f"{label}: duplicate options")


def validate_test(test_id: str) -> list:
    test_dir = os.path.join(TESTS, test_id)
    with open(os.path.join(test_dir, "test.json")) as f:
        t = json.load(f)
    errs = []
    L = t.get("listening")
    if not L:
        errs.append("listening missing")
    else:
        parts = {p["n"]: p for p in L["parts"]}
        for n, cnt in LISTENING_COUNTS.items():
            p = parts.get(n)
            if not p:
                errs.append(f"L{n} missing"); continue
            qs = [q for s in p["sections"] for q in s["questions"]]
            if len(qs) != cnt:
                errs.append(f"L{n}: {len(qs)} questions (expected {cnt})")
            if n == 1 and len(p["sections"]) != 3:
                errs.append(f"L1: {len(p['sections'])} sections (expected 3)")
            for s in p["sections"]:
                if not s.get("media"):
                    errs.append(f"L{n}: section without media")
                else:
                    _media_ok(test_dir, s["media"]["src"], errs, f"L{n}")
            for q in qs:
                _check_q(q, 4, errs, f"L{n}Q{q['num']}", test_dir)
                if n <= 3 and not q.get("audio"):  # recordings without spoken questions show the stem as text
                    if not (q.get("stem") or "").endswith("?"):
                        errs.append(f"L{n}Q{q['num']}: neither question audio nor a printed stem")
                elif n <= 3:
                    _media_ok(test_dir, q.get("audio"), errs, f"L{n}Q{q['num']} audio")
                elif not q.get("prompt"):
                    errs.append(f"L{n}Q{q['num']}: missing prompt")
    R = t.get("reading")
    if not R:
        errs.append("reading missing")
    else:
        parts = {p["n"]: p for p in R["parts"]}
        for n, cnt in READING_COUNTS.items():
            p = parts.get(n)
            if not p:
                errs.append(f"R{n} missing"); continue
            qs = [q for b in p["right"] for q in b.get("items", [])]
            nums = [q["num"] for q in qs]
            if nums != list(range(1, cnt + 1)):
                errs.append(f"R{n}: question numbers {nums} (expected 1..{cnt})")
            if not any(b["type"] in ("text", "image") and (b.get("paragraphs") or b.get("src")) for b in p["left"]):
                errs.append(f"R{n}: no passage")
            for b in p["left"]:
                if b["type"] == "image":
                    _media_ok(test_dir, b["src"], errs, f"R{n} image")
            for b in p["right"]:
                if b["type"] == "cloze":
                    tokens = [int(x) for x in re.findall(r"\{\{(\d+)\}\}", " ".join(b["paragraphs"]))]
                    if tokens != [q["num"] for q in b["items"]]:
                        errs.append(f"R{n}: cloze tokens {tokens} != items {[q['num'] for q in b['items']]}")
            for q in qs:
                _check_q(q, 5 if n == 3 else 4, errs, f"R{n}Q{q['num']}", test_dir)
                if n != 3 and not q.get("prompt") and not any(b["type"] == "cloze" and q in b["items"] for b in p["right"]):
                    errs.append(f"R{n}Q{q['num']}: missing prompt")
    W = t.get("writing")
    if not W:
        errs.append("writing missing")
    else:
        if [x["n"] for x in W["tasks"]] != [1, 2]:
            errs.append(f"writing tasks {[x['n'] for x in W['tasks']]}")
        for x in W["tasks"]:
            if not x["scenario"] or not x["instruction"]:
                errs.append(f"W{x['n']}: missing scenario/instruction")
            if x["n"] == 1 and len(x["bullets"]) not in (3, 4):
                errs.append(f"W1: {len(x['bullets'])} bullets")
            if x["n"] == 2 and len(x["options"]) != 2:
                errs.append(f"W2: {len(x['options'])} options")
    S = t.get("speaking")
    if not S:
        errs.append("speaking missing")
    else:
        ns = [x["n"] for x in S["tasks"] if x["n"] > 0]
        if ns != list(range(1, 9)):
            errs.append(f"speaking tasks {ns}")
        for x in S["tasks"]:
            if not x.get("prompt"):
                errs.append(f"S{x['n']}: missing prompt")
            if x["n"] in (3, 4, 8) and not x.get("images"):
                errs.append(f"S{x['n']}: missing picture")
            for img in x.get("images", []) + x.get("options", []):
                _media_ok(test_dir, img, errs, f"S{x['n']}")
            if x["n"] == 5 and (len(x.get("options", [])) != 2 or not x.get("otherOption")):
                errs.append("S5: needs 2 options + other option")
            if x["n"] == 6 and len(x.get("choices", [])) != 2:
                errs.append("S6: needs 2 choices")
    # A skill whose material does not exist in the download (e.g. video-only speaking) is a source gap, not a bug.
    absent = {f"{w.split(':')[0]} missing" for w in t.get("warnings", []) if w.endswith(": source missing")}
    return [e for e in errs if e not in KNOWN_SOURCE_DEFECTS.get(test_id, set()) and e not in absent]


def built_ids() -> list:
    return sorted(d for d in os.listdir(TESTS) if os.path.exists(os.path.join(TESTS, d, "test.json")))


if __name__ == "__main__":
    ids = sys.argv[1:] or built_ids()
    bad = 0
    for tid in ids:
        errs = validate_test(tid)
        print(f"{tid}: {'OK' if not errs else f'{len(errs)} problem(s)'}")
        for e in errs:
            print("   -", e)
        bad += bool(errs)
    sys.exit(1 if bad else 0)
