"use client";
import Link from "next/link";
import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { AttemptResult } from "@/components/Session";
import { useTest } from "@/components/useTests";
import { displayTitle } from "@/lib/content";
import { store, type Attempt } from "@/lib/store";
import { SKILL_LABEL } from "@/lib/types";

function Review({ attempt }: { attempt: Attempt }) {
  const { test, error } = useTest(attempt.testId);
  if (error) return <p className="warn-box">{error}</p>;
  if (!test) return <p className="muted">加载中…</p>;
  return (
    <>
      <h1>{displayTitle(test)} · {SKILL_LABEL[attempt.skill]}</h1>
      <p className="muted">{new Date(attempt.finishedAt).toLocaleString()} · {attempt.mode === "exam" ? "模考" : "练习"}</p>
      <AttemptResult test={test} attempt={attempt} />
    </>
  );
}

function HistoryInner() {
  const id = useSearchParams().get("attempt");
  const [list, setList] = useState<Attempt[] | null>(null);
  useEffect(() => setList(store().listAttempts()), []);
  if (!list) return null;
  const one = id ? list.find((a) => a.id === id) : undefined;
  return (
    <main className="page">
      {one ? (
        <>
          <Link href="/history/">← 返回记录</Link>
          <Review attempt={one} />
        </>
      ) : (
        <>
          <h1>练习记录</h1>
          <p className="lead">记录保存在本机浏览器（localStorage），录音保存在 IndexedDB。</p>
          {list.length === 0 && <p className="muted">还没有记录。</p>}
          <div className="card" style={{ padding: 0 }}>
            <table className="matrix">
              <tbody>
                {list.map((a) => (
                  <tr key={a.id}>
                    <td>{new Date(a.finishedAt).toLocaleString()}</td>
                    <td>{a.testId}</td>
                    <td>{SKILL_LABEL[a.skill]}</td>
                    <td>{a.mode === "exam" ? "模考" : "练习"} {a.parts.length < 6 && a.mode === "practice" ? `Part ${a.parts.join(",")}` : ""}</td>
                    <td>{a.score ? `${a.score.correct}/${a.score.total}` : a.writing ? "写作" : "口语"}</td>
                    <td><Link href={`/history/?attempt=${a.id}`}>查看</Link></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </main>
  );
}

export default function HistoryPage() {
  return (
    <Suspense fallback={null}>
      <HistoryInner />
    </Suspense>
  );
}
