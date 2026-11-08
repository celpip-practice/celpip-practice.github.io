"use client";
import { useEffect, useRef, useState } from "react";
import ExamFrame, { Info } from "./ExamFrame";
import { mediaUrl } from "@/lib/content";
import { useT } from "@/lib/i18n";
import { recordingKey, saveRecording } from "@/lib/recordings";
import { useCountdown } from "@/lib/useCountdown";
import type { STask, Test } from "@/lib/types";

type Phase = "choose" | "prep" | "record";

interface Props {
  test: Test;
  tasks: STask[];
  mode: "exam" | "practice";
  attemptId: string;
  onFinish: (recorded: number[]) => void;
}

function beep() {
  try {
    const ctx = new AudioContext();
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.frequency.value = 880;
    g.gain.value = 0.15;
    o.connect(g).connect(ctx.destination);
    o.start();
    o.stop(ctx.currentTime + 0.35);
  } catch {
    /* audio cue is optional */
  }
}

export function TimerBox({ label, seconds, total, recording }: { label: string; seconds: number; total: number; recording?: boolean }) {
  return (
    <div className={`timer-box${recording ? " recording" : ""}`} data-testid={recording ? "recording-box" : "prep-box"}>
      <div className="clock" aria-hidden>{recording ? "🎙" : "🕓"}</div>
      <div className="meta">
        {label}
        {recording ? (
          <div className="bar"><div style={{ width: `${(1 - seconds / total) * 100}%` }} /></div>
        ) : (
          <div className="n">{Math.ceil(seconds)}</div>
        )}
      </div>
    </div>
  );
}

export default function SpeakingRunner({ test, tasks, mode, attemptId, onFinish }: Props) {
  const t = useT();
  const [idx, setIdx] = useState(0);
  const task = tasks[idx];
  const [phase, setPhase] = useState<Phase>(task?.n === 5 ? "choose" : "prep");
  const [choice, setChoice] = useState<number | null>(null);
  const [choice6, setChoice6] = useState<number | null>(null);
  const [micError, setMicError] = useState<string | null>(null);
  const [lastUrl, setLastUrl] = useState<string | null>(null);
  const [wideCards, setWideCards] = useState(false);
  const onCardLoad = (e: React.SyntheticEvent<HTMLImageElement>) => {
    const im = e.currentTarget;
    if (im.naturalWidth > 1.5 * im.naturalHeight) setWideCards(true);
  };
  const cardsClass = `cards${wideCards ? " wide" : ""}`;
  const stream = useRef<MediaStream | null>(null);
  const recorder = useRef<MediaRecorder | null>(null);
  const recorded = useRef<number[]>([]);
  const saves = useRef<Promise<void>[]>([]);
  const exam = mode === "exam";

  const mic = useRef<Promise<MediaStream | null>>(Promise.resolve(null));
  const take = useRef({ stopped: true });

  useEffect(() => {
    let alive = true;
    if (navigator.mediaDevices) {
      mic.current = navigator.mediaDevices
        .getUserMedia({ audio: true })
        .then((s) => {
          if (alive) return (stream.current = s);
          s.getTracks().forEach((t) => t.stop());
          return null;
        })
        .catch((e) => {
          setMicError(String(e?.message ?? e));
          return null;
        });
    } else setMicError(t("runner.micUnsupported"));
    return () => {
      alive = false;
      recorder.current?.state === "recording" && recorder.current.stop();
      stream.current?.getTracks().forEach((t) => t.stop());
    };
  }, []);

  const phaseSeconds = !task ? 0 : phase === "choose" ? task.choose ?? 60 : phase === "prep" ? task.prep : task.speak;

  const startRecording = () => {
    beep();
    const n = task.n;
    const current = (take.current = { stopped: false });
    saves.current.push(
      // the microphone may still be opening when the first task's recording starts
      mic.current.then(
        (s) =>
          new Promise<void>((resolve) => {
            if (!s || current.stopped || typeof MediaRecorder === "undefined") return resolve();
            const chunks: Blob[] = [];
            const rec = new MediaRecorder(s);
            rec.ondataavailable = (e) => e.data.size && chunks.push(e.data);
            rec.onstop = () => {
              const blob = new Blob(chunks, { type: rec.mimeType || "audio/webm" });
              recorded.current.push(n);
              setLastUrl(URL.createObjectURL(blob));
              saveRecording(recordingKey(attemptId, n), blob).catch(() => undefined).finally(resolve);
            };
            rec.start();
            recorder.current = rec;
          }),
      ),
    );
  };

  const stopRecording = () => {
    take.current.stopped = true;
    if (recorder.current?.state === "recording") recorder.current.stop();
    recorder.current = null;
  };

  const advance = () => {
    if (!task) return;
    if (phase === "choose") {
      if (choice === null) setChoice(0); // the computer chooses for you
      setPhase("prep");
    } else if (phase === "prep") {
      setPhase("record");
      startRecording();
    } else {
      stopRecording();
      if (idx + 1 >= tasks.length) {
        Promise.all(saves.current).then(() => onFinish([...recorded.current]));
        return;
      }
      const nt = tasks[idx + 1];
      setIdx(idx + 1);
      setChoice(null);
      setChoice6(null);
      setPhase(nt.n === 5 ? "choose" : "prep");
    }
  };

  const remaining = useCountdown(phaseSeconds, !!task, advance, `${idx}-${phase}`);
  if (!task) return null;

  const timer =
    phase === "record" ? (
      <TimerBox label="Recording..." seconds={remaining} total={task.speak} recording />
    ) : (
      <TimerBox label={phase === "choose" ? "Selection Time" : "Preparation Time"} seconds={remaining} total={phaseSeconds} />
    );
  const title = task.n === 0 ? `${test.title} - Speaking Practice Task` : `${test.title} - Speaking Task ${task.n}: ${task.title}`;
  const headerRight = (
    <span>
      {task.n === 5 && phase === "choose" ? <>Selection: <b>{task.choose ?? 60} seconds</b> </> : null}
      Preparation: <b>{task.prep} seconds</b> Recording: <b>{task.speak} seconds</b>
    </span>
  );
  const img = task.images?.[0];

  let body: React.ReactNode;
  if (task.n === 5) {
    const opts = task.options ?? [];
    if (phase === "choose") {
      body = (
        <>
          {(task.selectPrompt ?? []).map((p, i) => <Info key={i}>{p}</Info>)}
          <div className={cardsClass}>
            {opts.map((o, i) => (
              <button key={i} className={`opt${choice === i ? " sel" : ""}`} onClick={() => setChoice(i)} data-testid={`s5-option-${i}`}>
                <img src={mediaUrl(test.id, o)} alt={`Option ${i + 1}`} onLoad={onCardLoad} />
              </button>
            ))}
          </div>
          <div style={{ marginTop: 16 }}>{timer}</div>
        </>
      );
    } else {
      const mine = opts[choice ?? 0];
      body = (
        <>
          {task.prompt.map((p, i) => <Info key={i}>{p}</Info>)}
          <div className={cardsClass}>
            {task.otherOption && (
              <div className="opt"><div className="cap">Their Choice</div><img src={mediaUrl(test.id, task.otherOption)} alt="their choice" onLoad={onCardLoad} /></div>
            )}
            {mine && <div className="opt mine"><div className="cap">Your Choice</div><img src={mediaUrl(test.id, mine)} alt="your choice" onLoad={onCardLoad} /></div>}
          </div>
          <div style={{ marginTop: 16 }}>{timer}</div>
        </>
      );
    }
  } else if (task.n === 6) {
    body = (
      <>
        <Info>
          {task.prompt.map((p, i) => <div key={i} style={{ marginBottom: 8 }}>{p}</div>)}
          <div className="choice-block">
            <div style={{ fontWeight: 600 }}>Choose ONE:</div>
            {(task.choices ?? []).map((c, i) => (
              <label key={i} style={{ display: "flex", gap: 8, alignItems: "baseline", margin: "6px 0" }}>
                <input type="radio" name="s6" checked={choice6 === i} onChange={() => setChoice6(i)} />
                <span><b>{i === 0 ? "EITHER" : "OR"}</b> {c}</span>
              </label>
            ))}
          </div>
        </Info>
        {timer}
      </>
    );
  } else {
    body = (
      <>
        {task.prompt.map((p, i) => <Info key={i}>{p}</Info>)}
        <div className="speak-layout">
          {img && (
            <div>
              <img className="scene" src={mediaUrl(test.id, img)} alt="task picture" />
            </div>
          )}
          {timer}
        </div>
      </>
    );
  }

  return (
    <ExamFrame title={title} headerRight={headerRight} onNext={advance} single>
      {body}
      {micError && (
        <p className="warn-box" style={{ marginTop: 16 }}>
          {t("runner.micError", { error: micError })}
        </p>
      )}
      {!exam && lastUrl && phase === "prep" && (
        <div style={{ marginTop: 16 }}>
          <span className="muted">{t("runner.lastRecording")}</span>
          <audio src={lastUrl} controls style={{ verticalAlign: "middle" }} />
        </div>
      )}
      {phase === "record" && <p className="note">Start speaking now. {t("runner.recording")}</p>}
    </ExamFrame>
  );
}
