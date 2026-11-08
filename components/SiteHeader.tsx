"use client";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { Globe, Leaf } from "./Icons";
import { useLang, useT } from "@/lib/i18n";

export default function SiteHeader() {
  const path = usePathname() ?? "/";
  const params = useSearchParams();
  const t = useT();
  const { lang, setLang } = useLang();
  // The exam window takes the whole screen, like the real test.
  const inRunner = (path.startsWith("/exam") && params?.get("run") === "1") || path.startsWith("/practice/run");
  if (inRunner) return null;
  const nav = [
    { href: "/", label: t("nav.home") },
    { href: "/exam/", label: t("nav.exam") },
    { href: "/practice/", label: t("nav.practice") },
    { href: "/history/", label: t("nav.history") },
  ];
  const active = (href: string) => (href === "/" ? path === "/" : path.startsWith(href.replace(/\/$/, "")));
  return (
    <header className="site-header">
      <div className="site-header-inner">
        <Link href="/" className="brand"><Leaf /> <span>CELPIP <b>Practice</b></span></Link>
        <nav>
          {nav.map((n) => (
            <Link key={n.href} href={n.href} className={active(n.href) ? "active" : ""}>{n.label}</Link>
          ))}
        </nav>
        <button className="lang-toggle" onClick={() => setLang(lang === "zh" ? "en" : "zh")}
          title={t("lang.switchTitle")} data-testid="lang-toggle">
          <Globe size={16} /> {t("lang.switch")}
        </button>
      </div>
    </header>
  );
}
