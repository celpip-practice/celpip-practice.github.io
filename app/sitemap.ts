import type { MetadataRoute } from "next";
import { LANGS } from "@/lib/dict";
import { absUrl } from "@/lib/site";

export const dynamic = "force-static";

const PAGES: { path: string; priority: number }[] = [
  { path: "/", priority: 1 },
  { path: "/exam/", priority: 0.9 },
  { path: "/practice/", priority: 0.9 },
];

export default function sitemap(): MetadataRoute.Sitemap {
  const lastModified = new Date();
  return PAGES.flatMap(({ path, priority }) =>
    LANGS.map((lang) => ({
      url: absUrl(`/${lang}${path}`),
      lastModified,
      changeFrequency: "weekly" as const,
      priority,
      alternates: { languages: { "zh-CN": absUrl(`/zh${path}`), "en-CA": absUrl(`/en${path}`) } },
    })),
  );
}
