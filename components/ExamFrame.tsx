"use client";
import { useEffect, type ReactNode } from "react";
import { formatRemaining } from "@/lib/scoring";

export function TimeRemaining({ seconds }: { seconds: number }) {
  const { value, unit } = formatRemaining(seconds);
  return (
    <span className={seconds < 60 ? "time-low" : ""} data-testid="time-remaining">
      Time remaining: <b>{value} {unit}</b>
    </span>
  );
}

export function Info({ children }: { children: ReactNode }) {
  return (
    <div className="info">
      <span className="i">i</span>
      <div>{children}</div>
    </div>
  );
}

interface Props {
  title: string;
  headerRight?: ReactNode;
  onNext?: () => void;
  nextDisabled?: boolean;
  nextLabel?: string;
  onBack?: () => void;
  footerLeft?: ReactNode;
  single?: boolean;
  children: ReactNode;
}

export default function ExamFrame({ title, headerRight, onNext, nextDisabled, nextLabel = "Next", onBack, footerLeft, single, children }: Props) {
  // the exam window takes the whole screen, like the real test
  useEffect(() => {
    document.body.classList.add("exam-mode");
    return () => document.body.classList.remove("exam-mode");
  }, []);
  return (
    <div className="exam-wrap">
      <div className="exam" data-testid="exam">
        <div className="exam-header">
          <div className="exam-title" data-testid="exam-title">{title}</div>
          <div className="right">
            {headerRight}
            {onNext && (
              <button className="btn-next" onClick={onNext} disabled={nextDisabled} data-testid="next">
                {nextLabel}
              </button>
            )}
          </div>
        </div>
        <div className={`exam-body${single ? " single" : ""}`}>{children}</div>
        <div className="exam-footer">
          <div>{footerLeft}</div>
          <button className="btn-back" onClick={onBack} disabled={!onBack} data-testid="back">
            Back
          </button>
        </div>
      </div>
    </div>
  );
}
