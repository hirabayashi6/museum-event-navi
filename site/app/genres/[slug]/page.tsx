import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getEvents } from "@/lib/data";
import { applyFilters, parseFilters, toSearch } from "@/lib/filters";
import { GENRES, genreBySlug, genreOf } from "@/lib/genres";
import { EventGrid } from "@/components/EventCard";
import { pageMeta } from "@/lib/seo";
import { getLang, t, genreLabel } from "@/lib/i18n";

export const revalidate = 600;

type Props = { params: Promise<{ slug: string }> };

export function generateStaticParams() {
  return GENRES.map((g) => ({ slug: g.slug }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const g = genreBySlug((await params).slug);
  return g ? pageMeta({ title: `全国の${g.label}のイベント・ワークショップ・展覧会`, description: `全国の${g.label}で開かれるワークショップ、講座、観察会、展覧会。今週末の催しや子ども向けの体験を探せます。`, path: `/genres/${g.slug}` }) : {};
}

// 館のジャンルごとのページ。ミュージアムピックのジャンル色で全体をそろえる
export default async function GenrePage({ params }: Props) {
  const g = genreBySlug((await params).slug);
  if (!g) notFound();
  const [events, lang] = await Promise.all([getEvents(), getLang()]);
  const all = events.filter((e) => genreOf(e.category).slug === g.slug);
  const name = genreLabel(g.slug, g.label, lang);
  const weekend = applyFilters(all, parseFilters({ when: "this-weekend" }));
  const programs = all.filter((e) => e.kind !== "特別展・企画展" && e.kind !== "常設展");
  const shows = all.filter((e) => e.kind === "特別展・企画展" || e.kind === "常設展");
  return (
    <div style={{ "--g": g.color, "--gi": g.ink } as React.CSSProperties}>
      <div className="genre-hero">
        <div>
          <h1>{name}{t(lang, "eventsOf")}</h1>
          <p>{all.length}{t(lang, "count")}（{t(lang, "fromAll")}）</p>
        </div>
        <span className="genre-m" aria-hidden="true" />
      </div>
      <section className="sec" style={{ marginTop: 0 }}>
        <div className="sec-row"><h2>{t(lang, "thisWeekend")}</h2><Link className="more" href={`/events${toSearch({ when: "this-weekend" })}`}>{t(lang, "more")}</Link></div>
        <EventGrid lang={lang} events={weekend.slice(0, 8)} />
      </section>
      <section className="sec">
        <div className="sec-row"><h2>{t(lang, "programs")}</h2></div>
        <EventGrid lang={lang} events={programs.slice(0, 24)} />
      </section>
      <section className="sec">
        <div className="sec-row"><h2>{t(lang, "shows")}</h2></div>
        <EventGrid lang={lang} events={shows.slice(0, 24)} />
      </section>
    </div>
  );
}
