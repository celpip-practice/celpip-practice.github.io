"use client";
import { useRef, useState } from "react";
import ExamFrame, { Info, TimeRemaining } from "./ExamFrame";
import { countWords } from "@/lib/scoring";
import { useCountdown } from "@/lib/useCountdown";
import type { Test, WSample, WTask } from "@/lib/types";

interface Props {
  test: Test;
  tasks: WTask[];
  mode: "exam" | "practice";
  onFinish: (texts: Record<number, string>) => void;
}

export function Samples({ samples, words = true }: { samples: WSample[]; words?: boolean }) {
  const [level, setLevel] = useState(samples[0]?.level);
  const s = samples.find((x) => x.level === level);
  if (!samples.length) return <p className="muted">本题没有提供范文。</p>;
  return (
    <div data-testid="samples">
      <div className="level-tabs">
        {samples.map((x) => (
          <button key={x.level} className={x.level === level ? "active" : ""} onClick={() => setLevel(x.level)}>
            CELPIP {x.level} Response
          </button>
        ))}
      </div>
      <div className="passage">
        {s?.paragraphs.map((p, i) => <p key={i}>{p}</p>)}
        {words && <p className="muted">({countWords(s?.paragraphs.join(" ") ?? "")} words)</p>}
      </div>
    </div>
  );
}

export function TaskPrompt({ task }: { task: WTask }) {
  return (
    <>
      <Info>{task.instruction}</Info>
      {task.bullets.length > 0 && (
        <ul style={{ margin: "0 0 14px", color: "#333", lineHeight: 1.7 }}>
          {task.bullets.map((b, i) => <li key={i}>{b}</li>)}
        </ul>
      )}
      {task.options.length > 0 && (
        <ul style={{ margin: "0 0 14px", color: "#333", lineHeight: 1.7, listStyle: "none", paddingLeft: 12 }}>
          {task.options.map((o, i) => <li key={i}>{o}</li>)}
        </ul>
      )}
    </>
  );
}

export default function WritingRunner({ test, tasks, mode, onFinish }: Props) {
  const [idx, setIdx] = useState(0);
  const [texts, setTexts] = useState<Record<number, string>>({});
  const [showSamples, setShowSamples] = useState(false);
  const area = useRef<HTMLTextAreaElement>(null);
  const exam = mode === "exam";
  const task = tasks[idx];

  const go = (to: number) => {
    setShowSamples(false);
    if (to >= tasks.length) onFinish(texts);
    else setIdx(Math.max(0, to));
  };
  const remaining = useCountdown((task?.minutes ?? 27) * 60, true, () => go(idx + 1), idx);
  if (!task) return null;
  const text = texts[task.n] ?? "";
  const words = countWords(text);

  const tool = async (op: "cut" | "copy" | "paste" | "undo" | "redo") => {
    const el = area.current;
    if (!el) return;
    el.focus();
    const sel = el.value.slice(el.selectionStart, el.selectionEnd);
    if (op === "copy" || op === "cut") {
      await navigator.clipboard?.writeText(sel).catch(() => undefined);
      if (op === "cut") document.execCommand("delete");
    } else if (op === "paste") {
      const clip = await navigator.clipboard?.readText().catch(() => "");
      if (clip) document.execCommand("insertText", false, clip);
    } else {
      document.execCommand(op);
    }
  };

  return (
    <ExamFrame
      title={`${test.title} - Writing Task ${task.n}: ${task.title}`}
      headerRight={<TimeRemaining seconds={remaining} />}
      onNext={() => go(idx + 1)}
      onBack={!exam && idx > 0 ? () => go(idx - 1) : undefined}
    >
      <div className="pane-left narrow" style={{ background: "#f3f3f3", flexBasis: "32%" }}>
        <Info>Read the following information.</Info>
        {task.surveyTitle && <p><b>{task.surveyTitle}</b></p>}
        <div className="passage">{task.scenario.map((p, i) => <p key={i}>{p}</p>)}</div>
        {!exam && (
          <div className="sample-box" onClick={() => setShowSamples((s) => !s)} data-testid="toggle-samples">
            {showSamples ? "Return to Task" : "Click here to view sample responses."}
          </div>
        )}
      </div>
      <div className="pane-right" style={{ flexBasis: "68%" }}>
        {showSamples ? (
          <>
            <TaskPrompt task={task} />
            <Samples samples={task.samples} />
          </>
        ) : (
          <div className="write-box">
            <TaskPrompt task={task} />
            <div className="write-tools">
              <div className="tools">
                <button onClick={() => tool("cut")}>Cut</button>
                <button onClick={() => tool("copy")}>Copy</button>
                <button onClick={() => tool("paste")}>Paste</button>
                <button onClick={() => tool("undo")}>Undo</button>
                <button onClick={() => tool("redo")}>Redo</button>
              </div>
              <span data-testid="word-count">Word Count: <b>{words}</b></span>
            </div>
            <textarea
              ref={area}
              value={text}
              spellCheck={false}
              onChange={(e) => setTexts((t) => ({ ...t, [task.n]: e.target.value }))}
              data-testid="writing-area"
            />
            {words > 0 && (words < 150 || words > 200) && (
              <span className="note">建议字数 150-200 words（当前 {words}）</span>
            )}
          </div>
        )}
      </div>
    </ExamFrame>
  );
}
