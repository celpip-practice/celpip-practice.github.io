"use client";
import Link from "next/link";
import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import ExamFrame from "@/components/ExamFrame";
import { AttemptResult, SkillRunner } from "@/components/Session";
import { useIndex, useTest } from "@/components/useTests";
import { displayTitle } from "@/lib/content";
import type { Attempt } from "@/lib/store";
import { SKILLS, SKILL_LABEL, type Skill } from "@/lib/types";

const DURATION: Record<Skill, string> = { listening: "约 47 分钟", reading: "约 55 分钟", writing: "53 分钟", speaking: "约 20 分钟" };
const EN: Record<Skill, string> = { listening: "Listening", reading: "Reading", writing: "Writing", speaking: "Speaking" };

function ExamInner() {
  const params = useSearchParams();
  const router = useRouter();
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
        <h1>模拟考试</h1>
        <p className="lead">选择一套真题开始完整模考。</p>
        <div className="grid tests">
          {tests?.map((t) => (
            <Link key={t.id} href={`/exam/?test=${t.id}`} className="card mode-card" data-testid={`exam-pick-${t.id}`}>
              <b>{displayTitle(t)}</b>
              <div className="muted">{t.title}</div>
            </Link>
          ))}
        </div>
      </main>
    );
  }
  if (error) return <main className="page"><p className="warn-box">{error}</p></main>;
  if (!test) return <main className="page"><p className="muted">加载中…</p></main>;

  const available = SKILLS.filter((s) => test[s]);
  const start = (list: Skill[]) => router.push(`/exam/?test=${test.id}&skills=${list.join(",")}&run=1`);

  if (!run || !skills.length) {
    return (
      <main className="page">
        <h1>{displayTitle(test)} · 模拟考试</h1>
        <p className="lead">考试顺序与真实 CELPIP-General 相同。考试中录音只播放一次、计时结束自动进入下一部分、不能返回上一页。</p>
        <div className="card" style={{ marginBottom: 16 }}>
          <div className="row" style={{ justifyContent: "space-between" }}>
            <div>
              <b>完整模考</b>（听力 → 阅读 → 写作 → 口语，约 3 小时）
              <div className="muted" style={{ fontSize: 13 }}>口语部分需要允许浏览器使用麦克风；请戴上耳机。</div>
            </div>
            <button className="btn primary" onClick={() => start(available)} data-testid="start-full">开始完整模考</button>
          </div>
        </div>
        <div className="grid two">
          {available.map((s) => (
            <div className="card row" key={s} style={{ justifyContent: "space-between" }}>
              <div><b>{SKILL_LABEL[s]}</b> <span className="muted">{DURATION[s]}</span></div>
              <button className="btn" onClick={() => start([s])} data-testid={`start-${s}`}>只考这一科</button>
            </div>
          ))}
        </div>
        {test.warnings.length > 0 && (
          <details style={{ marginTop: 20 }}>
            <summary>本套题目转换提示（{test.warnings.length}）</summary>
            <ul className="muted">{test.warnings.map((w, i) => <li key={i}>{w}</li>)}</ul>
          </details>
        )}
      </main>
    );
  }

  if (step >= skills.length) {
    return (
      <main className="page" data-testid="exam-results">
        <div className="row" style={{ justifyContent: "space-between" }}>
          <h1>{displayTitle(test)} · 模考结果</h1>
          <div className="row">
            <Link className="btn" href="/">首页</Link>
            <Link className="btn" href="/history/">练习记录</Link>
          </div>
        </div>
        {attempts.map((a) => (
          <section key={a.id} style={{ marginBottom: 28 }}>
            <h2>{SKILL_LABEL[a.skill]}</h2>
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
