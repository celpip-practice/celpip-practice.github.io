"use client";
import Link from "next/link";
import { Suspense, useState } from "react";
import { useSearchParams } from "next/navigation";
import { AttemptResult, SkillRunner } from "@/components/Session";
import { useTest } from "@/components/useTests";
import { displayTitle } from "@/lib/content";
import type { Attempt } from "@/lib/store";
import { SKILLS, SKILL_LABEL, type Skill } from "@/lib/types";

function RunInner() {
  const params = useSearchParams();
  const testId = params.get("test");
  const skill = params.get("skill") as Skill;
  const partParam = params.get("part");
  const parts = partParam !== null && /^\d+$/.test(partParam) ? [Number(partParam)] : undefined;
  const { test, error } = useTest(testId);
  const [attempt, setAttempt] = useState<Attempt | null>(null);
  const [round, setRound] = useState(0);

  if (!SKILLS.includes(skill)) return <main className="page"><p className="warn-box">未知科目</p></main>;
  if (error) return <main className="page"><p className="warn-box">{error}</p></main>;
  if (!test) return <main className="page"><p className="muted">加载中…</p></main>;

  if (attempt) {
    return (
      <main className="page" data-testid="practice-results">
        <div className="row" style={{ justifyContent: "space-between" }}>
          <h1>{displayTitle(test)} · {SKILL_LABEL[skill]} {parts ? `Part ${parts[0]}` : ""}</h1>
          <div className="row">
            <button className="btn" onClick={() => { setAttempt(null); setRound((r) => r + 1); }} data-testid="retry">再练一次</button>
            <Link className="btn primary" href={`/practice/?skill=${skill}`}>返回分项练习</Link>
          </div>
        </div>
        <AttemptResult test={test} attempt={attempt} />
      </main>
    );
  }
  return <SkillRunner key={round} test={test} skill={skill} parts={parts} mode="practice" onComplete={setAttempt} />;
}

export default function PracticeRunPage() {
  return (
    <Suspense fallback={null}>
      <RunInner />
    </Suspense>
  );
}
