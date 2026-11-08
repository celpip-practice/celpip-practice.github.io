"use client";
import Link from "next/link";
import { GUIDE_SKILLS } from "@/lib/guides";
import { skillName, useHref, useT } from "@/lib/i18n";

export default function SiteFooter() {
  const t = useT();
  const href = useHref();
  return (
    <footer className="site-footer">
      <nav className="footer-links" aria-label={t("guide.homeTitle")}>
        {GUIDE_SKILLS.map((s) => (
          <Link key={s} href={href(`/${s}/`)}>{t("guide.skillCard", { skill: skillName(t, s) })}</Link>
        ))}
        <Link href={href("/scores/")}>{t("guide.scores")}</Link>
        <Link href={href("/faq/")}>{t("guide.faq")}</Link>
      </nav>
      <div className="footer-note">
        <span>CELPIP Practice</span>
        <span>{t("footer.unofficial")}</span>
        <span>{t("footer.note")}</span>
      </div>
    </footer>
  );
}
