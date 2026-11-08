import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Arrow, Back, SkillIcon } from "@/components/Icons";
import { Crumbs, JsonLd } from "@/components/Seo";
import { isLang, localePath, testTitle, translate, type Key, type Lang, type T } from "@/lib/dict";
import { absUrl, pageMeta } from "@/lib/site";
import { loadIndex, loadTestFile, summarize, type PartSummary } from "@/lib/testInfo";
import { SKILLS, type Skill, type TestSummary } from "@/lib/types";

type Params = { params: Promise<{ lang: string; id: string }> };

export const dynamicParams = false;

export function generateStaticParams() {
  return loadIndex().map((x) => ({ id: x.id }));
}

function translator(lang: Lang): T {
  return (k, vars) => translate(lang, k, vars);
}

function find(id: string): { entry: TestSummary; prev?: TestSummary; next?: TestSummary } | null {
  const index = loadIndex();
  const i = index.findIndex((x) => x.id === id);
  return i < 0 ? null : { entry: index[i], prev: index[i - 1], next: index[i + 1] };
}

/** Questions for listening/reading, tasks for writing/speaking (the unscored speaking practice task is left out). */
function countOf(skill: Skill, parts: PartSummary[]) {
  if (skill === "listening" || skill === "reading") return parts.reduce((n, p) => n + (p.questions ?? 0), 0);
  return parts.filter((p) => p.n > 0).length;
}

function partsLine(t: T, info: ReturnType<typeof summarize>) {
  return SKILLS.filter((s) => info[s])
    .map((s) => t(`test.count.${s}` as Key, { n: countOf(s, info[s]!) }))
    .join(t("test.join"));
}

function partLabel(skill: Skill, n: number) {
  if (skill === "speaking") return n === 0 ? "Practice" : `Task ${n}`;
  return skill === "writing" ? `Task ${n}` : `Part ${n}`;
}

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { lang, id } = await params;
  const found = isLang(lang) ? find(id) : null;
  if (!isLang(lang) || !found) return {};
  const t = translator(lang);
  const info = summarize(loadTestFile(id));
  const name = testTitle(t, found.entry);
  const topics = (info.writing ?? [])
    .map((w) => w.topic?.replace(/[.?!]$/, ""))
    .filter((x): x is string => !!x && x.length <= 60)
    .join("; ");
  return pageMeta(
    lang,
    `/tests/${id}/`,
    t("meta.test.title", { name }),
    t("meta.test.description", { name, parts: partsLine(t, info), topic: topics ? t("meta.test.topic", { x: topics }) : "" }).trim(),
  );
}

export default async function TestPage({ params }: Params) {
  const { lang, id } = await params;
  const found = isLang(lang) ? find(id) : null;
  if (!isLang(lang) || !found) notFound();
  const t = translator(lang);
  const href = (p: string) => localePath(lang, p);
  const { entry, prev, next } = found;
  const info = summarize(loadTestFile(id));
  const name = testTitle(t, entry);
  const parts = partsLine(t, info);
  return (
    <main className="page guide">
      <Crumbs lang={lang} items={[{ name: t("nav.exam"), path: "/exam/" }, { name }]} />
      <JsonLd
        data={{
          "@context": "https://schema.org",
          "@type": "LearningResource",
          name: `CELPIP ${name}`,
          description: t("test.lead", { parts }),
          url: absUrl(href(`/tests/${id}/`)),
          learningResourceType: "Practice test",
          educationalUse: "Exam preparation",
          inLanguage: "en",
          isAccessibleForFree: true,
          about: { "@type": "Thing", name: "CELPIP-General" },
        }}
      />
      <div className="page-head">
        <h1>{t("test.h1", { name })}</h1>
        <p className="lead">{t("test.lead", { parts })}</p>
      </div>
      <div className="row guide-cta">
        <Link className="btn primary" href={href(`/exam/?test=${id}`)} data-testid="test-start-exam">{t("test.startExam")} <Arrow size={16} /></Link>
        <Link className="btn" href={href(`/practice/?test=${id}`)}>{t("test.practice")}</Link>
      </div>
      <p className="muted small">{t("test.contentNote")}</p>

      <div className="test-skills">
        {SKILLS.filter((s) => info[s]).map((s) => (
          <section className="card" key={s}>
            <h2 className="card-title">
              <span className={`icon-tile skill-${s}`}><SkillIcon skill={s} size={18} /></span>
              {t(`skill.${s}` as Key)}
              <span className="pill">{t(`test.count.${s}` as Key, { n: countOf(s, info[s]!) })}</span>
              <Link className="small guide-link" href={href(`/${s}/`)}>{t("guide.skillCard", { skill: t(`skill.${s}` as Key) })}</Link>
            </h2>
            <ol className="part-list">
              {info[s]!.map((p) => (
                <li key={p.n}>
                  <span className="part-label">{partLabel(s, p.n)}</span>
                  <div className="grow">
                    <h3 lang="en">{p.title}{p.questions ? <span className="muted"> · {t("test.questions", { n: p.questions })}</span> : null}</h3>
                    {p.topic && <p className="topic" lang="en">{p.topic}</p>}
                  </div>
                  <Link className="btn small" href={href(`/practice/run/?test=${id}&skill=${s}&part=${p.n}`)}>{t("home.practice")}</Link>
                </li>
              ))}
            </ol>
          </section>
        ))}
      </div>

      <div className="row spread prev-next">
        {prev ? <Link className="btn" href={href(`/tests/${prev.id}/`)} title={t("test.prev")}><Back size={16} /> {testTitle(t, prev)}</Link> : <span />}
        {next ? <Link className="btn" href={href(`/tests/${next.id}/`)} title={t("test.next")}>{testTitle(t, next)} <Arrow size={16} /></Link> : <span />}
      </div>
    </main>
  );
}
