import type { Metadata, Viewport } from "next";
import { notFound } from "next/navigation";
import "@fontsource/fira-sans/400.css";
import "@fontsource/fira-sans/500.css";
import "@fontsource/fira-sans/600.css";
import "../globals.css";
import SiteHeader from "@/components/SiteHeader";
import SiteFooter from "@/components/SiteFooter";
import { LANGS, isLang, translate } from "@/lib/dict";
import { LangProvider } from "@/lib/i18n";
import { SITE_URL } from "@/lib/site";

export const dynamicParams = false;

export function generateStaticParams() {
  return LANGS.map((lang) => ({ lang }));
}

export const viewport: Viewport = { width: "device-width", initialScale: 1, themeColor: "#0b1f3a" };

export async function generateMetadata({ params }: { params: Promise<{ lang: string }> }): Promise<Metadata> {
  const { lang } = await params;
  if (!isLang(lang)) return {};
  const siteName = translate(lang, "meta.siteName");
  return {
    metadataBase: new URL(SITE_URL),
    title: { default: translate(lang, "meta.home.title"), template: `%s | ${siteName}` },
    description: translate(lang, "meta.home.description"),
    applicationName: siteName,
    formatDetection: { telephone: false },
  };
}

export default async function LangLayout({ children, params }: { children: React.ReactNode; params: Promise<{ lang: string }> }) {
  const { lang } = await params;
  if (!isLang(lang)) notFound();
  return (
    <html lang={lang === "zh" ? "zh-CN" : "en-CA"}>
      <body>
        <LangProvider lang={lang}>
          <SiteHeader />
          {children}
          <SiteFooter />
        </LangProvider>
      </body>
    </html>
  );
}
