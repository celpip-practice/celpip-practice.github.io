"use client";
import { useMemo, useState } from "react";
import ExamFrame, { Info, TimeRemaining } from "./ExamFrame";
import { AudioBox, VideoBox } from "./MediaPlayer";
import { Dropdown, KeyHint, RadioOptions } from "./Choices";
import { mediaUrl } from "@/lib/content";
import { LISTENING_ANSWER_TIME, buildListeningScreens, mediaInstruction, nextPartStart } from "@/lib/listeningFlow";
import { useCountdown } from "@/lib/useCountdown";
import type { Answers, LPart, Test } from "@/lib/types";

interface Props {
  test: Test;
  parts: LPart[];
  mode: "exam" | "practice";
  onFinish: (answers: Answers) => void;
}

export default function ListeningRunner({ test, parts, mode, onFinish }: Props) {
  const screens = useMemo(() => buildListeningScreens(parts), [parts]);
  const [idx, setIdx] = useState(0);
  const [answers, setAnswers] = useState<Answers>({});
  const [showKey, setShowKey] = useState(false);
  const [mediaEnded, setMediaEnded] = useState(false);
  const exam = mode === "exam";
  const screen = screens[idx];
  const answering = !!screen && (screen.type === "question" || screen.type === "questions");

  const go = (to: number) => {
    setMediaEnded(false);
    setShowKey(false);
    if (to >= screens.length) onFinish(answers);
    else setIdx(Math.max(0, to));
  };
  const next = () => go(idx + 1);

  const remaining = useCountdown(
    LISTENING_ANSWER_TIME[screen?.part.n ?? 1] ?? 180,
    exam && answering,
    () => go(nextPartStart(screens, idx)),
    screen?.part.n,
  );

  if (!screen) return null;
  const part = screen.part;
  const title = `${test.title} - Listening Part ${part.n}: ${part.title}`;
  const setAnswer = (id: string, v: number) => setAnswers((a) => ({ ...a, [id]: v }));
  const keyButton = !exam && answering && (
    <button className="btn-plain" onClick={() => setShowKey((s) => !s)} data-testid="answer-key">
      {showKey ? "Hide Answer Key" : "Answer Key"}
    </button>
  );
  const frame = (body: React.ReactNode, opts: { single?: boolean; nextDisabled?: boolean } = {}) => (
    <ExamFrame
      title={title}
      headerRight={exam && answering ? <TimeRemaining seconds={remaining} /> : null}
      onNext={next}
      nextDisabled={opts.nextDisabled}
      onBack={!exam && idx > 0 ? () => go(idx - 1) : undefined}
      footerLeft={keyButton}
      single={opts.single}
    >
      {body}
    </ExamFrame>
  );

  if (screen.type === "intro") {
    return frame(
      <div className="instructions" data-testid="intro">
        <h3>{part.title}</h3>
        <ul>
          {(part.intro.length ? part.intro : ["Choose the best answer to each question."]).map((s, i) => (
            <li key={i}>{s}</li>
          ))}
        </ul>
      </div>,
      { single: true },
    );
  }

  if (screen.type === "media") {
    const m = screen.section.media!;
    const onEnded = () => {
      setMediaEnded(true);
      if (exam) window.setTimeout(next, 800);
    };
    return frame(
      <>
        <Info>{mediaInstruction(part)}</Info>
        {m.type === "video" ? (
          <VideoBox key={idx} src={mediaUrl(test.id, m.src)} controls={!exam} onEnded={onEnded} />
        ) : (
          <AudioBox key={idx} src={mediaUrl(test.id, m.src)} controls={!exam} onEnded={onEnded} />
        )}
        {!exam && mediaEnded && screen.section.transcript && (
          <details style={{ maxWidth: 760, margin: "24px auto 0" }}>
            <summary>查看原文 Transcript</summary>
            <div className="transcript">{screen.section.transcript}</div>
          </details>
        )}
      </>,
      { single: true, nextDisabled: exam && !mediaEnded },
    );
  }

  if (screen.type === "question") {
    const q = screen.question;
    return frame(
      <>
        <div className="pane-left narrow">
          {q.audio ? (
            <>
              <Info>Listen to the question. You will hear it only once.</Info>
              <AudioBox key={idx} src={mediaUrl(test.id, q.audio)} controls={!exam} />
              {showKey && q.stem && <p className="center" style={{ marginTop: 20 }}><b>Q:</b> {q.stem}</p>}
            </>
          ) : (
            q.stem && (
              <>
                <Info>Read the question.</Info>
                <p className="center" style={{ marginTop: 20 }} data-testid="stem-text"><b>{q.stem}</b></p>
              </>
            )
          )}
        </div>
        <div className="pane-right wide">
          <p className="q-head">Question {screen.index} of {screen.total}</p>
          <div className="q-instr">Choose the best answer to each question.</div>
          <RadioOptions
            name={q.id}
            testId={test.id}
            options={q.options}
            value={answers[q.id]}
            onChange={(v) => setAnswer(q.id, v)}
            reveal={showKey ? q.answer : undefined}
          />
        </div>
      </>,
    );
  }

  // Parts 4-6: all questions on one screen with drop-down menus.
  const qs = screen.section.questions;
  return frame(
    <>
      <Info>
        {part.n === 5
          ? "Choose the best answer to each question from the drop-down menu (▼)."
          : "Choose the best way to complete each statement from the drop-down menu (▼)."}
      </Info>
      <ul className="dd-list">
        {qs.map((q) => {
          const opts = q.options.map((o) => o.text ?? "");
          return (
            <li key={q.id}>
              {q.num}. {q.prompt}{" "}
              <Dropdown
                options={opts}
                value={answers[q.id]}
                onChange={(v) => setAnswer(q.id, v)}
                reveal={showKey ? q.answer : undefined}
                testid={`dd-${q.id}`}
                ariaLabel={`Question ${q.num}`}
              />
              {showKey && <KeyHint options={opts} answer={q.answer} value={answers[q.id]} />}
            </li>
          );
        })}
      </ul>
      {showKey && screen.section.transcript && (
        <details open>
          <summary>原文 Transcript</summary>
          <div className="transcript">{screen.section.transcript}</div>
        </details>
      )}
    </>,
    { single: true },
  );
}
