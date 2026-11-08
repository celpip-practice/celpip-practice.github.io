import type { Metadata } from "next";
import HistoryView from "@/components/views/HistoryView";
import { isLang } from "@/lib/dict";
import { pageMetadata } from "@/lib/site";

type Params = { params: Promise<{ lang: string }> };

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { lang } = await params;
  return isLang(lang) ? pageMetadata(lang, "/history/", "meta.history.title", "history.lead", { index: false }) : {};
}

export default function HistoryPage() {
  return <HistoryView />;
}
