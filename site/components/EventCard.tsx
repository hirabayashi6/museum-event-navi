import Link from "next/link";
import type { NaviEvent } from "@/lib/types";
import { todayJst } from "@/lib/dates";
import { t, fmtDate, weekdayOf, kindLabel, audLabel, prefLabel, genreLabel, feeLabel, type Lang } from "@/lib/i18n";
import { imageFor } from "@/lib/images";
import { genreOf } from "@/lib/genres";
import { KindArt } from "./KindArt";
import { ageBadge } from "@/lib/kids";

// 何歳から行けるかを、色の面の右上に大きく出す
const BADGE = { baby: "badgeBaby", school: "badgeSchool", family: "badgeFamily", all: "badgeAll" } as const;
function who(e: NaviEvent, lang: Lang): { main: string; sub: string } {
  const b = ageBadge(e);
  const main = b ? t(lang, BADGE[b]) : "";
  const sub = lang === "easy" ? "" : e.audience.filter((a) => a !== "大人").map((a) => audLabel(a, lang)).join(lang === "en" ? ", " : "・");
  return { main, sub: sub && sub !== main ? sub : "" };
}

function dateBadge(e: NaviEvent, today: string, lang: Lang): { big: string; small: string } {
  const short = (iso: string) => fmtDate(iso, lang).replace(/（.）| \(.+\)/, "");
  if (e.start_date < today) return { big: t(lang, "ongoing"), small: e.end_date ? (lang === "en" ? `${t(lang, "until")}${short(e.end_date)}` : `${short(e.end_date)}${t(lang, "until")}`) : "" };
  const [, m, d] = e.start_date.split("-");
  const w = weekdayOf(e.start_date, lang);
  return { big: `${Number(m)}.${Number(d)}`, small: e.end_date && e.end_date !== e.start_date ? `${w}〜${short(e.end_date)}` : w };
}

export function EventArt({ e }: { e: NaviEvent }) {
  const img = imageFor(e);
  // eslint-disable-next-line @next/next/no-img-element
  return img ? <img className="art" src={img} alt="" loading="lazy" width={1200} height={800} /> : <KindArt kind={e.kind} seed={e.id} />;
}

// ミュージアムピックのSNSカードにならい、館のジャンルの色の面に日付とMマークの窓を置く
export function EventCard({ e, lang }: { e: NaviEvent; lang: Lang }) {
  const b = dateBadge(e, todayJst(), lang);
  const w = who(e, lang);
  const g = genreOf(e.category);
  return (
    <li className="card" style={{ "--g": g.color, "--gi": g.ink } as React.CSSProperties}>
      <Link href={`/events/${e.id}`} className="card-link">
        <div className="card-panel">
          <div className="card-head">
            <p className="card-date"><b>{b.big}</b>{b.small && <small>{b.small}</small>}</p>
            <p className="card-who">{w.main && <b className="card-age">{w.main}</b>}{w.sub && <small>{w.sub}</small>}</p>
          </div>
          <div className="mwin"><EventArt e={e} /></div>
        </div>
        <h3 className="card-title">{e.title}</h3>
        <p className="card-place">{e.museum}<span>{lang === "ja" ? `${e.pref}${e.city}` : prefLabel(e.pref, lang)}</span><span className="card-genre"><i className="swatch" style={{ background: g.color }} aria-hidden="true" />{genreLabel(g.slug, g.label, lang)}</span></p>
        <p className="card-meta">
          <span className="k">{kindLabel(e.kind, lang)}</span>
          {e.time && <span>{e.time.replace(/～$/, "〜")}</span>}
          {e.fee && <span>{feeLabel(e.fee, lang)}</span>}
          {e.reservation === "不要" && <span>{t(lang, "noReserve")}</span>}
          {e.reservation === "必要" && <span className="need">{t(lang, "needReserve")}</span>}
        </p>
      </Link>
    </li>
  );
}

export function EventGrid({ events, lang, empty }: { events: NaviEvent[]; lang: Lang; empty?: string }) {
  if (!events.length) return <p className="empty">{lang === "ja" && empty ? empty : t(lang, "notFound")}</p>;
  return <ul className="grid">{events.map((e) => <EventCard key={e.id} e={e} lang={lang} />)}</ul>;
}
