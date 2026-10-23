import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getEvents, getMuseum } from "@/lib/data";
import { EventGrid } from "@/components/EventCard";
import { genreOf } from "@/lib/genres";
import { pageMeta, breadcrumbLd, JsonLd, safeUrl } from "@/lib/seo";
import { getLang, t, genreLabel, prefLabel } from "@/lib/i18n";

export const revalidate = 600;

type Props = { params: Promise<{ no: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const m = await getMuseum((await params).no);
  return m ? pageMeta({ title: `${m.name}のイベント・ワークショップ・展覧会（${m.pref}${m.city}）`, description: `${m.pref}${m.city}の${m.name}で開かれるワークショップ、講座、展覧会の予定。日にち・対象・料金・予約の要否を掲載しています。`, path: `/museums/${m.no}` }) : {};
}

export default async function MuseumPage({ params }: Props) {
  const { no } = await params;
  const m = await getMuseum(no);
  if (!m) notFound();
  const events = (await getEvents()).filter((e) => e.no === no);
  const exhibitions = events.filter((e) => e.kind === "特別展・企画展" || e.kind === "常設展");
  const programs = events.filter((e) => !exhibitions.includes(e));
  const g = genreOf(m.category);
  const lang = await getLang();
  return (
    <div style={{ "--g": g.color, "--gi": g.ink } as React.CSSProperties}>
      <JsonLd data={{ "@context": "https://schema.org", "@type": m.category.includes("水族館") ? "Aquarium" : m.category.includes("動物園") ? "Zoo" : "Museum", name: m.name, url: safeUrl(m.url) ?? undefined, address: { "@type": "PostalAddress", addressRegion: m.pref, addressLocality: m.city, addressCountry: "JP" }, event: events.slice(0, 20).map((e) => ({ "@type": "Event", name: e.title, startDate: e.start_date, endDate: e.end_date ?? e.start_date, url: safeUrl(e.source_url) ?? undefined, location: { "@type": "Place", name: m.name, address: { "@type": "PostalAddress", addressRegion: m.pref, addressLocality: m.city, addressCountry: "JP" } } })) }} />
      <JsonLd data={breadcrumbLd([{ name: "トップ", path: "/" }, { name: m.pref, path: `/area/${encodeURIComponent(m.pref)}` }, { name: m.name, path: `/museums/${m.no}` }])} />
      <div className="genre-hero">
        <div>
          <p>{genreLabel(g.slug, g.label, lang)}　{lang === "ja" ? `${m.pref}${m.city}` : prefLabel(m.pref, lang)}</p>
          <h1>{m.name}</h1>
          <p>{safeUrl(m.url) && <a href={safeUrl(m.url) ?? undefined} target="_blank" rel="noopener noreferrer">{t(lang, "officialSite")} ›</a>}{safeUrl(m.instagram) && <>　<a href={safeUrl(m.instagram) ?? undefined} target="_blank" rel="noopener noreferrer">Instagram ›</a></>}</p>
        </div>
        <span className="genre-m" aria-hidden="true" />
      </div>
      {m.closed && (
        <section className="amen">
          <h2>{t(lang, "closedDays")}</h2>
          <p className="closed-text">{m.closed}</p>
          <p className="note">{t(lang, "closedNote")}</p>
        </section>
      )}
      {m.amen && (m.amen.nursing || m.amen.toilet || m.amen.diaper || m.amen.stroller) && (
        <section className="amen">
          <h2>{t(lang, "facilities")}</h2>
          <ul>
            {m.amen.nursing && <li>{t(lang, "nursing")}</li>}
            {m.amen.diaper && <li>{t(lang, "diaper")}</li>}
            {m.amen.toilet && <li>{t(lang, "toiletOk")}</li>}
            {m.amen.stroller && <li>{t(lang, "stroller")}</li>}
          </ul>
          <p className="note">{t(lang, "facilitiesNote")}</p>
        </section>
      )}
      <section className="sec">
        <div className="sec-row"><h2>{t(lang, "programs")}</h2></div>
        <EventGrid lang={lang} events={programs} />
      </section>
      <section className="sec">
        <div className="sec-row"><h2>{t(lang, "shows")}</h2></div>
        <EventGrid lang={lang} events={exhibitions} />
      </section>
    </div>
  );
}
