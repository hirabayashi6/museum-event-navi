import type { Metadata } from "next";
import { Suspense } from "react";
import { cookies } from "next/headers";
import Link from "next/link";
import { getEvents } from "@/lib/data";
import { applyFilters, parseFilters, rangeOf, type Query } from "@/lib/filters";
import { PREFS, WANTS, type Want, type Audience } from "@/lib/types";
import { AGE_TO_AUD, type AgeKey } from "@/lib/kids";
import { EventGrid } from "@/components/EventCard";
import { FilterBar } from "@/components/FilterBar";
import { pageMeta } from "@/lib/seo";
import { getLang, t, fmtRange, wantLabel, prefLabel, type Lang, type UIKey } from "@/lib/i18n";

const AGE_OPTS: [AgeKey, UIKey][] = [["baby", "ageBaby"], ["low", "ageLow"], ["high", "ageHigh"]];

export async function generateMetadata({ searchParams }: { searchParams: Promise<Query> }): Promise<Metadata> {
  const q = await searchParams;
  // 絞り込み条件の組み合わせは無数にあるので検索対象外。検索の入口は県別ページ（/area）が担う
  return pageMeta({ title: "全国の博物館の催しをさがす", description: "全国の博物館・美術館・科学館のワークショップ、講座、展覧会を、いつ・どこで・だれと・したいことで探せます。", path: "/events", indexable: Object.keys(q).length === 0 });
}

const WHEN: [string, UIKey][] = [
  ["", "anytime"], ["this-weekend", "thisWeekend"], ["next-weekend", "nextWeekend"], ["春休み", "springBreak"],
  ["GW", "gw"], ["夏休み", "summerBreak"], ["冬休み", "winter"], ["date", "pickDate"],
];
const PER_PAGE = 48;

export default async function EventsPage({ searchParams }: { searchParams: Promise<Query> }) {
  const [q0, lang, jar] = await Promise.all([searchParams, getLang(), cookies()]);
  // 県の指定がなければ、トップで選んだ県（覚えている県）で絞る。全国にしたい人は「全国」を選ぶ
  const remembered = decodeURIComponent(jar.get("navi_pref")?.value ?? "");
  const q: Query = q0.pref === undefined && (PREFS as readonly string[]).includes(remembered) ? { ...q0, pref: remembered } : q0;
  const f = parseFilters(q);
  const page = Math.max(1, Number(Array.isArray(q.page) ? q.page[0] : q.page) || 1);
  const events = applyFilters(await getEvents(), f);
  const range = rangeOf(f);
  const where = f.pref ? prefLabel(f.pref, lang) : t(lang, "allJapan");
  const when = range ? fmtRange(range.from, range.to === range.from ? null : range.to, lang) : t(lang, "upcoming");
  const label = [f.q && `「${f.q}」`, where, when].filter(Boolean).join(lang === "en" ? " · " : "・");

  return (
    <>
      <h1 className="page-title">{label}{t(lang, "eventsOf")}</h1>
      <p className="count">{events.length}{t(lang, "count")}</p>
      {lang !== "ja" && <p className="note">{t(lang, "titleNote")}</p>}
      <FilterBar q={q} lang={lang} />
      <EventGrid lang={lang} events={events.slice((page - 1) * PER_PAGE, page * PER_PAGE)} />
      <Pager total={events.length} page={page} q={q} lang={lang} />
    </>
  );
}

// だれと：やさしい日本語は「かぞくで 行きたい」「友だちと」の2つだけ
function WhoField({ lang, f }: { lang: Lang; f: ReturnType<typeof parseFilters> }) {
  if (lang === "easy")
    return (
      <fieldset>
        <legend>{t(lang, "who")}</legend>
        <label className="opt"><input type="radio" name="with" value="family" defaultChecked={f.with !== "friends"} />{t(lang, "family")}</label>
        <label className="opt"><input type="radio" name="with" value="friends" defaultChecked={f.with === "friends"} />{t(lang, "friends")}</label>
      </fieldset>
    );
  return (
    <fieldset>
      <legend>{t(lang, "childAge")}</legend>
      {AGE_OPTS.map(([k, label]) => <label className="opt" key={k}><input type="checkbox" name="age" value={AGE_TO_AUD[k][0]} defaultChecked={f.ages.includes(AGE_TO_AUD[k][0] as Audience)} />{t(lang, label)}</label>)}
    </fieldset>
  );
}

// ページ送り（48件ずつ）
function Pager({ total, page, q, lang }: { total: number; page: number; q: Query; lang: Lang }) {
  const pages = Math.ceil(total / PER_PAGE);
  if (pages <= 1) return null;
  const href = (n: number) => {
    const p = new URLSearchParams();
    for (const [k, v] of Object.entries(q)) if (k !== "page") for (const x of Array.isArray(v) ? v : v ? [v] : []) p.append(k, x);
    if (n > 1) p.set("page", String(n));
    return `/events${p.toString() ? `?${p}` : ""}`;
  };
  return (
    <nav className="pager" aria-label="pages">
      {page > 1 ? <Link href={href(page - 1)}>‹ {t(lang, "prev")}</Link> : <span />}
      <span>{page} / {pages}</span>
      {page < pages ? <Link href={href(page + 1)}>{t(lang, "next")} ›</Link> : <span />}
    </nav>
  );
}
