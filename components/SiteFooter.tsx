"use client";
import { usePathname, useSearchParams } from "next/navigation";
import { useT } from "@/lib/i18n";

export default function SiteFooter() {
  const path = usePathname() ?? "/";
  const params = useSearchParams();
  const t = useT();
  if ((path.startsWith("/exam") && params?.get("run") === "1") || path.startsWith("/practice/run")) return null;
  return (
    <footer className="site-footer">
      <span>CELPIP Practice</span>
      <span>{t("footer.note")}</span>
    </footer>
  );
}
