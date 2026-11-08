import type { Metadata } from "next";
import { LANGS, translate, type Key, type Lang } from "./dict";

export const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL || "https://celpip-practice.github.io").replace(/\/$/, "");
export const BASE_PATH = process.env.NEXT_PUBLIC_BASE_PATH ?? "";

/** Absolute URL of a site path, including any GitHub Pages base path. */
export function absUrl(path: string) {
  return `${SITE_URL}${BASE_PATH}${path}`;
}

const OG_LOCALE: Record<Lang, string> = { zh: "zh_CN", en: "en_CA" };
const HREFLANG: Record<Lang, string> = { zh: "zh-CN", en: "en-CA" };

/** Title, description, canonical + hreflang alternates and social cards for one page in one language. */
export function pageMetadata(lang: Lang, path: string, titleKey: Key, descKey?: Key, opts: { index?: boolean } = {}): Metadata {
  return pageMeta(lang, path, translate(lang, titleKey), translate(lang, descKey ?? "meta.home.description"), opts);
}

/** Same as pageMetadata, for pages whose title and description aren't dictionary entries. */
export function pageMeta(lang: Lang, path: string, title: string, description: string, opts: { index?: boolean } = {}): Metadata {
  const t = (k: Key) => translate(lang, k);
  const url = absUrl(`/${lang}${path}`);
  const languages: Record<string, string> = Object.fromEntries(LANGS.map((l) => [HREFLANG[l], absUrl(`/${l}${path}`)]));
  languages["x-default"] = absUrl(`/en${path}`);
  return {
    title,
    description,
    keywords: t("meta.keywords"),
    alternates: { canonical: url, languages },
    robots: opts.index === false ? { index: false, follow: true } : { index: true, follow: true },
    openGraph: {
      type: "website",
      url,
      title,
      description,
      siteName: t("meta.siteName"),
      locale: OG_LOCALE[lang],
      alternateLocale: LANGS.filter((l) => l !== lang).map((l) => OG_LOCALE[l]),
      images: [{ url: absUrl("/og.png"), width: 1200, height: 630, alt: t("meta.siteName") }],
    },
    twitter: { card: "summary_large_image", title, description, images: [absUrl("/og.png")] },
  };
}
