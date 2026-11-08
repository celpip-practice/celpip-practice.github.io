import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { countWords, estimateLevel, formatRemaining, grade } from "@/lib/scoring";
import { buildListeningScreens, nextPartStart } from "@/lib/listeningFlow";
import { createLocalStore, type Attempt } from "@/lib/store";
import { listeningQuestions, readingQuestions } from "@/lib/content";
import type { Test } from "@/lib/types";

const contentDir = path.resolve(__dirname, "../../public/content");
const index = JSON.parse(fs.readFileSync(path.join(contentDir, "index.json"), "utf8"));
const tests: Test[] = index.tests.map((t: { id: string }) =>
  JSON.parse(fs.readFileSync(path.join(contentDir, "tests", t.id, "test.json"), "utf8")),
);

function memStorage(): Storage {
  const m = new Map<string, string>();
  return {
    get length() { return m.size; },
    clear: () => m.clear(),
    getItem: (k) => m.get(k) ?? null,
    key: (i) => [...m.keys()][i] ?? null,
    removeItem: (k) => void m.delete(k),
    setItem: (k, v) => void m.set(k, v),
  };
}

describe("scoring", () => {
  it("grades answers by question id", () => {
    const qs = [{ id: "a", answer: 1 }, { id: "b", answer: 0 }, { id: "c", answer: 2 }];
    expect(grade(qs, { a: 1, b: 3 })).toEqual({ correct: 1, total: 3 });
  });
  it("estimates CELPIP levels from raw scores", () => {
    expect(estimateLevel("listening", 38, 38)).toBe("10-12");
    expect(estimateLevel("listening", 28, 38)).toBe("7");
    expect(estimateLevel("reading", 20, 38)).toBe("6");
    expect(estimateLevel("reading", 0, 38)).toBe("0-2");
  });
  it("counts words like the exam word counter", () => {
    expect(countWords("I'd love to see you here, Grandpa!")).toBe(7);
    expect(countWords("   ")).toBe(0);
    expect(countWords("well-known 150-200 words")).toBe(3);
  });
  it("formats remaining time in minutes, then seconds", () => {
    expect(formatRemaining(26 * 60)).toEqual({ value: "26", unit: "minutes" });
    expect(formatRemaining(61)).toEqual({ value: "2", unit: "minutes" });
    expect(formatRemaining(45)).toEqual({ value: "45", unit: "seconds" });
  });
});

describe("progress store", () => {
  it("saves attempts and reports the best part score", () => {
    const s = createLocalStore(memStorage());
    const base: Attempt = { id: "1", testId: "t", mode: "practice", skill: "listening", parts: [1], startedAt: 0, finishedAt: 1, answers: {} };
    s.saveAttempt({ ...base, score: { correct: 3, total: 8 } });
    s.saveAttempt({ ...base, id: "2", finishedAt: 2, score: { correct: 6, total: 8 } });
    s.saveAttempt({ ...base, id: "3", finishedAt: 3, parts: [1, 2], score: { correct: 13, total: 13 } });
    expect(s.bestPartScore("t", "listening", 1)).toEqual({ correct: 6, total: 8 });
    expect(s.listAttempts().map((a) => a.id)).toEqual(["3", "2", "1"]);
  });
});

describe.each(tests.map((t) => [t.id, t] as const))("content %s", (_id, test) => {
  const warnings = (test as Test & { warnings?: string[] }).warnings ?? [];

  it("only omits skills whose source material is absent", () => {
    for (const skill of ["listening", "reading", "writing", "speaking"] as const) {
      if (!test[skill]) expect(warnings).toContain(`${skill}: source missing`);
    }
  });

  it.runIf(!!test.listening)("has 38 listening questions with answers", () => {
    const L = test.listening!.parts.flatMap(listeningQuestions);
    expect(L).toHaveLength(38);
    for (const q of L) expect(q.answer).not.toBeNull();
    expect(new Set(L.map((q) => q.id)).size).toBe(38);
  });

  it.runIf(!!test.reading)("has 38 reading questions with answers", () => {
    const R = test.reading!.parts.flatMap(readingQuestions);
    expect(R).toHaveLength(38);
    for (const q of R) expect(q.answer).not.toBeNull();
    expect(new Set(R.map((q) => q.id)).size).toBe(38);
  });

  it.runIf(!!test.listening)("builds the official listening screen sequence", () => {
    const screens = buildListeningScreens(test.listening!.parts);
    const p1 = screens.filter((s) => s.part.n === 1).map((s) => s.type);
    // intro, then 3 x (conversation section + its questions)
    expect(p1[0]).toBe("intro");
    expect(p1.filter((t) => t === "media")).toHaveLength(3);
    expect(p1.filter((t) => t === "question")).toHaveLength(8);
    for (const n of [4, 5, 6]) {
      expect(screens.filter((s) => s.part.n === n).map((s) => s.type)).toEqual(["intro", "media", "questions"]);
    }
    const p2Start = nextPartStart(screens, 0);
    expect(screens[p2Start].part.n).toBe(2);
    expect(screens[p2Start].type).toBe("intro");
  });

  it.runIf(!!test.writing)("has two writing tasks", () => {
    expect(test.writing!.tasks.map((t) => t.n)).toEqual([1, 2]);
  });

  it.runIf(!!test.speaking)("has eight speaking tasks", () => {
    expect(test.speaking!.tasks.filter((t) => t.n > 0).map((t) => t.n)).toEqual([1, 2, 3, 4, 5, 6, 7, 8]);
  });
});
