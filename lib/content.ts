import type { LPart, RPart, Test, TestSummary } from "./types";

const BASE = `${process.env.NEXT_PUBLIC_BASE_PATH ?? ""}/content`;
// audio, video and images are served from Cloudflare R2 in production; locally they sit next to test.json
const MEDIA_BASE = (process.env.NEXT_PUBLIC_MEDIA_BASE || BASE).replace(/\/$/, "");
const cache = new Map<string, Promise<Test>>();

export async function loadIndex(): Promise<TestSummary[]> {
  const r = await fetch(`${BASE}/index.json`, { cache: "no-store" });
  if (!r.ok) throw new Error(`index.json: HTTP ${r.status}`);
  return (await r.json()).tests as TestSummary[];
}

const TEST_ID = /^[a-z0-9-]+$/;

export function loadTest(id: string): Promise<Test> {
  if (!TEST_ID.test(id)) return Promise.reject(new Error(`invalid test id: ${id}`));
  if (!cache.has(id)) {
    cache.set(
      id,
      fetch(`${BASE}/tests/${id}/test.json`).then((r) => {
        if (!r.ok) throw new Error(`${id}: HTTP ${r.status}`);
        return r.json();
      }),
    );
  }
  return cache.get(id)!;
}

export function mediaUrl(testId: string, rel: string): string {
  return `${MEDIA_BASE}/tests/${testId}/${rel}`;
}

export function listeningQuestions(part: LPart) {
  return part.sections.flatMap((s) => s.questions);
}

export function readingQuestions(part: RPart) {
  return part.right.flatMap((b) => ("items" in b ? b.items : []));
}

export function displayTitle(t: { set: number; test: number; label?: string }) {
  return t.label ?? `真题 ${t.set} · Test ${t.test}`;
}
