"use client";
import { mediaUrl } from "@/lib/content";
import type { LOption } from "@/lib/types";

interface RadioProps {
  name: string;
  testId: string;
  options: LOption[];
  value: number | undefined;
  onChange: (i: number) => void;
  reveal?: number | null;
}

export function RadioOptions({ name, testId, options, value, onChange, reveal }: RadioProps) {
  const showKey = reveal !== undefined && reveal !== null;
  return (
    <ul className="radio-list" data-testid="radio-options">
      {options.map((o, i) => {
        const cls = [value === i ? "sel" : "", showKey && i === reveal ? "correct" : "", showKey && value === i && i !== reveal ? "wrong" : ""]
          .filter(Boolean)
          .join(" ");
        return (
          <li key={i}>
            <label className={cls}>
              <input type="radio" name={name} checked={value === i} onChange={() => onChange(i)} />
              {o.image ? <img src={mediaUrl(testId, o.image)} alt={`option ${i + 1}`} /> : <span>{o.text}</span>}
            </label>
          </li>
        );
      })}
    </ul>
  );
}

interface SelectProps {
  options: string[];
  value: number | undefined;
  onChange: (i: number) => void;
  reveal?: number | null;
  testid?: string;
  ariaLabel?: string;
}

export function Dropdown({ options, value, onChange, reveal, testid, ariaLabel }: SelectProps) {
  const showKey = reveal !== undefined && reveal !== null && value !== undefined;
  const cls = `dd${showKey ? (value === reveal ? " correct" : " wrong") : ""}`;
  return (
    <select
      className={cls}
      value={value === undefined ? "" : String(value)}
      onChange={(e) => e.target.value !== "" && onChange(Number(e.target.value))}
      data-testid={testid}
      aria-label={ariaLabel}
    >
      <option value="" disabled hidden></option>
      {options.map((o, i) => (
        <option key={i} value={i}>
          {o}
        </option>
      ))}
    </select>
  );
}

export function KeyHint({ options, answer, value }: { options: string[]; answer: number | null; value: number | undefined }) {
  if (answer === null) return null;
  const ok = value === answer;
  return (
    <span className={`feedback ${ok ? "ok" : "bad"}`}>
      {ok ? "✓" : `✗ 正确答案: ${options[answer]}`}
    </span>
  );
}
