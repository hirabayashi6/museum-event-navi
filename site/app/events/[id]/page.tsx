import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getEvent, getEvents, getMuseum } from "@/lib/data";
import { jaRange, overlaps, weekend } from "@/lib/dates";
import { getLang, t, fmtRange, kindLabel, audLabel, prefLabel, feeLabel } from "@/lib/i18n";
import { EventArt, EventGrid } from "@/components/EventCard";
import { ShareButtons } from "@/components/ShareButtons";
import { pageMeta, breadcrumbLd, JsonLd, SITE_URL, safeUrl } from "@/lib/seo";
import { imageFor } from "@/lib/images";
import type { NaviEvent } from "@/lib/types";

export const revalidate = 600;

type Props = { params: Promise<{ id: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const e = await getEvent((await params).id);
  if (!e) return {};
  const facts = [e.time, e.audience.length ? `対象：${e.audience.join("・")}` : "", e.fee ? `料金：${e.fee}` : "", e.reservation !== "不明" ? `申込${e.reservation}` : ""].filter(Boolean).join("／");
  return pageMeta({
    title: `${e.title}｜${e.museum}（${e.pref}${e.city}）${jaRange(e.start_date, e.end_date)}`,
    description: `${jaRange(e.start_date, e.end_date)}に${e.museum}（${e.pref}${e.city}）で開かれる${e.kind ?? "催し"}。${facts}`.slice(0, 120),
    path: `/events/${e.id}`,
    image: imageFor(e) ?? undefined,
  });
}

// Googleカレンダーに追加するリンク（終日予定として登録）
function gcalUrl(e: NaviEvent, place: string): string {
  const d = (s: string) => s.replaceAll("-", "");
  const endNext = new Date(Date.parse(`${e.end_date ?? e.start_date}T00:00:00Z`) + 86_400_000).toISOString().slice(0, 10);
  const p = new URLSearchParams({ action: "TEMPLATE", text: e.title, dates: `${d(e.start_date)}/${d(endNext)}`, location: place, details: `${e.time ?? ""}\n公式：${e.source_url}` });
  return `https://calendar.google.com/calendar/render?${p.toString()}`;
}


export default async function EventPage({ params }: Props) {
  const e = await getEvent((await params).id);
  if (!e) notFound();
  const [m, all, lang] = await Promise.all([getMuseum(e.no), getEvents(), getLang()]);
  const place = `${e.museum}（${e.pref}${e.city}）`;
  const sameMuseum = all.filter((x) => x.no === e.no && x.id !== e.id).slice(0, 4);
  const wk = weekend(0);
  const nearby = all
    .filter((x) => x.pref === e.pref && x.no !== e.no && overlaps(x.start_date, x.end_date, wk.from, wk.to))
    .slice(0, 4);

  // 項目は「分かっているもの」を先に、分からないものは公式への案内にする
  const facts: [string, string | null][] = [
    [t(lang, "date"), fmtRange(e.start_date, e.end_date, lang)],
    [t(lang, "time"), e.time],
    [t(lang, "venue"), `${e.museum}${e.place ? `　${e.place}` : ""}`],
    [t(lang, "kind"), e.kind ? kindLabel(e.kind, lang) : null],
    [t(lang, "target"), e.audience.length ? e.audience.map((a) => audLabel(a, lang)).join(lang === "en" ? ", " : "・") : null],
    [t(lang, "fee"), e.fee ? feeLabel(e.fee, lang) : null],
    [t(lang, "capacity"), e.capacity ?? null],
    [t(lang, "apply"), e.reservation === "不明" ? null : e.reservation === "必要" ? `${t(lang, "needed")}${e.apply ? `（${e.apply}）` : ""}` : t(lang, "notNeeded")],
    [t(lang, "deadline"), e.deadline ?? null],
    [t(lang, "bring"), e.bring ?? null],
    [t(lang, "lecturer"), e.lecturer ?? null],
  ];

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Event",
    name: e.title,
    startDate: e.start_date,
    endDate: e.end_date ?? e.start_date,
    eventAttendanceMode: "https://schema.org/OfflineEventAttendanceMode",
    eventStatus: "https://schema.org/EventScheduled",
    location: { "@type": "Place", name: e.museum, address: { "@type": "PostalAddress", addressRegion: e.pref, addressLocality: e.city, addressCountry: "JP" } },
    organizer: { "@type": "Organization", name: e.museum, url: safeUrl(m?.url) ?? safeUrl(e.source_url) ?? undefined },
    url: safeUrl(e.source_url) ?? undefined,
    image: imageFor(e) ? [`${SITE_URL}${imageFor(e)}`] : undefined,
    description: `${e.museum}で開かれる${e.kind ?? "催し"}`,
    ...(e.fee === "無料" ? { isAccessibleForFree: true } : {}),
  };

  return (
    <>
      <p className="crumb"><Link href="/">{t(lang, "top")}</Link> ／ <Link href={`/area/${encodeURIComponent(e.pref)}`}>{prefLabel(e.pref, lang)}</Link> ／ <Link href={`/museums/${e.no}`}>{e.museum}</Link></p>
      <div className="detail">
        <article>
          <div className="detail-art"><EventArt e={e} /></div>
          <p className="card-kind">{kindLabel(e.kind, lang)}</p>
          <h1>{e.title}</h1>
          <dl className="facts">
            {facts.filter(([, v]) => v).map(([k, v]) => (<div key={k} className="fact"><dt>{k}</dt><dd>{v}</dd></div>))}
          </dl>
          {facts.some(([, v]) => !v) && (
            <p className="note">
              {facts.filter(([, v]) => !v).map(([k]) => k).join(lang === "en" ? ", " : "・")}{t(lang, "missingNote")}
            </p>
          )}
          <p className="note">{e.method === "Instagram" || e.method === "Facebook" ? t(lang, "snsNote") : `${e.museum}${t(lang, "autoNote")}`}</p>
          {lang !== "ja" && <p className="note">{t(lang, "titleNote")}</p>}
          <JsonLd data={jsonLd} />
          <JsonLd data={breadcrumbLd([{ name: "トップ", path: "/" }, { name: e.pref, path: `/area/${encodeURIComponent(e.pref)}` }, { name: e.museum, path: `/museums/${e.no}` }, { name: e.title, path: `/events/${e.id}` }])} />
        </article>
        <aside className="aside">
          {safeUrl(e.source_url) ? <a className="btn" href={safeUrl(e.source_url) ?? undefined} target="_blank" rel="noopener noreferrer">{t(lang, e.method === "Instagram" ? "officialInstagram" : e.method === "Facebook" ? "officialFacebook" : "official")}</a> : <a className="btn" href={safeUrl(m?.url) ?? "#"} target="_blank" rel="noopener noreferrer">{t(lang, "museumSite")}</a>}
          <a className="btn btn-line" href={gcalUrl(e, place)} target="_blank" rel="noopener noreferrer">{t(lang, "calendar")}</a>
          <a className="btn btn-line" href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${e.museum} ${e.pref}${e.city}`)}`} target="_blank" rel="noopener noreferrer">{t(lang, "map")}</a>
          <ShareButtons title={`${e.title}（${e.museum}）`} lineLabel={t(lang, "line")} shareLabel={t(lang, "share")} copiedLabel={t(lang, "copied")} />
          <p className="note">{t(lang, "checkin")}</p>
          <p className="note"><Link href="/about#fix">{t(lang, "fixNote")}</Link></p>
        </aside>
      </div>

      {sameMuseum.length > 0 && (
        <section className="sec">
          <div className="sec-row"><h2>{e.museum}{t(lang, "sameMuseum")}</h2><Link className="more" href={`/museums/${e.no}`}>{t(lang, "museumPage")}</Link></div>
          <EventGrid lang={lang} events={sameMuseum} />
        </section>
      )}
      {nearby.length > 0 && (
        <section className="sec">
          <div className="sec-row"><h2>{t(lang, "nearby")}</h2><Link className="more" href={`/events?when=this-weekend&pref=${encodeURIComponent(e.pref)}`}>{t(lang, "more")}</Link></div>
          <EventGrid lang={lang} events={nearby} />
        </section>
      )}
    </>
  );
}
