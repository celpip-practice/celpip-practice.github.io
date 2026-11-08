"use client";
import { Fragment, useState } from "react";
import ExamFrame, { Info, TimeRemaining } from "./ExamFrame";
import { Dropdown, KeyHint } from "./Choices";
import { mediaUrl } from "@/lib/content";
import { useCountdown } from "@/lib/useCountdown";
import type { Answers, RBlock, RPart, RQuestion, Test } from "@/lib/types";

export const READING_MINUTES: Record<number, number> = { 1: 11, 2: 9, 3: 10, 4: 13 };

interface Props {
  test: Test;
  parts: RPart[];
  mode: "exam" | "practice";
  onFinish: (answers: Answers) => void;
}

function cleanIntro(s: string | null | undefined) {
  return (s ?? "").replace(/\(\s*[^)\w]{0,3}\s*\)/g, "(▼)");
}

export default function ReadingRunner({ test, parts, mode, onFinish }: Props) {
  const [idx, setIdx] = useState(0);
  const [answers, setAnswers] = useState<Answers>({});
  const [showKey, setShowKey] = useState(false);
  const exam = mode === "exam";
  const part = parts[idx];

  const go = (to: number) => {
    setShowKey(false);
    if (to >= parts.length) onFinish(answers);
    else setIdx(Math.max(0, to));
  };
  const remaining = useCountdown((READING_MINUTES[part?.n] ?? 10) * 60, exam, () => go(idx + 1), idx);
  if (!part) return null;

  const set = (id: string, v: number) => setAnswers((a) => ({ ...a, [id]: v }));
  const dd = (q: RQuestion, label?: string) => (
    <>
      <Dropdown
        options={q.options}
        value={answers[q.id]}
        onChange={(v) => set(q.id, v)}
        reveal={showKey ? q.answer : undefined}
        testid={`dd-${q.id}`}
        ariaLabel={label ?? `Question ${q.num}`}
      />
      {showKey && <KeyHint options={q.options} answer={q.answer} value={answers[q.id]} />}
    </>
  );

  const renderBlock = (b: RBlock, i: number) => {
    switch (b.type) {
      case "text":
        return (
          <div key={i} className="passage">
            {b.intro && <Info>{b.intro}</Info>}
            {b.paragraphs.map((p, j) => <p key={j}>{p}</p>)}
          </div>
        );
      case "image":
        return (
          <div key={i} className="passage">
            <img src={mediaUrl(test.id, b.src)} alt="diagram" />
          </div>
        );
      case "questions":
        if (b.style === "paragraph") {
          return (
            <div key={i}>
              <Info>{cleanIntro(b.intro)}</Info>
              {b.items.map((q) => (
                <div className="p3-row" key={q.id}>
                  {dd(q)}
                  <span>{q.num}. {q.prompt}</span>
                </div>
              ))}
            </div>
          );
        }
        return (
          <div key={i} style={{ marginBottom: 18 }}>
            <Info>{cleanIntro(b.intro)}</Info>
            <ul className="dd-list">
              {b.items.map((q) => (
                <li key={q.id}>{q.num}. {q.prompt} {dd(q)}</li>
              ))}
            </ul>
          </div>
        );
      case "cloze": {
        const byNum = new Map(b.items.map((q) => [q.num, q]));
        return (
          <div key={i} className="cloze" style={{ marginBottom: 18 }}>
            <Info>{cleanIntro(b.intro)}</Info>
            {b.paragraphs.map((p, j) => (
              <p key={j}>
                {p.split(/(\{\{\d+\}\})/).map((chunk, k) => {
                  const m = chunk.match(/^\{\{(\d+)\}\}$/);
                  const q = m ? byNum.get(Number(m[1])) : undefined;
                  if (!q) return <Fragment key={k}>{chunk}</Fragment>;
                  return (
                    <Fragment key={k}>
                      <span className="num">{q.num}.</span>
                      {dd(q, `Blank ${q.num}`)}{" "}
                    </Fragment>
                  );
                })}
              </p>
            ))}
          </div>
        );
      }
    }
  };

  return (
    <ExamFrame
      title={`${test.title} - Reading Part ${part.n}: ${part.title}`}
      headerRight={exam ? <TimeRemaining seconds={remaining} /> : null}
      onNext={() => go(idx + 1)}
      onBack={!exam && idx > 0 ? () => go(idx - 1) : undefined}
      footerLeft={
        !exam && (
          <button className="btn-plain" onClick={() => setShowKey((s) => !s)} data-testid="answer-key">
            {showKey ? "Hide Answer Key" : "Answer Key"}
          </button>
        )
      }
    >
      <div className="pane-left" data-testid="reading-left">
        {part.left.length && part.left[0].type !== "text" ? <Info>{part.intro}</Info> : null}
        {part.left.map(renderBlock)}
      </div>
      <div className="pane-right" data-testid="reading-right">{part.right.map(renderBlock)}</div>
    </ExamFrame>
  );
}
