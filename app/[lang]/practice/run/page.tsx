import type { Metadata } from "next";
import PracticeRunView from "@/components/views/PracticeRunView";
import { isLang } from "@/lib/dict";
import { pageMetadata } from "@/lib/site";

type Params = { params: Promise<{ lang: string }> };

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { lang } = await params;
  return isLang(lang) ? pageMetadata(lang, "/practice/run/", "meta.run.title", "meta.practice.description", { index: false }) : {};
}

export default function PracticeRunPage() {
  return <PracticeRunView />;
}
