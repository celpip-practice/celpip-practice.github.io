import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Arrow } from "@/components/Icons";
import GuideLinks from "@/components/GuideLinks";
import { Crumbs } from "@/components/Seo";
import { isLang, localePath, translate, type Key } from "@/lib/dict";
import { LEVELS, PROGRAMS, SKILL_GUIDES } from "@/lib/guides";
import { LISTENING_BANDS, READING_BANDS } from "@/lib/scoring";
import { pageMetadata } from "@/lib/site";

type Params = { params: Promise<{ lang: string }> };

const TOTAL = 38;

/** "35–38" style ranges from the band minimums, which are sorted from the top level down. */
function ranges(bands: [number, string][]) {
  return new Map(bands.map(([min, level], i) => {
    const max = i === 0 ? TOTAL : bands[i - 1][0] - 1;
    return [level, min === max ? String(min) : `${min}–${max}`];
  }));
}

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { lang } = await params;
  return isLang(lang) ? pageMetadata(lang, "/scores/", "meta.scores.title", "meta.scores.description") : {};
}

export default async function ScoresPage({ params }: Params) {
  const { lang } = await params;
  if (!isLang(lang)) notFound();
  const t = (k: Key) => translate(lang, k);
  const listening = ranges(LISTENING_BANDS);
  const reading = ranges(READING_BANDS);
  return (
    <main className="page guide">
      <Crumbs lang={lang} items={[{ name: t("guide.crumb") }, { name: t("guide.scores") }]} />
      <div className="page-head">
        <h1>{t("scores.h1")}</h1>
        <p className="lead">{t("scores.lead")}</p>
      </div>

      <h2>{t("scores.rawTitle")}</h2>
      <div className="card flush table-scroll">
        <table className="matrix data">
          <thead>
            <tr><th>{t("scores.level")}</th><th>{t("scores.listening")}</th><th>{t("scores.reading")}</th></tr>
          </thead>
          <tbody>
            {LISTENING_BANDS.map(([, level]) => (
              <tr key={level}><td><b>{level}</b></td><td>{listening.get(level)} / {TOTAL}</td><td>{reading.get(level)} / {TOTAL}</td></tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="muted small">{t("scores.rawNote")}</p>

      <h2>{t("scores.ratedTitle")}</h2>
      <p>{SKILL_GUIDES.writing.scoring[lang]}</p>
      <p>{SKILL_GUIDES.speaking.scoring[lang]}</p>

      <h2>{t("scores.clbTitle")}</h2>
      <div className="card flush table-scroll">
        <table className="matrix data">
          <thead>
            <tr><th>{t("scores.level")}</th><th>CLB</th><th className="wide">{t("scores.desc")}</th></tr>
          </thead>
          <tbody>
            {LEVELS.map((l) => (
              <tr key={l.level}><td><b>{l.level}</b></td><td>{l.clb}</td><td className="wide">{l.desc[lang]}</td></tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="muted small">{t("scores.clbNote")}</p>

      <h2>{t("scores.progTitle")}</h2>
      <div className="card flush table-scroll">
        <table className="matrix data">
          <thead>
            <tr><th className="wide">{t("scores.program")}</th><th className="wide">{t("scores.need")}</th></tr>
          </thead>
          <tbody>
            {PROGRAMS.map((p) => (
              <tr key={p.name.en}><td className="wide"><b>{p.name[lang]}</b></td><td className="wide">{p.need[lang]}</td></tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="muted small">{t("scores.progNote")}</p>

      <div className="row guide-cta">
        <Link className="btn primary" href={localePath(lang, "/exam/")}>{t("scores.cta")} <Arrow size={16} /></Link>
      </div>

      <h2>{t("guide.others")}</h2>
      <GuideLinks lang={lang} exclude="scores" />
    </main>
  );
}
