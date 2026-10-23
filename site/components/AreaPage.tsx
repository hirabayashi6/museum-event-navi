import Link from "next/link";
import { applyFilters, parseFilters, toSearch } from "@/lib/filters";
import { weekend, jaDate } from "@/lib/dates";
import { WANTS, type NaviEvent, type Want } from "@/lib/types";
import { GENRES, genreOf } from "@/lib/genres";
import { WANT_SLUGS } from "@/lib/areas";
import { EventGrid } from "./EventCard";
import { breadcrumbLd, JsonLd, SITE_URL } from "@/lib/seo";
import { t, wantLabel, genreLabel, prefLabel, type Lang } from "@/lib/i18n";

// 検索から来る人のための入口：「宮崎県 博物館 イベント 今週末」「宮崎県 ワークショップ 子ども」など
export function AreaPage({ pref, want, events, lang }: { pref: string; want?: Want; events: NaviEvent[]; lang: Lang }) {
  const wk = weekend(0);
  const base = events.filter((e) => e.pref === pref);
  const scoped = want ? applyFilters(base, parseFilters({ want })) : base;
  const thisWeekend = applyFilters(scoped, parseFilters({ when: "this-weekend" }));
  const nextWeekend = applyFilters(scoped, parseFilters({ when: "next-weekend" }));
  const later = scoped.filter((e) => !thisWeekend.includes(e) && !nextWeekend.includes(e));
  const free = scoped.filter((e) => e.fee === "無料").length;
  const kids = scoped.filter((e) => e.audience.some((a) => a === "未就学" || a.startsWith("小学生") || a === "親子")).length;
  const museums = [...new Map(scoped.map((e) => [e.no, e])).values()];
  const P = prefLabel(pref, lang);
  const label = lang === "ja" ? (want ? `${pref}で「${want}」博物館の催し` : `${pref}の博物館イベント・ワークショップ`) : lang === "en" ? `Museum events in ${P}${want ? ` — ${wantLabel(want, lang)}` : ""}` : `${P}の はくぶつかんの イベント${want ? `（${wantLabel(want, lang)}）` : ""}`;
  const path = `/area/${encodeURIComponent(pref)}${want ? `/${WANT_SLUGS[want]}` : ""}`;
  return (
    <>
      <JsonLd data={breadcrumbLd([{ name: "トップ", path: "/" }, { name: pref, path: `/area/${encodeURIComponent(pref)}` }, ...(want ? [{ name: want, path }] : [])])} />
      <JsonLd data={{ "@context": "https://schema.org", "@type": "ItemList", name: label, itemListElement: scoped.slice(0, 30).map((e, i) => ({ "@type": "ListItem", position: i + 1, url: `${SITE_URL}/events/${e.id}`, name: e.title })) }} />
      <p className="crumb"><Link href="/">{t(lang, "top")}</Link> ／ {want ? <><Link href={`/area/${encodeURIComponent(pref)}`}>{P}</Link> ／ {wantLabel(want, lang)}</> : P}</p>
      <h1 className="page-title">{label}</h1>
      {lang === "ja" && <p className="area-lead">
        {pref}の博物館・美術館・科学館などで開かれる{want ? `「${want}」催し` : "ワークショップや講座、展覧会"}を{scoped.length}件掲載しています。
        {scoped.length > 0 && <>そのうち今週末（{jaDate(wk.from)}・{jaDate(wk.to)}）は{thisWeekend.length}件、無料は{free}件、子ども向けは{kids}件です。</>}
        各館の公式サイトの情報をもとに毎週更新しています。
      </p>}
      {lang !== "ja" && <p className="area-lead">{scoped.length}{t(lang, "count")}／{t(lang, "titleNote")}</p>}

      {!want && (
        <nav className="area-wants" aria-label="したいこと">
          {(Object.keys(WANTS) as Want[]).map((w) => {
            const n = applyFilters(base, parseFilters({ want: w })).length;
            return n ? <Link key={w} href={`/area/${encodeURIComponent(pref)}/${WANT_SLUGS[w]}`}>{wantLabel(w, lang)}<span>{n}</span></Link> : null;
          })}
        </nav>
      )}

      <section className="sec">
        <div className="sec-row"><h2>{t(lang, "thisWeekend")}</h2><Link className="more" href={`/events${toSearch({ when: "this-weekend", pref, want: want ?? "" })}`}>{t(lang, "changeFilters")}</Link></div>
        <EventGrid lang={lang} events={thisWeekend.slice(0, 12)} />
      </section>
      {nextWeekend.length > 0 && (
        <section className="sec"><div className="sec-row"><h2>{t(lang, "nextWeekend")}</h2></div><EventGrid lang={lang} events={nextWeekend.slice(0, 8)} /></section>
      )}
      {later.length > 0 && (
        <section className="sec"><div className="sec-row"><h2>{t(lang, "upcoming")}</h2></div><EventGrid lang={lang} events={later.slice(0, 24)} /></section>
      )}
      {museums.length > 0 && (
        <section className="sec">
          <div className="sec-row"><h2>{t(lang, "numsMuseums")}</h2></div>
          <ul className="area-museums">
            {museums.map((e) => {
              const g = genreOf(e.category);
              return <li key={e.no}><Link href={`/museums/${e.no}`}><i className="swatch" style={{ background: g.color }} aria-hidden="true" />{e.museum}<small>{e.city}</small></Link></li>;
            })}
          </ul>
        </section>
      )}
      <section className="sec">
        <div className="sec-row"><h2>{t(lang, "genresTitle")}</h2></div>
        <ul className="area-museums">
          {GENRES.map((g) => <li key={g.slug}><Link href={`/genres/${g.slug}`}><i className="swatch" style={{ background: g.color }} aria-hidden="true" />{genreLabel(g.slug, g.label, lang)}</Link></li>)}
        </ul>
      </section>
    </>
  );
}
