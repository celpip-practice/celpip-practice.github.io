"use client";
import Link from "next/link";
import { Suspense, useState } from "react";
import { useSearchParams } from "next/navigation";
import { DonateCard } from "@/components/Donate";
import { SkillIcon } from "@/components/Icons";
import { AttemptResult, SkillRunner } from "@/components/Session";
import { useTest } from "@/components/useTests";
import { partName, skillName, testTitle, useHref, useT } from "@/lib/i18n";
import type { Attempt } from "@/lib/store";
import { SKILLS, type Skill } from "@/lib/types";

function RunInner() {
  const params = useSearchParams();
  const t = useT();
  const href = useHref();
  const testId = params.get("test");
  const skill = params.get("skill") as Skill;
  const partParam = params.get("part");
  const parts = partParam !== null && /^\d+$/.test(partParam) ? [Number(partParam)] : undefined;
  const { test, error } = useTest(testId);
  const [attempt, setAttempt] = useState<Attempt | null>(null);
  const [round, setRound] = useState(0);

  if (!SKILLS.includes(skill)) return <main className="page"><p className="warn-box">{t("common.unknownSkill")}</p></main>;
  if (error) return <main className="page"><p className="warn-box">{error}</p></main>;
  if (!test) return <main className="page"><p className="muted">{t("common.loading")}</p></main>;

  if (attempt) {
    return (
      <main className="page" data-testid="practice-results">
        <div className="page-head row spread">
          <div>
            <p className="eyebrow"><SkillIcon skill={skill} size={16} /> {skillName(t, skill)}
              {parts ? ` · Part ${parts[0]} ${partName(t, skill, parts[0])}` : ""}</p>
            <h1>{testTitle(t, test)}</h1>
          </div>
          <div className="row">
            <button className="btn" onClick={() => { setAttempt(null); setRound((r) => r + 1); }} data-testid="retry">
              {t("practice.retry")}
            </button>
            <Link className="btn primary" href={href(`/practice/?skill=${skill}`)}>{t("practice.backToList")}</Link>
          </div>
        </div>
        <AttemptResult test={test} attempt={attempt} />
        <DonateCard />
      </main>
    );
  }
  return <SkillRunner key={round} test={test} skill={skill} parts={parts} mode="practice" onComplete={setAttempt} />;
}

export default function PracticeRunView() {
  return (
    <Suspense fallback={null}>
      <RunInner />
    </Suspense>
  );
}
