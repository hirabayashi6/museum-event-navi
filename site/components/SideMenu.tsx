import Link from "next/link";
import { WANTS, type Want } from "@/lib/types";
import { GENRES } from "@/lib/genres";
import { toSearch } from "@/lib/filters";
import { AGE_TO_AUD, type AgeKey } from "@/lib/kids";
import { t, wantLabel, genreLabel, BREAK_KEY, type Lang, type UIKey } from "@/lib/i18n";
import { nextBreak } from "@/lib/dates";
import { AreaPicker } from "./AreaPicker";

const AGES: [AgeKey, UIKey][] = [["baby", "ageBaby"], ["low", "ageLow"], ["high", "ageHigh"]];

// 左の入口：どこで（県）→ いつ → 子どもの年齢 → したいこと → 館の種類（大人向けの項目は置かない）
export function SideMenu({ lang, pref }: { lang: Lang; pref: string }) {
  return (
    <nav className="side" aria-label={t(lang, "searchAll")}>
      <p className="side-h">{t(lang, "where")}</p>
      <div className="side-area"><AreaPicker current={pref} label="" allLabel={t(lang, "allJapan")} /></div>
      <p className="side-h">{t(lang, "when")}</p>
      <ul className="side-grid">
        <li><Link href="/events?when=today">{t(lang, "today")}</Link></li>
        <li><Link href="/events?when=tomorrow">{t(lang, "tomorrow")}</Link></li>
        <li><Link href="/events?when=this-weekend">{t(lang, "thisWeekend")}</Link></li>
        <li><Link href="/events?when=next-weekend">{t(lang, "nextWeekend")}</Link></li>
        <li><Link href="/events?when=ending">{t(lang, "endingSoon")}</Link></li>
        <li><Link href={`/events?when=${encodeURIComponent(nextBreak())}`}>{t(lang, BREAK_KEY[nextBreak()])}</Link></li>
        <li><Link href="/events">{t(lang, "anytime")}</Link></li>
      </ul>
      {lang === "easy" ? (
        <>
          <p className="side-h">{t(lang, "who")}</p>
          <ul className="side-list">
            <li><Link href="/events?with=family">{t(lang, "family")}</Link></li>
            <li><Link href="/events?with=friends">{t(lang, "friends")}</Link></li>
          </ul>
        </>
      ) : (
        <>
          <p className="side-h">{t(lang, "childAge")}</p>
          <ul className="side-list">
            {AGES.map(([k, label]) => <li key={k}><Link href={`/events${toSearch({ age: AGE_TO_AUD[k] })}`}>{t(lang, label)}</Link></li>)}
          </ul>
        </>
      )}
      <p className="side-h">{t(lang, "want")}</p>
      <ul className="side-list">
        {(Object.keys(WANTS) as Want[]).map((w) => <li key={w}><Link href={`/events${toSearch({ want: w })}`}>{wantLabel(w, lang)}</Link></li>)}
      </ul>
      <p className="side-h">{t(lang, "whereGo")}</p>
      <ul className={lang === "ja" ? "side-grid" : "side-list"}>
        {GENRES.map((g) => (
          <li key={g.slug}><Link href={`/genres/${g.slug}`}><i className="swatch" style={{ background: g.color }} aria-hidden="true" />{lang === "ja" ? g.label.replace("博物館", "") : genreLabel(g.slug, g.label, lang)}</Link></li>
        ))}
      </ul>
      <ul className="side-foot">
        <li><Link href="/voices">{t(lang, "voices")}</Link></li>
        <li><Link href="/about">{t(lang, "about")}</Link></li>
        <li><Link href="/about#museums">{t(lang, "forMuseums")}</Link></li>
      </ul>
    </nav>
  );
}
