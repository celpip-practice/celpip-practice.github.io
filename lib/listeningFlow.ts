import type { LPart, LQuestion, LSection } from "./types";

export type LScreen =
  | { type: "intro"; part: LPart }
  | { type: "media"; part: LPart; section: LSection; sectionIndex: number }
  | { type: "question"; part: LPart; question: LQuestion; index: number; total: number }
  | { type: "questions"; part: LPart; section: LSection };

/** Answering time per part, in seconds (time spent listening/watching is not counted). */
export const LISTENING_ANSWER_TIME: Record<number, number> = { 1: 240, 2: 150, 3: 180, 4: 180, 5: 240, 6: 210 };

/** Official on-screen instruction shown while a recording plays. */
export function mediaInstruction(part: LPart): string {
  switch (part.n) {
    case 1:
      return "Listen to the conversation. You will hear the conversation only once. It is about 1 to 1.5 minutes long.";
    case 2:
      return "Listen to the conversation. You will hear the conversation only once. It is about 1.5 to 2 minutes long.";
    case 3:
      return "Listen to the conversation. You will hear the conversation only once. It is about 2 to 3 minutes long.";
    case 4:
      return "Listen to the following news item. You will hear the news item only once. It is about 1.5 minutes long.";
    case 5:
      return "Watch the discussion. You will watch the discussion only once. It is about 1.5 to 2 minutes long.";
    default:
      return "Listen to the following report. You will hear the report only once. It is about 3 minutes long.";
  }
}

export function buildListeningScreens(parts: LPart[]): LScreen[] {
  const screens: LScreen[] = [];
  for (const part of parts) {
    screens.push({ type: "intro", part });
    const total = part.sections.reduce((n, s) => n + s.questions.length, 0);
    let index = 0;
    part.sections.forEach((section, sectionIndex) => {
      if (section.media) screens.push({ type: "media", part, section, sectionIndex });
      if (part.kind === "qa") {
        for (const question of section.questions) {
          index++;
          screens.push({ type: "question", part, question, index, total });
        }
      } else if (section.questions.length) {
        screens.push({ type: "questions", part, section });
      }
    });
  }
  return screens;
}

/** Index of the first screen of the next part (used when a part's time runs out). */
export function nextPartStart(screens: LScreen[], from: number): number {
  const n = screens[from]?.part.n;
  let i = from;
  while (i < screens.length && screens[i].part.n === n) i++;
  return i;
}
