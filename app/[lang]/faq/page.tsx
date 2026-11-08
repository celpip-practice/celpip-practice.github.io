import type { Metadata } from "next";
import { notFound } from "next/navigation";
import GuideLinks from "@/components/GuideLinks";
import { Crumbs, JsonLd } from "@/components/Seo";
import { isLang, translate, type Key } from "@/lib/dict";
import { FAQ } from "@/lib/guides";
import { pageMetadata } from "@/lib/site";

type Params = { params: Promise<{ lang: string }> };

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { lang } = await params;
  return isLang(lang) ? pageMetadata(lang, "/faq/", "meta.faq.title", "meta.faq.description") : {};
}

export default async function FaqPage({ params }: Params) {
  const { lang } = await params;
  if (!isLang(lang)) notFound();
  const t = (k: Key) => translate(lang, k);
  return (
    <main className="page guide">
      <Crumbs lang={lang} items={[{ name: t("guide.crumb") }, { name: t("guide.faq") }]} />
      <JsonLd
        data={{
          "@context": "https://schema.org",
          "@type": "FAQPage",
          inLanguage: lang === "zh" ? "zh-CN" : "en-CA",
          mainEntity: FAQ.map((f) => ({
            "@type": "Question",
            name: f.q[lang],
            acceptedAnswer: { "@type": "Answer", text: f.a[lang] },
          })),
        }}
      />
      <div className="page-head">
        <h1>{t("faq.h1")}</h1>
        <p className="lead">{t("faq.lead")}</p>
      </div>
      <div className="faq">
        {FAQ.map((f) => (
          <section className="card" key={f.q.en}>
            <h2>{f.q[lang]}</h2>
            <p>{f.a[lang]}</p>
          </section>
        ))}
      </div>

      <h2>{t("guide.homeTitle")}</h2>
      <GuideLinks lang={lang} exclude="faq" />
    </main>
  );
}
