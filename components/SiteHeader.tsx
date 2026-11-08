"use client";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";

export default function SiteHeader() {
  const path = usePathname() ?? "/";
  const params = useSearchParams();
  // The exam window takes the whole screen, like the real test.
  const inRunner = (path.startsWith("/exam") && params?.get("run") === "1") || path.startsWith("/practice/run");
  if (inRunner) return null;
  const nav = [
    { href: "/", label: "首页" },
    { href: "/exam/", label: "模拟考试" },
    { href: "/practice/", label: "分项练习" },
    { href: "/history/", label: "练习记录" },
  ];
  const active = (href: string) => (href === "/" ? path === "/" : path.startsWith(href.replace(/\/$/, "")));
  return (
    <header className="site-header">
      <Link href="/" className="brand"><span className="leaf">🍁</span> CELPIP Open Practice</Link>
      <nav>
        {nav.map((n) => (
          <Link key={n.href} href={n.href} className={active(n.href) ? "active" : ""}>{n.label}</Link>
        ))}
      </nav>
    </header>
  );
}
