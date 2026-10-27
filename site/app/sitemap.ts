import type { MetadataRoute } from "next";
import { getEvents, getMuseums } from "@/lib/data";
import { GENRES } from "@/lib/genres";
import { PREFS, WANTS } from "@/lib/types";
import { SITE_URL } from "@/lib/seo";
import { WANT_SLUGS } from "@/lib/areas";

export const revalidate = 3600;

// 催しのある県・館・催しだけを載せる（中身のないページは載せない）
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const [events, museums] = await Promise.all([getEvents(), getMuseums()]);
  const now = new Date();
  const prefs = new Set(events.map((e) => e.pref));
  const prefWants = new Set(events.map((e) => `${e.pref}|${e.kind ?? ""}`));
  const liveMuseums = new Set(events.map((e) => e.no));
  const url = (p: string, priority: number, changeFrequency: "daily" | "weekly" = "daily") => ({ url: `${SITE_URL}${p}`, lastModified: now, changeFrequency, priority });
  return [
    url("/", 1),
    url("/about", 0.3, "weekly"),
    ...GENRES.map((g) => url(`/genres/${g.slug}`, 0.7)),
    ...PREFS.filter((p) => prefs.has(p)).map((p) => url(`/area/${encodeURIComponent(p)}`, 0.8)),
    ...PREFS.flatMap((p) =>
      (Object.keys(WANTS) as (keyof typeof WANTS)[])
        .filter((w) => WANTS[w].some((k) => prefWants.has(`${p}|${k}`)))
        .map((w) => url(`/area/${encodeURIComponent(p)}/${WANT_SLUGS[w]}`, 0.6)),
    ),
    ...museums.filter((m) => liveMuseums.has(m.no)).map((m) => url(`/museums/${m.no}`, 0.5, "weekly")),
    ...events.map((e) => url(`/events/${e.id}`, 0.4)),
  ];
}
