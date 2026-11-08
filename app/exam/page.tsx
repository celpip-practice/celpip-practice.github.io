"use client";
import Link from "next/link";
import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import ExamFrame from "@/components/ExamFrame";
import { Arrow, Back, Clock, SkillIcon, Timer } from "@/components/Icons";
import { AttemptResult, SkillRunner } from "@/components/Session";
import { useIndex, useTest } from "@/components/useTests";
import { skillName, testTitle, useT } from "@/lib/i18n";
import type { Attempt } from "@/lib/store";
import { SKILLS, type Skill } from "@/lib/types";

const EN: Record<Skill, string> = { listening: "Listening", reading: "Reading", writing: "Writing", speaking: "Speaking" };

function ExamInner() {
  const params = useSearchParams();
  const router = useRouter();
  const t = useT();
  const testId = params.get("test");
  const run = params.get("run") === "1";
  const skills = (params.get("skills") ?? "").split(",").filter((s): s is Skill => (SKILLS as string[]).includes(s));
  const { tests } = useIndex();
  const { test, error } = useTest(testId);
  const [step, setStep] = useState(0);
  const [between, setBetween] = useState(false);
  const [attempts, setAttempts] = useState<Attempt[]>([]);

  if (!testId) {
    return (
      <main className="page">
        <div className="page-head">
          <h1>{t("exam.title")}</h1>
          <p className="lead">{t("exam.lead")}</p>
        </div>
        <div className="grid picks">
          {tests?.map((x) => (
            <Link key={x.id} href={`/exam/?test=${x.id}`} className="card pick-card" data-testid={`exam-pick-${x.id}`}>
              <div>
                <b>{testTitle(t, x)}</b>
                <div className="muted small">{x.title}</div>
              </div>
              <Arrow size={18} className="go" />
            </Link>
          ))}
        </div>
      </main>
    );
  }
  if (error) return <main className="page"><p className="warn-box">{error}</p></main>;
  if (!test) return <main className="page"><p className="muted">{t("common.loading")}</p></main>;

  const available = SKILLS.filter((s) => test[s]);
  const start = (list: Skill[]) => router.push(`/exam/?test=${test.id}&skills=${list.join(",")}&run=1`);

  if (!run || !skills.length) {
    return (
      <main className="page">
        <Link href="/exam/" className="back-link"><Back size={16} /> {t("exam.back")}</Link>
        <div className="page-head">
          <h1>{testTitle(t, test)} · {t("exam.detailTitle")}</h1>
          <p className="lead">{t("exam.rules")}</p>
        </div>
        <div className="card full-exam">
          <span className="icon-tile blue lg"><Timer size={26} /></span>
          <div className="grow">
            <h2>{t("exam.full")}</h2>
            <p className="muted">{t("exam.fullDesc")}</p>
            <p className="muted small">{t("exam.fullHint")}</p>
          </div>
          <button className="btn primary lg" onClick={() => start(available)} data-testid="start-full">
            {t("exam.startFull")} <Arrow size={18} />
          </button>
        </div>
        <div className="grid four">
          {available.map((s) => (
            <div className="card skill-card" key={s}>
              <span className={`icon-tile skill-${s}`}><SkillIcon skill={s} size={22} /></span>
              <h3>{skillName(t, s)}</h3>
              <p className="muted small"><Clock size={14} /> {t(`exam.duration.${s}` as const)}</p>
              <button className="btn" onClick={() => start([s])} data-testid={`start-${s}`}>{t("exam.onlyThis")}</button>
            </div>
          ))}
        </div>
        {test.warnings.length > 0 && (
          <details style={{ marginTop: 24 }}>
            <summary>{t("exam.warnings", { n: test.warnings.length })}</summary>
            <ul className="muted">{test.warnings.map((w, i) => <li key={i}>{w}</li>)}</ul>
          </details>
        )}
      </main>
    );
  }

  if (step >= skills.length) {
    return (
      <main className="page" data-testid="exam-results">
        <div className="page-head row spread">
          <h1>{testTitle(t, test)} · {t("exam.results")}</h1>
          <div className="row">
            <Link className="btn" href="/">{t("common.home")}</Link>
            <Link className="btn" href="/history/">{t("nav.history")}</Link>
          </div>
        </div>
        {attempts.map((a) => (
          <section key={a.id} style={{ marginBottom: 28 }}>
            <h2 className="section-title"><SkillIcon skill={a.skill} /> {skillName(t, a.skill)}</h2>
            <AttemptResult test={test} attempt={a} />
          </section>
        ))}
      </main>
    );
  }

  const skill = skills[step];
  if (between) {
    return (
      <ExamFrame title={`${test.title} - End of the ${EN[skills[step - 1]]} Test`} onNext={() => setBetween(false)} single>
        <div className="instructions">
          <ul>
            <li>This is the end of the {EN[skills[step - 1]]} Test.</li>
            <li>Next: {EN[skill]} Test. Click &quot;NEXT&quot; to continue.</li>
          </ul>
        </div>
      </ExamFrame>
    );
  }
  return (
    <SkillRunner
      key={`${skill}-${step}`}
      test={test}
      skill={skill}
      mode="exam"
      onComplete={(a) => {
        setAttempts((xs) => [...xs, a]);
        setStep(step + 1);
        if (step + 1 < skills.length) setBetween(true);
      }}
    />
  );
}

export default function ExamPage() {
  return (
    <Suspense fallback={null}>
      <ExamInner />
    </Suspense>
  );
}
