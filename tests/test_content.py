import os
import sys

import pytest

sys.path.insert(0, os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "scripts"))

from validate import built_ids, validate_test  # noqa: E402
from parse_common import strip_junk, best_match  # noqa: E402
from doc import norm  # noqa: E402
from parse_reading import _cloze  # noqa: E402
from wordtest import KEY_FILE, _answer_from_explanation, apply_fixes, blanks_to_tokens, load_key  # noqa: E402

TESTS_DIR = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "public", "content", "tests")


@pytest.mark.parametrize("test_id", built_ids())
def test_built_content_is_complete(test_id):
    assert validate_test(test_id) == []


def test_strip_junk_removes_dropdown_glyphs():
    assert strip_junk("Greg is hoping to r") == "Greg is hoping to"
    assert strip_junk("Greg became emotional when •") == "Greg became emotional when"
    assert strip_junk("Greg's grandpa") == "Greg's grandpa"


def test_norm_fixes_split_apostrophes():
    assert norm("didn' t find the old house .") == "didn't find the old house."
    assert norm("Asha Miller' s campaign") == "Asha Miller's campaign"


def test_best_match_picks_answer_option():
    opts = ["visit Montreal.", "visit the Kootenays.", "go to Calgary.", "see you here."]
    assert best_match("see you here.", opts)[0] == 3


def test_cloze_inserts_tokens_in_order():
    paras = ["I'd love to 7. • Now with my old bones, I'm not so sure that 8.", "there's no need to 9. * I can"]
    out = _cloze(paras, [7, 8, 9])
    assert out == ["I'd love to {{7}} Now with my old bones, I'm not so sure that {{8}}", "there's no need to {{9}} I can"]


def test_cloze_skips_email_addresses_and_strips_misread_arrows():
    paras = ["To: Jo <jo@canmail.ca>",
             "Billy 1. v so he will. Our 2.r this Friday, I 3. vand so on, to 4.- Being, the fact that5. really"]
    out = _cloze(paras, [1, 2, 3, 4, 5])
    assert out == ["To: Jo <jo@canmail.ca>", "Billy {{1}} so he will. Our {{2}} this Friday, I {{3}} and so on, "
                   "to {{4}} Being, the fact that {{5}} really"]


def test_word_blanks_keep_words_after_the_number():
    out = blanks_to_tokens(["I 1.       I hope you 2.  . Write to jo2.@mail.ca"], [1, 2])
    assert out == ["I {{1}} I hope you {{2}}. Write to jo2.@mail.ca"]


def test_answer_from_explanation_formats():
    opts = ["a new park.", "a bigger library.", "more buses.", "a pool."]
    assert _answer_from_explanation(["正确答案是第3项：more buses"], opts) == 2
    assert _answer_from_explanation(["a new park.：这一项不对", "第1项 不对", "他想要 a bigger library"], opts) == 1
    assert _answer_from_explanation(["答案: D"], letters=True) == 3
    assert _answer_from_explanation(["B 段最能支持这个说法"], letters=True) == 1


def test_apply_fixes_whole_and_distinctive_substrings():
    fixes = [["impricise.", "imprecise."], ["The news report ends wit", "The news report ends with"]]
    obj = {"a": ["impricise.", "very impricise."], "b": "The news report ends wit"}
    assert apply_fixes(obj, fixes) == {"a": ["imprecise.", "very impricise."], "b": "The news report ends with"}


@pytest.mark.parametrize("test_id", ["s13-t1", "s13-t2"])
def test_set13_answers_follow_the_verified_key(test_id):
    import json
    path = os.path.join(TESTS_DIR, test_id, "test.json")
    if not os.path.exists(path) or not os.path.exists(KEY_FILE):
        pytest.skip("set 13 not built")
    with open(path) as f:
        test = json.load(f)
    key, _, _ = load_key(test_id)
    seen = {}
    for p in test["listening"]["parts"]:
        for s in p["sections"]:
            for q in s["questions"]:
                seen[("L", p["n"], q["num"])] = q["answer"]
    for p in test["reading"]["parts"]:
        for b in p["left"] + p["right"]:
            for q in b.get("items", []):
                seen[("R", p["n"], q["num"])] = q["answer"]
    assert seen == key
