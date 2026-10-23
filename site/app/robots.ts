import type { MetadataRoute } from "next";
import { INDEXABLE, SITE_URL } from "@/lib/seo";

// 社内確認中はすべて拒否。一般公開時に SEO_INDEX=1 で開く
export default function robots(): MetadataRoute.Robots {
  if (!INDEXABLE) return { rules: { userAgent: "*", disallow: "/" } };
  return { rules: { userAgent: "*", allow: "/", disallow: ["/api/", "/events?"] }, sitemap: `${SITE_URL}/sitemap.xml`, host: SITE_URL };
}
