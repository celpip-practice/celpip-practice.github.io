"""Writing and speaking booklet parsers."""
import re

import os

from doc import build_stream, norm, paragraphs
from images import content_box, crop, similarity, split_column
from ocr_pdf import ocr_pdf

LEVEL = re.compile(r"CELPIP\s*(\d+)\s*-\s*(\d+)\s*(RESPONSE|Response)")
SKIP_ROW = re.compile(r"^(Time remaining|NEXT|BACK|Click here|responses\.|Return to Task|\* ?NOTE|NOTE:|"
                      r"Copyright \d{4}\b)", re.I)

SPEAKING_TIMES = {  # (prep seconds, speak seconds) - official CELPIP-General timings
    0: (30, 60), 1: (30, 90), 2: (30, 60), 3: (30, 60), 4: (30, 60), 5: (60, 60), 6: (60, 60), 7: (30, 90), 8: (30, 60),
}
SPEAKING_TITLES = {
    0: "Practice Task", 1: "Giving Advice", 2: "Talking about a Personal Experience", 3: "Describing a Scene",
    4: "Making Predictions", 5: "Comparing and Persuading", 6: "Dealing with a Difficult Situation",
    7: "Expressing Opinions", 8: "Describing an Unusual Situation",
}
DEFAULT_PROMPTS = {
    4: "In this picture, what do you think will most likely happen next?",
}


def _clean_bullet(t: str) -> str:
    return norm(re.sub(r"^[•*®©·\-]\s*", "", t))


def parse_writing(pdf: str, samples_pdf: str = None) -> list:
    cols = build_stream(pdf, columns=[0.33], pictures=False)
    flat = build_stream(pdf, pictures=False)
    tasks = {}
    task_pages = {}
    for it in cols:
        m = re.search(r"Writing Task\s*(\d)\s*:\s*(.+)$", it.text)
        if m and it.col == 0:
            n = int(m.group(1))
            if n not in tasks:
                tasks[n] = {"n": n, "title": norm(m.group(2)), "scenario": [], "instruction": "", "bullets": [], "options": [],
                            "surveyTitle": None, "samples": []}
                task_pages[it.page] = n
    for n, t in tasks.items():
        page = [p for p, k in task_pages.items() if k == n][0]
        left = [r for r in cols if r.page == page and r.col == 0 and not SKIP_ROW.match(r.text)]
        right = [r for r in cols if r.page == page and r.col == 1 and not SKIP_ROW.match(r.text)]
        left = [r for r in left if "Writing Task" not in r.text]
        if left and re.search(r"Read the following", left[0].text):
            left = left[1:]
        if n == 2 and left and not left[0].text.endswith(".") and left[0].w < 0.25:
            t["surveyTitle"] = left[0].text
            left = left[1:]
        t["scenario"] = paragraphs(left)
        instr, bullets, options = [], [], []
        for r in right:
            tx = _clean_bullet(r.text)
            opt = re.search(r"Option\s+[A-C]\s*:.*$", tx)  # may follow a radio-button glyph read as "O"
            if opt and opt.start() <= 3:
                options.append(opt.group(0)); continue
            if r.bullet and instr and (bullets or instr[-1].endswith(":")) or (bullets and r.bullet):
                bullets.append(tx)
            elif bullets and not r.bullet:
                bullets[-1] += " " + tx
            elif r.bullet and not instr:
                instr.append(tx)
            elif options:
                options[-1] += " " + tx
            else:
                instr.append(tx)
        t["instruction"] = norm(" ".join(instr))
        t["bullets"] = [norm(b) for b in bullets]
        t["options"] = [norm(o) for o in options]

    # Sample responses: pages where one level tab is upper-case ("CELPIP 7-8 RESPONSE").
    current_task = None
    by_page = {}
    for it in flat:
        by_page.setdefault(it.page, []).append(it)
    for page, rows in sorted(by_page.items()):
        if page in task_pages:
            current_task = task_pages[page]
            continue
        active = None
        for r in rows:
            for m in LEVEL.finditer(r.text):
                if m.group(3) == "RESPONSE":
                    active = f"{m.group(1)}-{m.group(2)}"
        if not active or current_task is None:
            continue
        last_level = max(i for i, r in enumerate(rows) if LEVEL.search(r.text))
        body = [r for r in rows[last_level + 1:] if not SKIP_ROW.match(r.text) and len(r.text) > 1]
        tasks[current_task]["samples"].append({"level": active, "paragraphs": paragraphs(body)})
    if samples_pdf and not any(t["samples"] for t in tasks.values()):
        for t in parse_writing_samples(samples_pdf):
            if t["n"] in tasks:
                tasks[t["n"]]["samples"] = t["samples"]
    return [tasks[k] for k in sorted(tasks)]


def parse_writing_from_samples(pdf: str) -> list:
    """Tasks from a sample-responses PDF, for tests whose prompt booklet exists only as a video.
    Each task header is followed by the full prompt in one column, then the level-tagged responses."""
    rows = build_stream(pdf, pictures=False)
    prompts, cur = {}, None
    for r in rows:
        m = re.search(r"Writing Task\s*(\d)\s*:?\s*(.*)$", r.text)
        if m:
            cur = int(m.group(1))
            prompts.setdefault(cur, {"title": norm(m.group(2)), "rows": [], "done": False})
            continue
        if cur is None or prompts[cur]["done"]:
            continue
        if LEVEL.search(r.text):
            prompts[cur]["done"] = True
            continue
        if not re.match(r"^Read the following", r.text) and not SKIP_ROW.match(r.text):
            prompts[cur]["rows"].append(r)
    samples = {t["n"]: t["samples"] for t in parse_writing_samples(pdf)}
    tasks = []
    for n in sorted(prompts):
        p = prompts[n]
        body = p["rows"]
        survey = None
        if n == 2 and body and not body[0].text.rstrip().endswith(".") and body[0].w < 0.4:
            survey, body = body[0].text, body[1:]
        k = next((i for i, r in enumerate(body) if re.match(r"^(Write an? |Choose the option|Write about)", r.text)), len(body))
        instr, bullets, options = [], [], []
        for r in body[k:]:
            tx = _clean_bullet(r.text)
            if re.match(r"^Option\s+[A-C]\s*:", tx):
                options.append(tx)
            elif r.bullet:
                bullets.append(tx)
            elif options:
                options[-1] += " " + tx
            elif bullets:
                bullets[-1] += " " + tx
            else:
                instr.append(tx)
        tasks.append({"n": n, "title": p["title"] or ("Writing an Email" if n == 1 else "Responding to Survey Questions"),
                      "scenario": paragraphs(body[:k]), "instruction": norm(" ".join(instr)),
                      "bullets": [norm(b) for b in bullets], "options": [norm(o) for o in options],
                      "surveyTitle": survey, "samples": samples.get(n, [])})
    return tasks


def parse_writing_samples(pdf: str) -> list:
    rows = build_stream(pdf, pictures=False)
    tasks, cur, level, buf = {}, None, None, []

    def flush():
        if cur is not None and level and buf:
            tasks.setdefault(cur, {"n": cur, "samples": []})["samples"].append({"level": level, "paragraphs": paragraphs(buf)})

    for r in rows:
        m = re.search(r"Writing Task\s*(\d)", r.text)
        if m:
            flush(); cur, level, buf = int(m.group(1)), None, []; continue
        m = LEVEL.search(r.text)
        if m:
            flush(); level, buf = f"{m.group(1)}-{m.group(2)}", []; continue
        buf.append(r)
    flush()
    return list(tasks.values())


def parse_speaking(pdf: str, img_dir: str) -> list:
    stream = build_stream(pdf, img_dir=img_dir, img_prefix="speaking", captions=True)
    tasks, cur = [], None
    for it in stream:
        if it.kind == "row":
            m = re.search(r"Speaking Task\s*(\d)\s*:?\s*(.*)$", it.text)
            if m or re.search(r"Speaking Practice Task", it.text):
                n = int(m.group(1)) if m else 0
                if cur is not None and cur["n"] == n:
                    continue
                cur = {"n": n, "title": SPEAKING_TITLES[n], "items": []}
                tasks.append(cur); continue
        if cur is not None:
            cur["items"].append(it)
    # Some booklets omit the Task 1 header: its prompt follows the practice prompt's first sentence.
    if tasks and tasks[0]["n"] == 0 and not any(t["n"] == 1 for t in tasks):
        items = tasks[0]["items"]
        cut = next((k for k in range(1, len(items))
                    if items[k - 1].kind == "row" and items[k - 1].text.rstrip().endswith((".", "?", "!"))), None)
        if cut is not None:
            tasks.insert(1, {"n": 1, "title": SPEAKING_TITLES[1], "items": items[cut:]})
            tasks[0]["items"] = items[:cut]
    out = []
    for t in tasks:
        items = t["items"]
        # Side-by-side pictures: order left to right.
        for i in range(len(items) - 1):
            a, b = items[i], items[i + 1]
            if a.kind == b.kind == "pic" and abs(a.y - b.y) < 0.03 and a.page == b.page and a.x > b.x:
                items[i], items[i + 1] = b, a
        task = {"n": t["n"], "title": t["title"], "prep": SPEAKING_TIMES[t["n"]][0], "speak": SPEAKING_TIMES[t["n"]][1]}
        if t["n"] == 5:
            task.update(_speaking_task5_layout(items, ocr_pdf(pdf), img_dir) or _speaking_task5(items))
        elif t["n"] == 6:
            task.update(_speaking_task6(items))
        else:
            rows = [i for i in items if i.kind == "row" and not re.match(r"^Your (Sister's )?Choice", i.text)]
            prompt = paragraphs(rows)
            prompt = [re.sub(r"^Question:\s*", "", p) for p in prompt if p.lower() != "answer the following question."]
            if not prompt and t["n"] in DEFAULT_PROMPTS:
                prompt = [DEFAULT_PROMPTS[t["n"]]]
            task["prompt"] = prompt
            task["images"] = [i.path for i in items if i.kind == "pic"][:1]
        out.append(task)
    # Task 4 uses the Task 3 scene when its own picture is missing.
    by_n = {t["n"]: t for t in out}
    if 4 in by_n and not by_n[4].get("images") and 3 in by_n:
        by_n[4]["images"] = by_n[3]["images"]
    return out


def _speaking_task5(items: list) -> dict:
    rows_before, pics, rows_after = [], [], []
    for it in items:
        if it.kind == "pic":
            pics.append(it)
        elif not pics:
            rows_before.append(it)
        elif len(pics) == 2:
            rows_after.append(it)
    if len(pics) >= 2 and pics[0].page == pics[1].page and abs(pics[0].y - pics[1].y) < 0.05 and pics[0].x > pics[1].x:
        pics[0], pics[1] = pics[1], pics[0]
    intro = [r for r in rows_before if not re.match(r"^(Instructions|This task is made up|\d\.\s|Click next)", r.text)]
    select_prompt = paragraphs(intro)
    # The persuade instruction is full-width prose; card captions that escaped the crop are indented bullets.
    persuade_rows = [r for r in rows_after if not re.match(r"^Your (Sister's |Friend's |Partner's )?Choice", r.text, re.I)
                     and not re.search(r"Choice\s+Your", r.text) and not r.bullet and r.text_x < 0.17 and r.w > 0.3]
    options = [p.path for p in pics[:2]]
    other = None
    if len(pics) > 2:
        scored = [(max(similarity(p.path, o) for o in options), p.path) for p in pics[2:]]
        other = min(scored)[1]
    return {"selectPrompt": select_prompt, "options": options, "prompt": paragraphs(persuade_rows), "otherOption": other,
            "choose": 60}


def _is_prose(r) -> bool:
    return r.kind == "row" and not r.bullet and r.text_x < 0.17 and r.w > 0.3 and not re.search(r"Choice", r.text)


def _speaking_task5_layout(items: list, pages: list, img_dir: str):
    """Task 5 by page layout: option cards sit side by side between the selection prompt and the persuade
    sentence; their/your choice cards sit below it. Returns None when the layout is not recognised."""
    rows = [i for i in items if i.kind == "row"]
    k = max((i for i, r in enumerate(rows) if re.search(r"(speak for this part|choose one for you)", r.text, re.I)), default=None)
    if k is None:
        return None
    while k + 1 < len(rows) and rows[k + 1].page == rows[k].page and rows[k + 1].y - rows[k].y < 0.03 \
            and not re.search(r"\bpersuade", rows[k + 1].text, re.I):
        k += 1
    j = next((i for i in range(k + 1, len(rows)) if re.search(r"\bpersuade", rows[i].text, re.I)), None)
    if j is None:
        return None
    p = q = j
    while p - 1 > k and _is_prose(rows[p - 1]) and rows[p - 1].page == rows[p].page and rows[p].y - rows[p - 1].y < 0.03:
        p -= 1
    while q + 1 < len(rows) and rows[q + 1].page == rows[q].page and rows[q + 1].y - rows[q].y < 0.03 \
            and not rows[q + 1].bullet and rows[q + 1].text_x < 0.17 and not re.search(r"Choice", rows[q + 1].text):
        q += 1
    sel, per, last = rows[k], rows[p], rows[q]

    def bottom(its):
        return max(i.y + i.h for i in its) + 0.01

    if sel.page == per.page:
        band1 = (per.page, sel.y + sel.h + 0.004, per.y - 0.004)
    else:
        after_sel = [i for i in items if i.page == sel.page and i.y > sel.y + sel.h]
        band1 = (sel.page, sel.y + sel.h + 0.004, bottom(after_sel)) if after_sel else (per.page, 0.03, per.y - 0.004)
    below = [i for i in items if i.page == last.page and i.y > last.y + last.h]
    nxt = [i for i in items if i.page == last.page + 1]
    if below:
        band2 = (last.page, last.y + last.h + 0.004, bottom(below))
    elif nxt:
        band2 = (last.page + 1, 0.03, bottom(nxt))
    else:
        return None
    mine_left = any(re.match(r"^Your Choice\s*$", r.text, re.I) and r.page == band2[0]
                    and band2[1] - 0.01 < r.y < band2[2] and r.x + r.w / 2 < 0.5 for r in rows)
    os.makedirs(img_dir, exist_ok=True)
    crops = []
    for bi, (pg, y0, y1) in enumerate((band1, band2)):
        page = pages[pg]
        mid = split_column(page, y0, y1)
        for hi, (x0, x1) in enumerate(((0.04, mid), (mid, 0.96))):
            box = content_box(page, x0, y0, x1, y1)
            if box is None or box["w"] < 0.08 or box["h"] < 0.05:
                return None
            path = os.path.join(img_dir, f"speaking_t5_{bi + 1}{'ab'[hi]}.jpg")
            crop(page, box, path, pad=0)
            crops.append(path)
    return {"selectPrompt": paragraphs([r for r in rows[:k + 1]
                                        if not re.match(r"^(Instructions|This task is made up|\d\.\s|Click next)", r.text)]),
            "options": crops[:2], "prompt": paragraphs(rows[p:q + 1]), "otherOption": crops[3 if mine_left else 2],
            "choose": 60}


def _speaking_task6(items: list) -> dict:
    rows = [i for i in items if i.kind == "row"]
    scenario, choices, mode = [], [], "scenario"
    for r in rows:
        t = r.text
        if re.match(r"^Choose ONE", t, re.I):
            mode = "choices"; continue
        if mode == "choices":
            if re.fullmatch(r"(EITHER|OR)", t.strip()):
                choices.append([]); continue
            if not choices:
                choices.append([])
            choices[-1].append(r)
        else:
            scenario.append(r)
    return {"prompt": paragraphs(scenario), "choices": [" ".join(paragraphs(c)) for c in choices if c],
            "images": [i.path for i in items if i.kind == "pic"][:1]}
