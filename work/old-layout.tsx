import type { Metadata } from "next";
import { Suspense } from "react";
import "@fontsource/fira-sans/400.css";
import "@fontsource/fira-sans/500.css";
import "@fontsource/fira-sans/600.css";
import "./globals.css";
import SiteHeader from "@/components/SiteHeader";
import SiteFooter from "@/components/SiteFooter";
import { LangProvider } from "@/lib/i18n";

export const metadata: Metadata = {
  title: "CELPIP Practice",
  description: "CELPIP 官方真题在线模拟考试与分项练习 · CELPIP mock exams and practice by skill",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="zh-CN">
      <body>
        <LangProvider>
          <Suspense fallback={null}>
            <SiteHeader />
          </Suspense>
          {children}
          <Suspense fallback={null}>
            <SiteFooter />
          </Suspense>
        </LangProvider>
      </body>
    </html>
  );
}
