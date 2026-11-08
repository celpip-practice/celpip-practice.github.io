"use client";
import { useT } from "@/lib/i18n";

export default function SiteFooter() {
  const t = useT();
  return (
    <footer className="site-footer">
      <span>CELPIP Practice</span>
      <span>{t("footer.unofficial")}</span>
      <span>{t("footer.note")}</span>
    </footer>
  );
}
