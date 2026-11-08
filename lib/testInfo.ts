/** Build-time access to the test library for the static SEO pages. Reads only the bundled content folder. */
import fs from "node:fs";
import path from "node:path";
import type { Skill, Test, TestSummary } from "./types";

const CONTENT = path.join(process.cwd(), "public", "content");
const ID_RE = /^[a-z0-9-]+$/;

export function loadIndex(): TestSummary[] {
  return JSON.parse(fs.readFileSync(path.join(CONTENT, "index.json"), "utf8")).tests;
}

export function loadTestFile(id: string): Test {
  if (!ID_RE.test(id)) throw new Error(`Bad test id: ${id}`);
  return JSON.parse(fs.readFileSync(path.join(CONTENT, "tests", id, "test.json"), "utf8"));
}

export interface PartSummary {
  n: number;
  title: string;
  questions?: number;
  topic?: string;
}

function firstSentence(text: string | undefined) {
  if (!text) return undefined;
  const m = text.trim().match(/^.*?[.?!](?=\s|$)/);
  return (m ? m[0] : text).trim();
}

/** Generic part instructions say nothing about the topic; only scene-setting sentences are worth showing. */
const SCENE = /^You will (hear|watch) (a|an) .*\b(between|about|among|with)\b/;

export function summarize(test: Test): Partial<Record<Skill, PartSummary[]>> {
  const out: Partial<Record<Skill, PartSummary[]>> = {};
  if (test.listening) {
    out.listening = test.listening.parts.map((p) => {
      const scene = p.intro.find((s) => SCENE.test(s));
      return { n: p.n, title: p.title, questions: p.sections.reduce((k, s) => k + s.questions.length, 0), topic: firstSentence(scene) };
    });
  }
  if (test.reading) {
    out.reading = test.reading.parts.map((p) => ({
      n: p.n,
      title: p.title,
      questions: [...p.left, ...p.right].reduce((k, b) => k + (b.type === "questions" || b.type === "cloze" ? b.items.length : 0), 0),
    }));
  }
  if (test.writing) {
    out.writing = test.writing.tasks.map((w) => ({
      n: w.n,
      title: w.title,
      topic: w.surveyTitle ?? firstSentence(w.scenario[0]),
    }));
  }
  if (test.speaking) {
    out.speaking = test.speaking.tasks.map((s) => ({
      n: s.n,
      title: s.title,
      topic: s.n === 3 || s.n === 4 ? undefined : firstSentence(s.prompt[0]),
    }));
  }
  return out;
}
