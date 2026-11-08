import type { MetadataRoute } from "next";
import { LANGS } from "@/lib/dict";
import { GUIDE_SKILLS } from "@/lib/guides";
import { absUrl } from "@/lib/site";
import { loadIndex } from "@/lib/testInfo";

export const dynamic = "force-static";

export default function sitemap(): MetadataRoute.Sitemap {
  const pages: { path: string; priority: number }[] = [
    { path: "/", priority: 1 },
    { path: "/exam/", priority: 0.9 },
    { path: "/practice/", priority: 0.9 },
    ...GUIDE_SKILLS.map((s) => ({ path: `/${s}/`, priority: 0.8 })),
    { path: "/scores/", priority: 0.8 },
    { path: "/faq/", priority: 0.7 },
    ...loadIndex().map((x) => ({ path: `/tests/${x.id}/`, priority: 0.6 })),
  ];
  const lastModified = new Date();
  return pages.flatMap(({ path, priority }) =>
    LANGS.map((lang) => ({
      url: absUrl(`/${lang}${path}`),
      lastModified,
      changeFrequency: "weekly" as const,
      priority,
      alternates: { languages: { "zh-CN": absUrl(`/zh${path}`), "en-CA": absUrl(`/en${path}`), "x-default": absUrl(`/en${path}`) } },
    })),
  );
}
