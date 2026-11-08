"use client";
import { useEffect, useState } from "react";
import { MiniAudio } from "./MediaPlayer";
import { Samples, TaskPrompt } from "./WritingRunner";
import { listeningQuestions, mediaUrl, readingQuestions } from "@/lib/content";
import { skillName, useT } from "@/lib/i18n";
import { getRecording, recordingKey } from "@/lib/recordings";
import { countWords, estimateLevel, grade } from "@/lib/scoring";
import type { Answers, LPart, RPart, STask, Test, WTask } from "@/lib/types";

function ScoreHeader({ skill, correct, total }: { skill: "listening" | "reading"; correct: number; total: number }) {
  const t = useT();
  const pct = total ? Math.round((correct / total) * 100) : 0;
  return (
    <div className="card score-card" data-testid="score">
      <div className="ring" style={{ ["--pct" as string]: pct }}>
        <span>{pct}%</span>
      </div>
      <div className="grow">
        <div className="muted">{t("result.score", { skill: skillName(t, skill) })}</div>
        <div className="score-big">{correct} <small>/ {total}</small></div>
      </div>
      <div className="level-box">
        <div className="muted small">{t("result.level")}</div>
        <div className="level-no">{estimateLevel(skill, correct, total)}</div>
        <div className="muted tiny">{t("result.levelNote")}</div>
      </div>
    </div>
  );
}

function Mark({ ok }: { ok: boolean }) {
  return <span className={`mark ${ok ? "ok" : "bad"}`}>{ok ? "✓" : "✗"}</span>;
}

export function ListeningResult({ test, parts, answers }: { test: Test; parts: LPart[]; answers: Answers }) {
  const t = useT();
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
            <h3 className="card-title">Part {p.n}: {p.title} <span className="pill">{g.correct}/{g.total}</span></h3>
            {p.sections.map((s, si) => (
              <div key={si}>
                {s.media && (
                  <details>
                    <summary>
                      {t("result.withTranscript", {
                        media: t(s.media.type === "video" ? "result.video" : "result.audio"),
                        section: p.sections.length > 1 ? ` Section ${si + 1} ` : "",
                      })}
                    </summary>
                    {s.media.type === "video" ? (
                      <video src={mediaUrl(test.id, s.media.src)} controls style={{ maxWidth: 480, width: "100%" }} />
                    ) : (
                      <MiniAudio src={mediaUrl(test.id, s.media.src)} />
                    )}
                    <div className="transcript" style={{ marginTop: 8 }}>{s.transcript || t("result.noTranscript")}</div>
                  </details>
                )}
                {s.questions.map((q) => {
                  const mine = answers[q.id];
                  const ok = mine === q.answer;
                  const label = (i: number | undefined) =>
                    i === undefined || i === null ? t("result.unanswered") : q.options[i]?.text ?? t("result.picture", { n: i + 1 });
                  return (
                    <div className="review-q" key={q.id}>
                      <Mark ok={ok} />
                      <b>Q{q.num}.</b> {q.prompt || q.stem || ""} {q.audio && <MiniAudio src={mediaUrl(test.id, q.audio)} />}
                      <div className="answer-line">
                        {t("result.yours")}{label(mine)}
                        {!ok && <> ｜ {t("result.correct")}<b>{label(q.answer ?? undefined)}</b></>}
                      </div>
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
  const t = useT();
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
            <h3 className="card-title">Part {p.n}: {p.title} <span className="pill">{g.correct}/{g.total}</span></h3>
            {qs.map((q) => {
              const mine = answers[q.id];
              const ok = mine === q.answer;
              return (
                <div className="review-q" key={q.id}>
                  <Mark ok={ok} /> <b>Q{q.num}.</b> {q.prompt}
                  <div className="answer-line">
                    {t("result.yours")}{mine === undefined ? t("result.unanswered") : q.options[mine]}
                    {!ok && q.answer !== null && <> ｜ {t("result.correct")}<b>{q.options[q.answer]}</b></>}
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
  const t = useT();
  return (
    <div className="grid">
      {tasks.map((task) => (
        <div className="card" key={task.n}>
          <h3 className="card-title">Task {task.n}: {task.title}</h3>
          <TaskPrompt task={task} />
          <h4>{t("result.yourWriting", { n: countWords(texts[task.n] ?? "") })}</h4>
          <div className="transcript">{texts[task.n]?.trim() || t("result.noWriting")}</div>
          <h4>{t("result.officialSamples")}</h4>
          <Samples samples={task.samples} />
          <p className="muted small">{t("result.aiLater")}</p>
        </div>
      ))}
    </div>
  );
}

function Recording({ k }: { k: string }) {
  const t = useT();
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
  if (url === undefined) return <span className="muted">{t("common.loading")}</span>;
  if (!url) return <span className="muted">{t("result.noRecording")}</span>;
  return (
    <span className="row">
      <audio src={url} controls />
      <a className="btn small" href={url} download={`${k.replace(/[^\w-]/g, "_")}.webm`}>{t("result.download")}</a>
    </span>
  );
}

export function SpeakingResult({ test, tasks, attemptId }: { test: Test; tasks: STask[]; attemptId: string }) {
  const t = useT();
  return (
    <div className="grid">
      {tasks.map((task) => (
        <div className="card" key={task.n}>
          <h3 className="card-title">{task.n === 0 ? "Practice Task" : `Task ${task.n}: ${task.title}`}</h3>
          {task.prompt.map((p, i) => <p key={i} style={{ margin: "4px 0" }}>{p}</p>)}
          {task.choices?.map((c, i) => <p key={i} className="muted" style={{ margin: "4px 0" }}>{i === 0 ? "EITHER" : "OR"}: {c}</p>)}
          {task.images?.[0] && <img src={mediaUrl(test.id, task.images[0])} alt="" style={{ maxWidth: 260, display: "block", margin: "6px 0", borderRadius: 8 }} />}
          <div style={{ marginTop: 8 }}><Recording k={recordingKey(attemptId, task.n)} /></div>
          {!!task.samples?.length && (
            <details>
              <summary>{t("result.speakingSamples")}</summary>
              <Samples samples={task.samples} words={false} />
            </details>
          )}
        </div>
      ))}
    </div>
  );
}
