"use client";
import { useMemo, useRef } from "react";
import ListeningRunner from "./ListeningRunner";
import ReadingRunner from "./ReadingRunner";
import WritingRunner from "./WritingRunner";
import SpeakingRunner from "./SpeakingRunner";
import { ListeningResult, ReadingResult, SpeakingResult, WritingResult } from "./Results";
import { listeningQuestions, readingQuestions } from "@/lib/content";
import { grade } from "@/lib/scoring";
import { newAttemptId, store, type Attempt } from "@/lib/store";
import type { Answers, LPart, RPart, STask, Skill, Test, WTask } from "@/lib/types";

export function selectParts(test: Test, skill: Skill, parts?: number[]) {
  const pick = <T extends { n: number }>(xs: T[] = []) => (parts?.length ? xs.filter((x) => parts.includes(x.n)) : xs);
  return {
    listening: pick(test.listening?.parts),
    reading: pick(test.reading?.parts),
    writing: pick(test.writing?.tasks),
    // The speaking practice task is only offered in practice mode.
    speaking: pick(test.speaking?.tasks).filter((t) => (parts?.length ? true : t.n > 0)),
  }[skill];
}

export function AttemptResult({ test, attempt }: { test: Test; attempt: Attempt }) {
  const parts = selectParts(test, attempt.skill, attempt.parts);
  switch (attempt.skill) {
    case "listening":
      return <ListeningResult test={test} parts={parts as LPart[]} answers={attempt.answers} />;
    case "reading":
      return <ReadingResult test={test} parts={parts as RPart[]} answers={attempt.answers} />;
    case "writing":
      return <WritingResult test={test} tasks={parts as WTask[]} texts={attempt.writing ?? {}} />;
    case "speaking":
      return <SpeakingResult test={test} tasks={parts as STask[]} attemptId={attempt.id} />;
  }
}

interface Props {
  test: Test;
  skill: Skill;
  parts?: number[];
  mode: "exam" | "practice";
  onComplete: (a: Attempt) => void;
}

/** Runs one skill (optionally limited to some parts) and records the attempt. */
export function SkillRunner({ test, skill, parts, mode, onComplete }: Props) {
  const attemptId = useRef(newAttemptId()).current;
  const startedAt = useRef(Date.now()).current;
  const selected = useMemo(() => selectParts(test, skill, parts), [test, skill, parts]);
  const partNums = selected.map((p) => p.n);

  const finish = (extra: Partial<Attempt>) => {
    const a: Attempt = {
      id: attemptId, testId: test.id, mode, skill, parts: partNums, startedAt, finishedAt: Date.now(), answers: {}, ...extra,
    };
    store().saveAttempt(a);
    onComplete(a);
  };
  const finishMC = (answers: Answers, qs: { id: string; answer: number | null }[]) =>
    finish({ answers, score: grade(qs, answers) });

  switch (skill) {
    case "listening": {
      const ps = selected as LPart[];
      return <ListeningRunner test={test} parts={ps} mode={mode} onFinish={(a) => finishMC(a, ps.flatMap(listeningQuestions))} />;
    }
    case "reading": {
      const ps = selected as RPart[];
      return <ReadingRunner test={test} parts={ps} mode={mode} onFinish={(a) => finishMC(a, ps.flatMap(readingQuestions))} />;
    }
    case "writing":
      return <WritingRunner test={test} tasks={selected as WTask[]} mode={mode} onFinish={(texts) => finish({ writing: texts })} />;
    case "speaking":
      return (
        <SpeakingRunner test={test} tasks={selected as STask[]} mode={mode} attemptId={attemptId}
          onFinish={(rec) => finish({ speakingTasks: rec })} />
      );
  }
}