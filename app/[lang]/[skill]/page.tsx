import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Arrow, SkillIcon } from "@/components/Icons";
import GuideLinks from "@/components/GuideLinks";
import { Crumbs } from "@/components/Seo";
import { isLang, localePath, translate, type Key, type Lang } from "@/lib/dict";
import { GUIDE_SKILLS, SKILL_GUIDES } from "@/lib/guides";
import { pageMeta } from "@/lib/site";
import type { Skill } from "@/lib/types";

type Params = { params: Promise<{ lang: string; skill: string }> };

const SAMPLE_TEST = "s13-t1";

export const dynamicParams = false;

export function generateStaticParams() {
  return GUIDE_SKILLS.map((skill) => ({ skill }));
}

function resolve(lang: string, skill: string): { lang: Lang; skill: Skill } | null {
  return isLang(lang) && (GUIDE_SKILLS as string[]).includes(skill) ? { lang, skill: skill as Skill } : null;
}

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { lang, skill } = await params;
  const r = resolve(lang, skill);
  if (!r) return {};
  const g = SKILL_GUIDES[r.skill];
  return pageMeta(r.lang, `/${r.skill}/`, g.title[r.lang], g.description[r.lang]);
}

export default async function SkillGuidePage({ params }: Params) {
  const { lang: rawLang, skill: rawSkill } = await params;
  const r = resolve(rawLang, rawSkill);
  if (!r) notFound();
  const { lang, skill } = r;
  const t = (k: Key, vars?: Record<string, string | number>) => translate(lang, k, vars);
  const g = SKILL_GUIDES[skill];
  const name = t(`skill.${skill}` as Key);
  const href = (p: string) => localePath(lang, p);
  return (
    <main className="page guide">
      <Crumbs lang={lang} items={[{ name: t("guide.crumb") }, { name }]} />
      <div className="page-head">
        <p className="eyebrow"><SkillIcon skill={skill} size={16} /> CELPIP-General</p>
        <h1>{g.h1[lang]}</h1>
        <p className="lead">{g.intro[lang]}</p>
      </div>

      <div className="grid three facts">
        {g.facts.map((f) => (
          <div className="card stat" key={f.label.en}>
            <span>{f.label[lang]}</span>
            <b>{f.value[lang]}</b>
          </div>
        ))}
      </div>
      <div className="row guide-cta">
        <Link className="btn primary" href={href(`/practice/?skill=${skill}`)}>{t("guide.practiceSkill", { skill: name })} <Arrow size={16} /></Link>
        <Link className="btn" href={href("/exam/")}>{t("guide.mock")}</Link>
      </div>

      <h2>{t("guide.format")}</h2>
      <ol className="part-list card">
        {g.parts.map((p) => (
          <li key={p.label}>
            <span className="part-label">{p.label}</span>
            <div className="grow">
              <h3 lang="en">{p.name}</h3>
              <div className="row tight part-meta">
                {p.questions !== undefined && <span className="pill blue">{t("test.questions", { n: p.questions })}</span>}
                <span className="pill">{p.time[lang]}</span>
              </div>
              <p>{p.what[lang]}</p>
            </div>
            <Link className="btn small" href={href(`/practice/run/?test=${SAMPLE_TEST}&skill=${skill}&part=${p.n}`)}>{t("guide.try")}</Link>
          </li>
        ))}
      </ol>
      <p className="muted small">{t("guide.tryNote")}</p>

      <h2>{t("guide.tips")}</h2>
      <ul className="tips">
        {g.tips[lang].map((tip) => <li key={tip}>{tip}</li>)}
      </ul>

      <h2>{t("guide.scoring")}</h2>
      <p>{g.scoring[lang]} <Link href={href("/scores/")}>{t("guide.scores")}</Link></p>

      <h2>{t("guide.others")}</h2>
      <GuideLinks lang={lang} exclude={skill} />
    </main>
  );
}
