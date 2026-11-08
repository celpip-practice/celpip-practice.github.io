import Link from "next/link";
import { localePath, translate, type Lang } from "@/lib/dict";
import { absUrl } from "@/lib/site";

export function JsonLd({ data }: { data: object }) {
  return <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(data).replace(/</g, "\\u003c") }} />;
}

/** Visible breadcrumb trail plus its BreadcrumbList structured data. Home is prepended automatically. */
export function Crumbs({ lang, items }: { lang: Lang; items: { name: string; path?: string }[] }) {
  const all = [{ name: translate(lang, "nav.home"), path: "/" }, ...items];
  return (
    <>
      <nav className="crumbs" aria-label="Breadcrumb">
        {all.map((c, i) => (
          <span key={i}>
            {c.path && i < all.length - 1 ? <Link href={localePath(lang, c.path)}>{c.name}</Link> : <span aria-current="page">{c.name}</span>}
          </span>
        ))}
      </nav>
      <JsonLd
        data={{
          "@context": "https://schema.org",
          "@type": "BreadcrumbList",
          itemListElement: all.map((c, i) => ({
            "@type": "ListItem",
            position: i + 1,
            name: c.name,
            ...(c.path ? { item: absUrl(localePath(lang, c.path)) } : {}),
          })),
        }}
      />
    </>
  );
}
