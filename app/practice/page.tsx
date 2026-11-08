"use client";
import Link from "next/link";
import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useIndex } from "@/components/useTests";
import { displayTitle, loadTest } from "@/lib/content";
import { store } from "@/lib/store";
import { SKILLS, SKILL_LABEL, type Skill, type Test } from "@/lib/types";

const PART_LABELS: Record<Skill, string[]> = {
  listening: ["P1 解决问题", "P2 日常对话", "P3 获取信息", "P4 新闻", "P5 讨论(视频)", "P6 观点"],
  reading: ["P1 信件", "P2 图表", "P3 信息", "P4 观点"],
  writing: ["Task 1 邮件", "Task 2 调查问卷"],
  speaking: ["练习题", "T1 建议", "T2 个人经历", "T3 描述场景", "T4 预测", "T5 比较说服", "T6 困难处境", "T7 观点", "T8 异常情况"],
};

function partsOf(test: Test, skill: Skill): number[] {
  switch (skill) {
    case "listening": return test.listening?.parts.map((p) => p.n) ?? [];
    case "reading": return test.reading?.parts.map((p) => p.n) ?? [];
    case "writing": return test.writing?.tasks.map((t) => t.n) ?? [];
    case "speaking": return test.speaking?.tasks.map((t) => t.n) ?? [];
  }
}

function label(skill: Skill, n: number) {
  const xs = PART_LABELS[skill];
  return skill === "speaking" ? xs[n] : xs[n - 1];
}

function PracticeInner() {
  const params = useSearchParams();
  const only = params.get("test");
  const [skill, setSkill] = useState<Skill>((params.get("skill") as Skill) || "listening");
  const { tests } = useIndex();
  const [loaded, setLoaded] = useState<Record<string, Test>>({});

  useEffect(() => {
    if (!tests) return;
    for (const t of tests) loadTest(t.id).then((x) => setLoaded((m) => ({ ...m, [t.id]: x })));
  }, [tests]);

  const list = (tests ?? []).filter((t) => !only || t.id === only);
  const maxParts = { listening: 6, reading: 4, writing: 2, speaking: 9 }[skill];
  return (
    <main className="page">
      <h1>分项练习</h1>
      <p className="lead">选择科目和 Part 单独练习。练习模式可以重听、看播放条、随时点 “Answer Key” 对答案和看原文。</p>
      <div className="tabs">
        {SKILLS.map((s) => (
          <button key={s} className={s === skill ? "active" : ""} onClick={() => setSkill(s)} data-testid={`tab-${s}`}>
            {SKILL_LABEL[s]}
          </button>
        ))}
      </div>
      <div className="card" style={{ padding: 0, overflowX: "auto" }}>
        <table className="matrix">
          <thead>
            <tr>
              <th>真题</th>
              {Array.from({ length: maxParts }, (_, i) => <th key={i}>{label(skill, skill === "speaking" ? i : i + 1)}</th>)}
              <th>整科</th>
            </tr>
          </thead>
          <tbody>
            {list.map((t) => {
              const test = loaded[t.id];
              const nums = test ? partsOf(test, skill) : [];
              const all = skill === "speaking" ? Array.from({ length: 9 }, (_, i) => i) : Array.from({ length: maxParts }, (_, i) => i + 1);
              return (
                <tr key={t.id}>
                  <td><b>{displayTitle(t)}</b></td>
                  {all.map((n) => {
                    const has = nums.includes(n);
                    const best = has && (skill === "listening" || skill === "reading") ? store().bestPartScore(t.id, skill, n) : undefined;
                    return (
                      <td key={n}>
                        {has ? (
                          <Link className="btn small part-btn" href={`/practice/run/?test=${t.id}&skill=${skill}&part=${n}`} data-testid={`practice-${t.id}-${skill}-${n}`}>
                            练习
                            {best && <span className="score">{best.correct}/{best.total}</span>}
                          </Link>
                        ) : (
                          <span className="muted">{test ? "—" : "…"}</span>
                        )}
                      </td>
                    );
                  })}
                  <td>
                    {nums.length > 0 && <Link className="btn small" href={`/practice/run/?test=${t.id}&skill=${skill}`}>全部</Link>}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </main>
  );
}

export default function PracticePage() {
  return (
    <Suspense fallback={null}>
      <PracticeInner />
    </Suspense>
  );
}
