"use client";
import { useEffect, useState } from "react";
import { MiniAudio } from "./MediaPlayer";
import { Samples, TaskPrompt } from "./WritingRunner";
import { listeningQuestions, mediaUrl, readingQuestions } from "@/lib/content";
import { getRecording, recordingKey } from "@/lib/recordings";
import { countWords, estimateLevel, grade } from "@/lib/scoring";
import type { Answers, LPart, RPart, STask, Test, WTask } from "@/lib/types";

function ScoreHeader({ skill, correct, total }: { skill: "listening" | "reading"; correct: number; total: number }) {
  return (
    <div className="card row" style={{ justifyContent: "space-between" }} data-testid="score">
      <div>
        <div className="muted">{skill === "listening" ? "听力 Listening" : "阅读 Reading"} 得分</div>
        <div className="score-big">{correct} / {total}</div>
      </div>
      <div className="level">
        估计 CELPIP 等级：<b>{estimateLevel(skill, correct, total)}</b>
        <div className="muted" style={{ fontSize: 13 }}>按 38 题换算的常用参考表，仅供参考</div>
      </div>
    </div>
  );
}

function Mark({ ok }: { ok: boolean }) {
  return <span className={`mark ${ok ? "ok" : "bad"}`}>{ok ? "✓" : "✗"}</span>;
}

export function ListeningResult({ test, parts, answers }: { test: Test; parts: LPart[]; answers: Answers }) {
  const all = parts.flatMap(listeningQuestions);
  const { correct, total } = grade(all, answers);
  return (
    <div className="grid">
      <ScoreHeader skill="listening" correct={correct} total={total} />
      {parts.map((p) => {
        const qs = listeningQuestions(p);
        const g = grade(qs, answers);
        return (
          <div className="card" key={p.n}>
            <h3 style={{ margin: "0 0 8px" }}>Part {p.n}: {p.title} <span className="pill">{g.correct}/{g.total}</span></h3>
            {p.sections.map((s, si) => (
              <div key={si}>
                {s.media && (
                  <details>
                    <summary>{s.media.type === "video" ? "视频" : "录音"} {p.sections.length > 1 ? `Section ${si + 1}` : ""} + 原文</summary>
                    {s.media.type === "video" ? (
                      <video src={mediaUrl(test.id, s.media.src)} controls style={{ maxWidth: 480, width: "100%" }} />
                    ) : (
                      <MiniAudio src={mediaUrl(test.id, s.media.src)} />
                    )}
                    <div className="transcript" style={{ marginTop: 8 }}>{s.transcript || "（无原文）"}</div>
                  </details>
                )}
                {s.questions.map((q) => {
                  const mine = answers[q.id];
                  const ok = mine === q.answer;
                  const label = (i: number | undefined) =>
                    i === undefined || i === null ? "未作答" : q.options[i]?.text ?? `图片 ${i + 1}`;
                  return (
                    <div className="review-q" key={q.id}>
                      <Mark ok={ok} />
                      <b>Q{q.num}.</b> {q.prompt || q.stem || ""} {q.audio && <MiniAudio src={mediaUrl(test.id, q.audio)} />}
                      <div>你的答案：{label(mine)}{!ok && <> ｜ 正确答案：<b>{label(q.answer ?? undefined)}</b></>}</div>
                      {q.options[0]?.image && (
                        <div className="row" style={{ marginTop: 4 }}>
                          {q.options.map((o, i) => (
                            <img key={i} src={mediaUrl(test.id, o.image!)} alt="" style={{ height: 50, outline: i === q.answer ? "3px solid #1e8e3e" : i === mine ? "3px solid #c62828" : "none" }} />
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            ))}
          </div>
        );
      })}
    </div>
  );
}

export function ReadingResult({ parts, answers }: { test: Test; parts: RPart[]; answers: Answers }) {
  const all = parts.flatMap(readingQuestions);
  const { correct, total } = grade(all, answers);
  return (
    <div className="grid">
      <ScoreHeader skill="reading" correct={correct} total={total} />
      {parts.map((p) => {
        const qs = readingQuestions(p);
        const g = grade(qs, answers);
        return (
          <div className="card" key={p.n}>
            <h3 style={{ margin: "0 0 8px" }}>Part {p.n}: {p.title} <span className="pill">{g.correct}/{g.total}</span></h3>
            {qs.map((q) => {
              const mine = answers[q.id];
              const ok = mine === q.answer;
              return (
                <div className="review-q" key={q.id}>
                  <Mark ok={ok} /> <b>Q{q.num}.</b> {q.prompt}
                  <div>
                    你的答案：{mine === undefined ? "未作答" : q.options[mine]}
                    {!ok && q.answer !== null && <> ｜ 正确答案：<b>{q.options[q.answer]}</b></>}
                  </div>
                </div>
              );
            })}
          </div>
        );
      })}
    </div>
  );
}

export function WritingResult({ tasks, texts }: { test: Test; tasks: WTask[]; texts: Record<number, string> }) {
  return (
    <div className="grid">
      {tasks.map((t) => (
        <div className="card" key={t.n}>
          <h3 style={{ margin: "0 0 8px" }}>Task {t.n}: {t.title}</h3>
          <TaskPrompt task={t} />
          <h4>你的作答（{countWords(texts[t.n] ?? "")} words）</h4>
          <div className="transcript">{texts[t.n]?.trim() || "（未作答）"}</div>
          <h4>官方范文</h4>
          <Samples samples={t.samples} />
          <p className="muted" style={{ fontSize: 13 }}>AI 评分将在第二阶段加入。</p>
        </div>
      ))}
    </div>
  );
}

function Recording({ k }: { k: string }) {
  const [url, setUrl] = useState<string | null | undefined>(undefined);
  useEffect(() => {
    let u: string | null = null;
    getRecording(k)
      .then((b) => {
        u = b ? URL.createObjectURL(b) : null;
        setUrl(u);
      })
      .catch(() => setUrl(null));
    return () => {
      if (u) URL.revokeObjectURL(u);
    };
  }, [k]);
  if (url === undefined) return <span className="muted">加载中…</span>;
  if (!url) return <span className="muted">（没有录音）</span>;
  return (
    <span className="row">
      <audio src={url} controls />
      <a className="btn small" href={url} download={`${k.replace(/[^\w-]/g, "_")}.webm`}>下载</a>
    </span>
  );
}

export function SpeakingResult({ test, tasks, attemptId }: { test: Test; tasks: STask[]; attemptId: string }) {
  return (
    <div className="grid">
      {tasks.map((t) => (
        <div className="card" key={t.n}>
          <h3 style={{ margin: "0 0 8px" }}>{t.n === 0 ? "Practice Task" : `Task ${t.n}: ${t.title}`}</h3>
          {t.prompt.map((p, i) => <p key={i} style={{ margin: "4px 0" }}>{p}</p>)}
          {t.choices?.map((c, i) => <p key={i} className="muted" style={{ margin: "4px 0" }}>{i === 0 ? "EITHER" : "OR"}: {c}</p>)}
          {t.images?.[0] && <img src={mediaUrl(test.id, t.images[0])} alt="" style={{ maxWidth: 260, display: "block", margin: "6px 0" }} />}
          <div style={{ marginTop: 8 }}><Recording k={recordingKey(attemptId, t.n)} /></div>
          {!!t.samples?.length && (
            <details>
              <summary>官方范例</summary>
              <Samples samples={t.samples} words={false} />
            </details>
          )}
        </div>
      ))}
    </div>
  );
}
