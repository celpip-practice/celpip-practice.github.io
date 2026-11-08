import type { Answers } from "./types";

export interface Gradable {
  id: string;
  answer: number | null;
}

export function grade(questions: Gradable[], answers: Answers) {
  let correct = 0;
  for (const q of questions) {
    if (q.answer !== null && answers[q.id] === q.answer) correct++;
  }
  return { correct, total: questions.length };
}

/**
 * Approximate raw-score (out of 38) to CELPIP level conversion.
 * CELPIP does not publish an official table; these bands are the commonly cited estimates.
 */
export const LISTENING_BANDS: [number, string][] = [
  [35, "10-12"], [33, "9"], [30, "8"], [27, "7"], [22, "6"], [17, "5"], [11, "4"], [7, "3"], [0, "M"],
];
export const READING_BANDS: [number, string][] = [
  [33, "10-12"], [31, "9"], [28, "8"], [24, "7"], [19, "6"], [15, "5"], [10, "4"], [8, "3"], [0, "M"],
];

export function estimateLevel(skill: "listening" | "reading", correct: number, total: number): string {
  if (total <= 0) return "-";
  const scaled = Math.round((correct / total) * 38);
  const bands = skill === "listening" ? LISTENING_BANDS : READING_BANDS;
  for (const [min, level] of bands) if (scaled >= min) return level;
  return "M";
}

export function countWords(text: string): number {
  const m = text.trim().match(/[A-Za-z0-9\u00C0-\u024F]+(?:['’-][A-Za-z0-9\u00C0-\u024F]+)*/g);
  return m ? m.length : 0;
}

export function formatRemaining(seconds: number): { value: string; unit: string } {
  const s = Math.max(0, Math.ceil(seconds));
  if (s >= 60) {
    const m = Math.ceil(s / 60);
    return { value: String(m), unit: m === 1 ? "minute" : "minutes" };
  }
  return { value: String(s), unit: s === 1 ? "second" : "seconds" };
}
