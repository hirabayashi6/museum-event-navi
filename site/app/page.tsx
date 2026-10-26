import Link from "next/link";
import { cookies } from "next/headers";
import { getEvents } from "@/lib/data";
import { applyFilters, parseFilters, toSearch } from "@/lib/filters";
import { weekend } from "@/lib/dates";
import { getLang, t, fmtDate, wantLabel, wantLead, prefLabel, type UIKey } from "@/lib/i18n";
import { WANTS, type Want } from "@/lib/types";
import { AGE_TO_AUD, type AgeKey } from "@/lib/kids";
import { genreOf } from "@/lib/genres";
import { EventGrid } from "@/components/EventCard";
import { Banners } from "@/components/Banners";
import { GenreTiles } from "@/components/GenreTiles";
import { RegionPicker } from "@/components/RegionPicker";
import { VoiceList } from "@/components/VoiceList";
import { getVoices } from "@/lib/voices";

const WANT_IMG: Record<Want, string> = {
  つくる: "want-make",
  "観察・体験する": "want-observe",
  聞いて学ぶ: "want-learn",
  見て味わう: "want-exhibition",
  外で体を動かす: "want-outdoor",
};

// 年齢のボタン：キーカラーで色分け（文字色は見本に合わせる）
const AGES: { key: AgeKey; label: UIKey; color: string; ink: string }[] = [
  { key: "baby", label: "ageBaby", color: "#ffa5cd", ink: "#111111" },
  { key: "low", label: "ageLow", color: "#f5dc00", ink: "#111111" },
  { key: "high", label: "ageHigh", color: "#00aaff", ink: "#111111" },
];

const AGE_SECTIONS: { key: AgeKey; title: UIKey; lead: UIKey }[] = [
  { key: "baby", title: "withBaby", lead: "withBabyLead" },
  { key: "low", title: "withLow", lead: "withLowLead" },
  { key: "high", title: "withHigh", lead: "withHighLead" },
];

const HERO_PHOTOS = ["hero-craft", "hero-lawn", "hero-dolphin"];

// 「どこで？」の地方のまとまり
const REGIONS: [UIKey, string[]][] = [
  ["regionHokkaidoTohoku", ["北海道", "青森県", "岩手県", "宮城県", "秋田県", "山形県", "福島県"]],
  ["regionKanto", ["茨城県", "栃木県", "群馬県", "埼玉県", "千葉県", "東京都", "神奈川県"]],
  ["regionChubu", ["新潟県", "富山県", "石川県", "福井県", "山梨県", "長野県", "岐阜県", "静岡県", "愛知県"]],
  ["regionKinki", ["三重県", "滋賀県", "京都府", "大阪府", "兵庫県", "奈良県", "和歌山県"]],
  ["regionChugokuShikoku", ["鳥取県", "島根県", "岡山県", "広島県", "山口県", "徳島県", "香川県", "愛媛県", "高知県"]],
  ["regionKyushu", ["福岡県", "佐賀県", "長崎県", "熊本県", "大分県", "宮崎県", "鹿児島県", "沖縄県"]],
];
// 「いつ？」のボタン（空はいつでも）
const WHEN_BTNS: [string, UIKey][] = [["today", "today"], ["tomorrow", "tomorrow"], ["this-weekend", "thisWeekend"], ["", "anytime"]];

export default async function Home() {
  const [events, jar, lang, voices] = await Promise.all([getEvents(), cookies(), getLang(), getVoices(3)]);
  // 選んだ地域（なければ全国）。地域のイベントが少なければ全国で補う
  const pref = decodeURIComponent(jar.get("navi_pref")?.value ?? "");
  const local = pref ? events.filter((e) => e.pref === pref) : [];
  const scope = pref && applyFilters(local, parseFilters({ when: "this-weekend" })).length >= 4 ? local : events;
  const area = scope === local ? pref : "";
  const wk = weekend(0);
  const thisWeekend = applyFilters(scope, parseFilters({ when: "this-weekend" }));
  // 今週末に始まる参加型 → 今週末に始まる展示 → 前から続いているもの
  const rank = (e: (typeof thisWeekend)[number]) => (e.start_date >= wk.from ? 0 : 2) + (e.kind === "特別展・企画展" || e.kind === "常設展" ? 1 : 0);
  const weekendTop = [...thisWeekend].sort((a, b) => rank(a) - rank(b)).slice(0, 8);
  const byAge = (k: AgeKey) => applyFilters(scope, parseFilters({ age: AGE_TO_AUD[k] })).filter((e) => e.audience.length > 0).slice(0, 4);
  const freeEasy = applyFilters(scope, parseFilters({ free: "1", noreserve: "1" })).slice(0, 4);
  const ending = applyFilters(scope, parseFilters({ when: "ending" }));
  const areaQ = area ? { pref: area } : {};
  // 入口の「いつ？」は、選んだ県で絞る（少なくても、その県を見たい人のため）
  const prefQ = pref ? { pref } : {};
  const prefCount = events.reduce((m, e) => m.set(e.pref, (m.get(e.pref) ?? 0) + 1), new Map<string, number>());

  return (
    <>
      <section className="hero-kids">
        <div className="hero-top">
          <div className="hero-text">
            <h1>{t(lang, "heroTitle")}</h1>
            <p>{t(lang, "heroLead")}</p>
            {lang !== "ja" && <p className="note">{t(lang, "titleNote")}</p>}
          </div>
          {/* 子どもと出かける様子の写真。6秒ごとにゆっくり切り替える（飾りなので読み上げない） */}
          <div className="hero-photos" aria-hidden="true">
            {HERO_PHOTOS.map((src, i) => (
              // eslint-disable-next-line @next/next/no-img-element
              <img key={src} src={`/images/${src}.webp`} alt="" width={1200} height={800} loading={i === 0 ? "eager" : "lazy"} fetchPriority={i === 0 ? "high" : "auto"} style={{ animationDelay: `${i * 6 - 1}s` }} />
            ))}
          </div>
        </div>
        <div className="finder">
          <div className="finder-where">
          <p className="finder-q">{t(lang, "pickWhere")}</p>
          <RegionPicker
            current={pref}
            allLabel={t(lang, "allJapan")}
            allCount={events.length}
            geo={{ pick: t(lang, "geoPick"), busy: t(lang, "geoBusy"), fail: t(lang, "geoFail"), outside: t(lang, "geoOutside") }}
            rows={REGIONS.map(([key, prefs]) => ({
              label: t(lang, key),
              prefs: prefs.map((p) => ({ value: p, text: lang === "ja" ? p.replace(/(都|府|県)$/, "") : prefLabel(p, lang), count: prefCount.get(p) ?? 0 })),
            }))}
          />
          {pref && !area && <p className="note finder-note">{prefLabel(pref, lang)}{t(lang, "fewInArea")}</p>}
          </div>
          <div className="finder-when">
          <p className="finder-q">{pref ? `${prefLabel(pref, lang)}${lang === "en" ? " — " : "で、"}` : ""}{t(lang, "pickWhen")}</p>
          <div className="when-grid">
            {WHEN_BTNS.map(([v, k]) => (
              <Link key={k} href={`/events${toSearch({ ...(v ? { when: v } : {}), ...prefQ })}`} className="when-btn">{t(lang, k)}</Link>
            ))}
          </div>
          <p className="finder-sub">{t(lang, "pickAge")}</p>
          <div className="age-line">
            {AGES.map((a) => (
              <Link key={a.key} href={`/events${toSearch({ when: "this-weekend", age: AGE_TO_AUD[a.key], ...prefQ })}`} className="age-link">
                <span className="age-m" style={{ background: a.color }} aria-hidden="true" />{t(lang, a.label)}
              </Link>
            ))}
          </div>
          </div>
        </div>
      </section>

      <Banners lang={lang} />

      <section className="sec">
        <div className="sec-row">
          <h2>{area ? (lang === "en" ? `${prefLabel(area, lang)}: ` : `${prefLabel(area, lang)}・`) : ""}{t(lang, "kidsWeekend")}<small>{fmtDate(wk.from, lang)}{wk.to !== wk.from ? ` / ${fmtDate(wk.to, lang)}` : ""}</small></h2>
          <Link className="more" href={`/events${toSearch({ when: "this-weekend", ...areaQ })}`}>{thisWeekend.length}{t(lang, "seeAll")}</Link>
        </div>
        <EventGrid lang={lang} events={weekendTop} />
      </section>

      {ending.length > 0 && (
        <section className="sec">
          <div className="sec-row">
            <h2>{area ? (lang === "en" ? `${prefLabel(area, lang)}: ` : `${prefLabel(area, lang)}・`) : ""}{t(lang, "endingSoon")}<small>{t(lang, "endingSoonLead")}</small></h2>
            <Link className="more" href={`/events${toSearch({ when: "ending", ...areaQ })}`}>{ending.length}{t(lang, "seeAll")}</Link>
          </div>
          <EventGrid lang={lang} events={ending.slice(0, 4)} />
        </section>
      )}

      {AGE_SECTIONS.map((s) => (
        <section className="sec" key={s.key}>
          <div className="sec-row">
            <h2>{t(lang, s.title)}<small>{t(lang, s.lead)}</small></h2>
            <Link className="more" href={`/events${toSearch({ age: AGE_TO_AUD[s.key], ...areaQ })}`}>{t(lang, "more")}</Link>
          </div>
          <EventGrid lang={lang} events={byAge(s.key)} />
        </section>
      ))}

      <section className="sec">
        <div className="sec-row">
          <h2>{t(lang, "freeEasy")}<small>{t(lang, "freeEasyLead")}</small></h2>
          <Link className="more" href={`/events${toSearch({ free: "1", noreserve: "1", ...areaQ })}`}>{t(lang, "more")}</Link>
        </div>
        <EventGrid lang={lang} events={freeEasy} />
      </section>

      <section className="sec">
        <div className="sec-row"><h2>{t(lang, "whatDo")}</h2></div>
        <nav className="wants" aria-label={t(lang, "want")}>
          {(Object.keys(WANTS) as Want[]).map((w) => (
            <Link key={w} className="want" href={`/events${toSearch({ want: w, ...areaQ })}`}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img className="art" src={`/images/${WANT_IMG[w]}.webp`} alt="" width={900} height={600} loading="lazy" />
              {wantLabel(w, lang)}<small>{wantLead(w, lang)}</small>
            </Link>
          ))}
        </nav>
      </section>

      <section className="sec">
        <div className="sec-row"><h2>{t(lang, "voices")}</h2><Link href="/voices">{t(lang, "voicesMore")} →</Link></div>
        {voices.length ? <VoiceList voices={voices.slice(0, 3)} lang={lang} /> : <p className="note">{t(lang, "voicesLead")}</p>}
      </section>

      <section className="sec">
        <div className="sec-row"><h2>{t(lang, "whereGo")}</h2></div>
        <GenreTiles lang={lang} counts={events.reduce<Record<string, number>>((acc, e) => { const k = genreOf(e.category).slug; acc[k] = (acc[k] ?? 0) + 1; return acc; }, {})} />
      </section>
    </>
  );
}
