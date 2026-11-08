import type { Answers, Skill } from "./types";

/**
 * Progress persistence. Local-only for now (localStorage); the interface is what a
 * Supabase-backed implementation would provide later.
 */
export interface Attempt {
  id: string;
  testId: string;
  mode: "exam" | "practice";
  skill: Skill;
  parts: number[];
  startedAt: number;
  finishedAt: number;
  answers: Answers;
  score?: { correct: number; total: number };
  writing?: Record<number, string>;
  speakingTasks?: number[];
}

export interface ProgressStore {
  saveAttempt(a: Attempt): void;
  listAttempts(): Attempt[];
  getAttempt(id: string): Attempt | undefined;
  bestPartScore(testId: string, skill: Skill, part: number): { correct: number; total: number } | undefined;
  clear(): void;
}

const KEY = "celpip.attempts.v1";

function read(storage: Storage): Attempt[] {
  try {
    const raw = storage.getItem(KEY);
    const v = raw ? JSON.parse(raw) : [];
    return Array.isArray(v) ? v : [];
  } catch {
    return [];
  }
}

export function createLocalStore(storage: Storage): ProgressStore {
  return {
    saveAttempt(a) {
      const all = read(storage).filter((x) => x.id !== a.id);
      all.push(a);
      storage.setItem(KEY, JSON.stringify(all.slice(-500)));
    },
    listAttempts() {
      return read(storage).sort((a, b) => b.finishedAt - a.finishedAt);
    },
    getAttempt(id) {
      return read(storage).find((a) => a.id === id);
    },
    bestPartScore(testId, skill, part) {
      let best: { correct: number; total: number } | undefined;
      for (const a of read(storage)) {
        if (a.testId !== testId || a.skill !== skill || !a.score || a.parts.length !== 1 || a.parts[0] !== part) continue;
        if (!best || a.score.correct / a.score.total > best.correct / best.total) best = a.score;
      }
      return best;
    },
    clear() {
      storage.removeItem(KEY);
    },
  };
}

const memory = (): Storage => {
  const m = new Map<string, string>();
  return {
    get length() { return m.size; },
    clear: () => m.clear(),
    getItem: (k) => m.get(k) ?? null,
    key: (i) => [...m.keys()][i] ?? null,
    removeItem: (k) => void m.delete(k),
    setItem: (k, v) => void m.set(k, v),
  };
};

let singleton: ProgressStore | null = null;
export function store(): ProgressStore {
  if (!singleton) singleton = createLocalStore(typeof window === "undefined" ? memory() : window.localStorage);
  return singleton;
}

export function newAttemptId(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}
