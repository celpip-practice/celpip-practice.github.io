import type { Metadata } from "next";
import HomeView from "@/components/views/HomeView";
import { isLang, translate, type Lang } from "@/lib/dict";
import { absUrl, pageMetadata } from "@/lib/site";
import { loadIndex } from "@/lib/testInfo";

type Params = { params: Promise<{ lang: string }> };

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { lang } = await params;
  return isLang(lang) ? { ...pageMetadata(lang, "/", "meta.home.title"), title: { absolute: translate(lang, "meta.home.title") } } : {};
}

function jsonLd(lang: Lang) {
  const url = absUrl(`/${lang}/`);
  return {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "WebSite",
        "@id": `${absUrl("/")}#website`,
        url,
        name: translate(lang, "meta.siteName"),
        description: translate(lang, "meta.home.description"),
        inLanguage: ["zh-CN", "en-CA"],
      },
      {
        "@type": "WebApplication",
        name: translate(lang, "meta.siteName"),
        url,
        applicationCategory: "EducationalApplication",
        operatingSystem: "Any",
        inLanguage: lang === "zh" ? "zh-CN" : "en-CA",
        description: translate(lang, "meta.home.description"),
        offers: { "@type": "Offer", price: "0", priceCurrency: "CAD" },
      },
    ],
  };
}

export default async function HomePage({ params }: Params) {
  const { lang } = await params;
  const l: Lang = isLang(lang) ? lang : "zh";
  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd(l)).replace(/</g, "\\u003c") }} />
      <HomeView tests={loadIndex()} />
    </>
  );
}
