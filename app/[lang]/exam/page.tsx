import type { Metadata } from "next";
import PageIntro from "@/components/PageIntro";
import ExamView from "@/components/views/ExamView";
import { isLang, translate } from "@/lib/dict";
import { pageMetadata } from "@/lib/site";

type Params = { params: Promise<{ lang: string }> };

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { lang } = await params;
  return isLang(lang) ? pageMetadata(lang, "/exam/", "meta.exam.title", "meta.exam.description") : {};
}

export default async function ExamPage({ params }: Params) {
  const { lang } = await params;
  const l = isLang(lang) ? lang : "zh";
  return <ExamView fallback={<PageIntro title={translate(l, "exam.title")} lead={translate(l, "meta.exam.description")} />} />;
}
