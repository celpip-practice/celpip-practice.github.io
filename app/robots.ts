import type { MetadataRoute } from "next";
import { absUrl } from "@/lib/site";

export const dynamic = "force-static";

export default function robots(): MetadataRoute.Robots {
  return {
    // personal pages (history, practice runs) carry a noindex tag instead, which crawlers can only see if allowed in
    rules: { userAgent: "*", allow: "/" },
    sitemap: absUrl("/sitemap.xml"),
  };
}
