"use client";
import Link from "next/link";
import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Back, SkillIcon } from "@/components/Icons";
import { useIndex } from "@/components/useTests";
import { loadTest } from "@/lib/content";
import { partName, skillName, testTitle, useT } from "@/lib/i18n";
import { store } from "@/lib/store";
import { SKILLS, type Skill, type Test } from "@/lib/types";

const PARTS: Record<Skill, number[]> = {
  listening: [1, 2, 3, 4, 5, 6],
  reading: [1, 2, 3, 4],
  writing: [1, 2],
  speaking: [0, 1, 2, 3, 4, 5, 6, 7, 8],
};

function partsOf(test: Test, skill: Skill): number[] {
  switch (skill) {
    case "listening": return test.listening?.parts.map((p) => p.n) ?? [];
    case "reading": return test.reading?.parts.map((p) => p.n) ?? [];
    case "writing": return test.writing?.tasks.map((t) => t.n) ?? [];
    case "speaking": return test.speaking?.tasks.map((t) => t.n) ?? [];
  }
}

function partShort(skill: Skill, n: number) {
  if (skill === "speaking") return n === 0 ? "P" : `T${n}`;
  return skill === "writing" ? `T${n}` : `P${n}`;
}

function PracticeInner() {
  const params = useSearchParams();
  const t = useT();
  const only = params.get("test");
  const [skill, setSkill] = useState<Skill>((params.get("skill") as Skill) || "listening");
  const { tests } = useIndex();
  const [loaded, setLoaded] = useState<Record<string, Test>>({});

  useEffect(() => {
    if (!tests) return;
    for (const x of tests) loadTest(x.id).then((v) => setLoaded((m) => ({ ...m, [x.id]: v })));
  }, [tests]);

  const list = (tests ?? []).filter((x) => !only || x.id === only);
  const parts = PARTS[skill];
  const scored = skill === "listening" || skill === "reading";
  return (
    <main className="page">
      {only && <Link href="/practice/" className="back-link"><Back size={16} /> {t("practice.title")}</Link>}
      <div className="page-head">
        <h1>{t("practice.title")}</h1>
        <p className="lead">{t("practice.lead")}</p>
      </div>
      <div className="seg" role="tablist">
        {SKILLS.map((s) => (
          <button key={s} role="tab" aria-selected={s === skill} className={s === skill ? "active" : ""}
            onClick={() => setSkill(s)} data-testid={`tab-${s}`}>
            <SkillIcon skill={s} size={18} /> {skillName(t, s)}
          </button>
        ))}
      </div>
      <div className="card flush">
        <div className="table-scroll">
          <table className="matrix">
            <thead>
              <tr>
                <th className="sticky-col" />
                {parts.map((n) => (
                  <th key={n} title={partName(t, skill, n)}>
                    <span className="part-no">{partShort(skill, n)}</span>
                    <span className="part-name">{partName(t, skill, n)}</span>
                  </th>
                ))}
                <th><span className="part-no">{t("practice.whole")}</span></th>
              </tr>
            </thead>
            <tbody>
              {list.map((x) => {
                const test = loaded[x.id];
                const nums = test ? partsOf(test, skill) : [];
                return (
                  <tr key={x.id}>
                    <td className="sticky-col"><b>{testTitle(t, x)}</b></td>
                    {parts.map((n) => {
                      const has = nums.includes(n);
                      const best = has && scored ? store().bestPartScore(x.id, skill, n) : undefined;
                      const full = best && best.correct === best.total;
                      return (
                        <td key={n}>
                          {has ? (
                            <Link className={`chip${best ? (full ? " done" : " tried") : ""}`}
                              href={`/practice/run/?test=${x.id}&skill=${skill}&part=${n}`}
                              title={best ? `${t("practice.best")}: ${best.correct}/${best.total}` : partName(t, skill, n)}
                              data-testid={`practice-${x.id}-${skill}-${n}`}>
                              {best ? `${best.correct}/${best.total}` : partShort(skill, n)}
                            </Link>
                          ) : (
                            <span className="muted">{test ? "—" : "…"}</span>
                          )}
                        </td>
                      );
                    })}
                    <td>
                      {nums.length > 0 && (
                        <Link className="chip all" href={`/practice/run/?test=${x.id}&skill=${skill}`}>{t("practice.whole")}</Link>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </main>
  );
}

export default function PracticePage() {
  return (
    <Suspense fallback={null}>
      <PracticeInner />
    </Suspense>
  );
}
