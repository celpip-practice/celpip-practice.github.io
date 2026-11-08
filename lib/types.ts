export type Skill = "listening" | "reading" | "writing" | "speaking";
export const SKILLS: Skill[] = ["listening", "reading", "writing", "speaking"];
export const SKILL_LABEL: Record<Skill, string> = {
  listening: "听力 Listening",
  reading: "阅读 Reading",
  writing: "写作 Writing",
  speaking: "口语 Speaking",
};

export interface Media {
  type: "audio" | "video";
  src: string;
  duration: number;
}

export interface LOption {
  text?: string;
  image?: string;
}

export interface LQuestion {
  id: string;
  num: number;
  prompt?: string;
  stem?: string;
  audio?: string;
  options: LOption[];
  answer: number | null;
}

export interface LSection {
  media: Media | null;
  transcript: string;
  questions: LQuestion[];
}

export interface LPart {
  n: number;
  title: string;
  kind: "qa" | "passage" | "video";
  intro: string[];
  sections: LSection[];
}

export interface RQuestion {
  id: string;
  num: number;
  prompt: string;
  options: string[];
  answer: number | null;
}

export type RBlock =
  | { type: "text"; intro?: string | null; paragraphs: string[] }
  | { type: "image"; src: string }
  | { type: "questions"; intro: string | null; style: "dropdown" | "paragraph"; items: RQuestion[] }
  | { type: "cloze"; intro: string; paragraphs: string[]; items: RQuestion[] };

export interface RPart {
  n: number;
  title: string;
  intro: string;
  left: RBlock[];
  right: RBlock[];
}

export interface WSample {
  level: string;
  paragraphs: string[];
}

export interface WTask {
  n: number;
  title: string;
  scenario: string[];
  instruction: string;
  bullets: string[];
  options: string[];
  surveyTitle: string | null;
  samples: WSample[];
  minutes: number;
}

export interface STask {
  n: number;
  title: string;
  prep: number;
  speak: number;
  prompt: string[];
  images?: string[];
  selectPrompt?: string[];
  options?: string[];
  otherOption?: string | null;
  choose?: number;
  choices?: string[];
  samples?: WSample[];
}

export interface Test {
  id: string;
  set: number;
  test: number;
  title: string;
  label?: string;
  listening?: { parts: LPart[] };
  reading?: { parts: RPart[] };
  writing?: { tasks: WTask[] };
  speaking?: { tasks: STask[] };
  warnings: string[];
}

export interface TestSummary {
  id: string;
  set: number;
  test: number;
  title: string;
  label?: string;
  skills: Skill[];
  warnings: number;
}

/** question id -> chosen option index */
export type Answers = Record<string, number>;
