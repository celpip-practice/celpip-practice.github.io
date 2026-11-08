"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { DonateButton } from "./Donate";
import { Leaf } from "./Icons";
import { LANG_STORAGE_KEY, type Lang } from "@/lib/dict";
import { localePath, stripLang, useHref, useLang, useT } from "@/lib/i18n";
import { BASE_PATH } from "@/lib/site";

const LANG_LABEL: Record<Lang, string> = { en: "EN", zh: "中文" };
const LANG_ORDER: Lang[] = ["en", "zh"];

function LangSwitch({ path }: { path: string }) {
  const { lang } = useLang();
  const t = useT();
  return (
    <div className="lang-seg" role="group" aria-label={t("lang.label")}>
      {LANG_ORDER.map((l) => {
        const href = `${BASE_PATH}${localePath(l, path)}`;
        return (
          <a key={l} href={href} hrefLang={l === "zh" ? "zh-CN" : "en-CA"} lang={l === "zh" ? "zh-CN" : "en"}
            className={l === lang ? "active" : ""} aria-current={l === lang ? "true" : undefined} data-testid={`lang-${l}`}
            onClick={(e) => {
              e.preventDefault();
              localStorage.setItem(LANG_STORAGE_KEY, l);
              if (l !== lang) window.location.href = href + window.location.search;
            }}>
            {LANG_LABEL[l]}
          </a>
        );
      })}
    </div>
  );
}

export default function SiteHeader() {
  const path = stripLang(usePathname() ?? "/");
  const t = useT();
  const href = useHref();
  const nav = [
    { path: "/", label: t("nav.home") },
    { path: "/exam/", label: t("nav.exam") },
    { path: "/practice/", label: t("nav.practice") },
    { path: "/history/", label: t("nav.history") },
  ];
  const active = (p: string) => (p === "/" ? path === "/" : path.startsWith(p.replace(/\/$/, "")));
  return (
    <header className="site-header">
      <div className="site-header-inner">
        <Link href={href("/")} className="brand"><Leaf /> <span>CELPIP <b>Practice</b></span></Link>
        <nav>
          {nav.map((n) => (
            <Link key={n.path} href={href(n.path)} className={active(n.path) ? "active" : ""}>{n.label}</Link>
          ))}
        </nav>
        <DonateButton />
        <LangSwitch path={path} />
      </div>
    </header>
  );
}
