"use client";
import Link from "next/link";
import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Back, SkillIcon } from "@/components/Icons";
import { AttemptResult } from "@/components/Session";
import { useIndex, useTest } from "@/components/useTests";
import { skillName, testTitle, useHref, useLang, useT } from "@/lib/i18n";
import { store, type Attempt } from "@/lib/store";
import type { Skill, TestSummary } from "@/lib/types";

function Review({ attempt }: { attempt: Attempt }) {
  const { test, error } = useTest(attempt.testId);
  const t = useT();
  const { lang } = useLang();
  if (error) return <p className="warn-box">{error}</p>;
  if (!test) return <p className="muted">{t("common.loading")}</p>;
  return (
    <>
      <div className="page-head">
        <p className="eyebrow"><SkillIcon skill={attempt.skill} size={16} /> {skillName(t, attempt.skill)}</p>
        <h1>{testTitle(t, test)}</h1>
        <p className="muted">
          {new Date(attempt.finishedAt).toLocaleString(lang === "zh" ? "zh-CN" : "en-CA")} · {t(`mode.${attempt.mode}`)}
        </p>
      </div>
      <AttemptResult test={test} attempt={attempt} />
    </>
  );
}

function average(list: Attempt[], skill: Skill) {
  const xs = list.filter((a) => a.skill === skill && a.score && a.score.total > 0);
  if (!xs.length) return null;
  const c = xs.reduce((n, a) => n + a.score!.correct, 0);
  const total = xs.reduce((n, a) => n + a.score!.total, 0);
  return Math.round((c / total) * 100);
}

function HistoryInner() {
  const id = useSearchParams().get("attempt");
  const t = useT();
  const { lang } = useLang();
  const href = useHref();
  const { tests } = useIndex();
  const [list, setList] = useState<Attempt[] | null>(null);
  useEffect(() => setList(store().listAttempts()), []);
  if (!list) return null;
  const one = id ? list.find((a) => a.id === id) : undefined;
  const byId = new Map<string, TestSummary>((tests ?? []).map((x) => [x.id, x]));
  const name = (testId: string) => {
    const x = byId.get(testId);
    return x ? testTitle(t, x) : testId;
  };
  return (
    <main className="page">
      {one ? (
        <>
          <Link href={href("/history/")} className="back-link"><Back size={16} /> {t("history.back")}</Link>
          <Review attempt={one} />
        </>
      ) : (
        <>
          <div className="page-head">
            <h1>{t("history.title")}</h1>
            <p className="lead">{t("history.lead")}</p>
          </div>
          {list.length === 0 ? (
            <div className="card empty">
              <p>{t("history.empty")}</p>
              <Link className="btn primary" href={href("/practice/")}>{t("nav.practice")}</Link>
            </div>
          ) : (
            <>
              <div className="grid three stat-cards">
                <div className="card stat"><b>{list.length}</b><span>{t("history.attempts")}</span></div>
                {(["listening", "reading"] as const).map((s) => {
                  const avg = average(list, s);
                  return (
                    <div className="card stat" key={s}>
                      <b>{avg === null ? "–" : `${avg}%`}</b>
                      <span>{t("history.avg", { skill: skillName(t, s) })}</span>
                    </div>
                  );
                })}
              </div>
              <div className="card flush">
                <div className="table-scroll">
                  <table className="matrix history">
                    <thead>
                      <tr>
                        <th>{t("history.date")}</th>
                        <th>{t("history.test")}</th>
                        <th>{t("history.skill")}</th>
                        <th>{t("history.mode")}</th>
                        <th>{t("history.score")}</th>
                        <th />
                      </tr>
                    </thead>
                    <tbody>
                      {list.map((a) => (
                        <tr key={a.id}>
                          <td className="muted">{new Date(a.finishedAt).toLocaleString(lang === "zh" ? "zh-CN" : "en-CA")}</td>
                          <td><b>{name(a.testId)}</b></td>
                          <td><span className="skill-tag"><SkillIcon skill={a.skill} size={14} /> {skillName(t, a.skill)}</span></td>
                          <td>
                            <span className={`pill ${a.mode === "exam" ? "blue" : ""}`}>{t(`mode.${a.mode}`)}</span>
                            {a.parts.length < 6 && a.mode === "practice" ? <span className="muted small"> Part {a.parts.join(", ")}</span> : null}
                          </td>
                          <td>{a.score ? <b>{a.score.correct}/{a.score.total}</b> : <span className="muted">—</span>}</td>
                          <td><Link href={href(`/history/?attempt=${a.id}`)}>{t("common.view")}</Link></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </>
          )}
        </>
      )}
    </main>
  );
}

export default function HistoryView() {
  return (
    <Suspense fallback={null}>
      <HistoryInner />
    </Suspense>
  );
}
