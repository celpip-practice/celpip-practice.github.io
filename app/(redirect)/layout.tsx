import type { Metadata } from "next";
import "../globals.css";
import { absUrl, SITE_URL } from "@/lib/site";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: "CELPIP Practice",
  description: "Free CELPIP mock exams and practice by skill · 免费的 CELPIP（思培）在线模考与分项练习",
  robots: { index: false, follow: true },
  alternates: {
    languages: { "zh-CN": absUrl("/zh/"), "en-CA": absUrl("/en/"), "x-default": absUrl("/en/") },
  },
};

export default function RedirectLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
