import type { Metadata } from "next";
import { Suspense } from "react";
import "@fontsource/fira-sans/400.css";
import "@fontsource/fira-sans/500.css";
import "@fontsource/fira-sans/600.css";
import "./globals.css";
import SiteHeader from "@/components/SiteHeader";

export const metadata: Metadata = {
  title: "CELPIP Open Practice",
  description: "CELPIP 官方真题在线模拟考试与分项练习",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="zh-CN">
      <body>
        <Suspense fallback={null}>
          <SiteHeader />
        </Suspense>
        {children}
      </body>
    </html>
  );
}
