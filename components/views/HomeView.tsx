"use client";
import Link from "next/link";
import { Arrow, SkillIcon, Target, Timer } from "@/components/Icons";
import GuideLinks from "@/components/GuideLinks";
import { skillName, testTitle, useHref, useLang, useT } from "@/lib/i18n";
import { SKILLS, type TestSummary } from "@/lib/types";

const QUESTIONS_PER_SKILL = 38;

function groupBySet(tests: TestSummary[]) {
  const groups = new Map<number, TestSummary[]>();
  for (const t of tests) groups.set(t.set, [...(groups.get(t.set) ?? []), t]);
  return [...groups.entries()];
}

export default function HomeView({ tests }: { tests: TestSummary[] }) {
  const t = useT();
  const href = useHref();
  const { lang } = useLang();
  const questions = tests.reduce(
    (n, x) => n + (x.skills.includes("listening") ? QUESTIONS_PER_SKILL : 0) + (x.skills.includes("reading") ? QUESTIONS_PER_SKILL : 0), 0);
  return (
    <main>
      <section className="hero">
        <div className="hero-inner">
          <span className="badge">{t("home.badge")}</span>
          <h1>{t("home.title")}</h1>
          <p>{t("home.lead")}</p>
          <div className="row hero-cta">
            <Link href={href("/exam/")} className="btn primary lg">{t("home.startExam")} <Arrow size={18} /></Link>
            <Link href={href("/practice/")} className="btn ghost lg">{t("home.startPractice")}</Link>
          </div>
          <div className="stats">
            <div><b>{tests.length}</b><span>{t("home.statTests")}</span></div>
            <div><b>{questions.toLocaleString()}</b><span>{t("home.statQuestions")}</span></div>
            <div><b>4</b><span>{t("home.statSkills")}</span></div>
          </div>
        </div>
      </section>

      <div className="page">
        <div className="grid two modes">
          <Link href={href("/exam/")} className="card mode-card" data-testid="mode-exam">
            <span className="icon-tile blue"><Timer size={22} /></span>
            <div>
              <h2>{t("home.examTitle")}</h2>
              <p>{t("home.examDesc")}</p>
            </div>
            <Arrow size={18} className="go" />
          </Link>
          <Link href={href("/practice/")} className="card mode-card" data-testid="mode-practice">
            <span className="icon-tile red"><Target size={22} /></span>
            <div>
              <h2>{t("home.practiceTitle")}</h2>
              <p>{t("home.practiceDesc")}</p>
            </div>
            <Arrow size={18} className="go" />
          </Link>
        </div>

        <div className="section-head">
          <h2>{t("home.library")}</h2>
          <p className="muted">{t("home.libraryLead", { n: tests.length })}</p>
        </div>
        <div className="grid sets">
          {groupBySet(tests).map(([set, xs]) => (
            <div className="card set-card" key={set}>
              <div className="set-head">
                <span className="set-no">{xs[0].label ? "★" : set}</span>
                <b>{xs[0].label ? t("title.extraGroup") : t("title.setGroup", { set })}</b>
              </div>
              {xs.map((x) => (
                <div className="test-row" key={x.id} data-testid={`test-${x.id}`}>
                  <div>
                    <Link className="test-name" href={href(`/tests/${x.id}/`)}>{testTitle(t, x)}</Link>
                    <div className="skill-dots">
                      {SKILLS.map((s) => (
                        <span key={s} className={x.skills.includes(s) ? "on" : ""} title={skillName(t, s)}>
                          <SkillIcon skill={s} size={13} />
                        </span>
                      ))}
                    </div>
                  </div>
                  <div className="row tight">
                    <Link className="btn primary small" href={href(`/exam/?test=${x.id}`)}>{t("home.exam")}</Link>
                    <Link className="btn small" href={href(`/practice/?test=${x.id}`)}>{t("home.practice")}</Link>
                  </div>
                </div>
              ))}
            </div>
          ))}
        </div>

        <div className="section-head">
          <h2>{t("guide.homeTitle")}</h2>
          <p className="muted">{t("guide.homeLead")}</p>
        </div>
        <GuideLinks lang={lang} />
      </div>
    </main>
  );
}
