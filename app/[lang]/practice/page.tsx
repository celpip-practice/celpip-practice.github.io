import type { Metadata } from "next";
import PageIntro from "@/components/PageIntro";
import PracticeView from "@/components/views/PracticeView";
import { isLang, translate } from "@/lib/dict";
import { pageMetadata } from "@/lib/site";

type Params = { params: Promise<{ lang: string }> };

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { lang } = await params;
  return isLang(lang) ? pageMetadata(lang, "/practice/", "meta.practice.title", "meta.practice.description") : {};
}

export default async function PracticePage({ params }: Params) {
  const { lang } = await params;
  const l = isLang(lang) ? lang : "zh";
  return <PracticeView fallback={<PageIntro title={translate(l, "practice.title")} lead={translate(l, "meta.practice.description")} />} />;
}
