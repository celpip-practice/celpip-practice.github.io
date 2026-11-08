import type { Skill } from "@/lib/types";

type P = { size?: number; className?: string };

function Svg({ size = 20, className, children }: P & { children: React.ReactNode }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8}
      strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
      {children}
    </svg>
  );
}

export const Headphones = (p: P) => (
  <Svg {...p}><path d="M3 18v-6a9 9 0 0 1 18 0v6" /><path d="M21 19a2 2 0 0 1-2 2h-1v-6h3zM3 19a2 2 0 0 0 2 2h1v-6H3z" /></Svg>
);
export const Book = (p: P) => (
  <Svg {...p}><path d="M2 4h6a4 4 0 0 1 4 4v13a3 3 0 0 0-3-3H2z" /><path d="M22 4h-6a4 4 0 0 0-4 4v13a3 3 0 0 1 3-3h7z" /></Svg>
);
export const Pen = (p: P) => (
  <Svg {...p}><path d="M12 20h9" /><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z" /></Svg>
);
export const Mic = (p: P) => (
  <Svg {...p}><rect x="9" y="2" width="6" height="12" rx="3" /><path d="M19 10a7 7 0 0 1-14 0M12 17v5M8 22h8" /></Svg>
);
export const Clock = (p: P) => (
  <Svg {...p}><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></Svg>
);
export const Target = (p: P) => (
  <Svg {...p}><circle cx="12" cy="12" r="9" /><circle cx="12" cy="12" r="5" /><circle cx="12" cy="12" r="1" /></Svg>
);
export const Timer = (p: P) => (
  <Svg {...p}><circle cx="12" cy="13" r="8" /><path d="M12 9v4l2 2M9 2h6" /></Svg>
);
export const Arrow = (p: P) => (
  <Svg {...p}><path d="M5 12h14M13 6l6 6-6 6" /></Svg>
);
export const Back = (p: P) => (
  <Svg {...p}><path d="M19 12H5M11 18l-6-6 6-6" /></Svg>
);
export const Globe = (p: P) => (
  <Svg {...p}><circle cx="12" cy="12" r="9" /><path d="M3 12h18M12 3a14 14 0 0 1 0 18M12 3a14 14 0 0 0 0 18" /></Svg>
);
export const Check = (p: P) => (
  <Svg {...p}><path d="M5 12l5 5L20 7" /></Svg>
);

export function Leaf({ size = 26 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" aria-hidden="true">
      <rect width="32" height="32" rx="8" fill="#d52b1e" />
      <path fill="#fff" d="M16 5l1.6 3.2 1.9-.9-.6 4.4 2.6-2.8.6 1.6 2.9-.6-1 3.2 1.4.7-4.4 3.6.6 1.6-4.6-.6.2 4.6h-1.4l.2-4.6-4.6.6.6-1.6-4.4-3.6 1.4-.7-1-3.2 2.9.6.6-1.6 2.6 2.8-.6-4.4 1.9.9z" />
    </svg>
  );
}

export function SkillIcon({ skill, size }: { skill: Skill } & P) {
  const I = { listening: Headphones, reading: Book, writing: Pen, speaking: Mic }[skill];
  return <I size={size} />;
}
