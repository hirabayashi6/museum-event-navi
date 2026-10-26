// 一覧の絞り込み。URL の検索条件（?kind=..&age=..&when=..&pref=..）をそのまま使う
import { AUDIENCES, DEFAULT_KINDS, KINDS, WANTS, type Audience, type Kind, type NaviEvent, type Want } from "./types";
import { overlaps, seasonRange, todayJst, weekend, nextWeekendRange, dayRange, addDays, SEASONS, type Season } from "./dates";
import { AGE_TO_AUD, type AgeKey } from "./kids";

export type Query = Record<string, string | string[] | undefined>;

export type Filters = {
  kinds: Kind[];
  want: Want | null;
  ages: Audience[];
  when: string;
  date: string;
  pref: string;
  free: boolean;
  noReserve: boolean;
  q: string;
  baby: boolean;
  toilet: boolean;
  // やさしい日本語の「だれと」：family＝すべて、friends＝家族向け（親子）を除くすべて
  with: "" | "family" | "friends";
};

const list = (v: string | string[] | undefined): string[] => (Array.isArray(v) ? v : v ? [v] : []);

export function parseFilters(q: Query): Filters {
  const kinds = list(q.kind).filter((k): k is Kind => (KINDS as readonly string[]).includes(k));
  const wantRaw = list(q.want)[0] ?? "";
  return {
    kinds: kinds.length ? kinds : DEFAULT_KINDS,
    want: wantRaw in WANTS ? (wantRaw as Want) : null,
    // 年齢ボタン（kid=baby|low|high）は対象の組み合わせに直す
    ages: (list(q.kid)[0] ?? "") in AGE_TO_AUD ? [...AGE_TO_AUD[list(q.kid)[0] as AgeKey]] : list(q.age).filter((a): a is Audience => (AUDIENCES as readonly string[]).includes(a)),
    when: list(q.when)[0] ?? "",
    date: list(q.date)[0] ?? "",
    pref: list(q.pref)[0] ?? "",
    free: list(q.free)[0] === "1",
    noReserve: list(q.noreserve)[0] === "1",
    q: (list(q.q)[0] ?? "").trim(),
    baby: list(q.baby)[0] === "1",
    toilet: list(q.toilet)[0] === "1",
    with: list(q.with)[0] === "friends" ? "friends" : list(q.with)[0] === "family" ? "family" : "",
  };
}

export function rangeOf(f: Filters): { from: string; to: string } | null {
  if (f.when === "today") return dayRange(0);
  if (f.when === "tomorrow") return dayRange(1);
  if (f.when === "this-weekend") return weekend(0);
  if (f.when === "next-weekend") return nextWeekendRange();
  if (f.when in SEASONS) return seasonRange(f.when as Season);
  if (f.when === "date" && /^\d{4}-\d{2}-\d{2}$/.test(f.date)) return { from: f.date, to: f.date };
  return null;
}

// もうすぐ終わる：開催中で、今日から14日以内に終わるもの
export const ENDING_DAYS = 14;
export const isEnding = (e: NaviEvent, today = todayJst()): boolean =>
  Boolean(e.end_date && e.start_date <= today && e.end_date >= today && e.end_date <= addDays(today, ENDING_DAYS));

export function applyFilters(events: NaviEvent[], f: Filters): NaviEvent[] {
  const range = rangeOf(f);
  const today = todayJst();
  const wantKinds: readonly Kind[] | null = f.want ? WANTS[f.want] : null;
  return events.filter((e) => {
    // 種類が判定できなかった催しは、種類の絞り込みでは落とさない
    if (e.kind && !f.kinds.includes(e.kind)) return false;
    if (wantKinds && (!e.kind || !wantKinds.includes(e.kind))) return false;
    if (f.ages.length && e.audience.length && !e.audience.some((a) => f.ages.includes(a))) return false;
    if (f.pref && e.pref !== f.pref) return false;
    if (f.free && e.fee !== "無料") return false;
    if (f.noReserve && e.reservation !== "不要") return false;
    if (range && !overlaps(e.start_date, e.end_date, range.from, range.to)) return false;
    if (f.when === "ending" && !isEnding(e, today)) return false;
    // キーワードは題名・館名・市町村のどれかに含まれれば
    // 赤ちゃん連れ：授乳室かおむつ替えのある館。多目的トイレのある館
    if (f.baby && !(e.amen?.nursing || e.amen?.diaper)) return false;
    if (f.toilet && !e.amen?.toilet) return false;
    if (f.with === "friends" && e.audience.includes("親子")) return false;
    if (f.q && !`${e.title} ${e.museum} ${e.pref}${e.city}`.includes(f.q)) return false;
    return true;
  }).sort((a, b) => (f.when === "ending" ? (a.end_date ?? "").localeCompare(b.end_date ?? "") : 0));
}

export function toSearch(f: Partial<Record<string, string | string[]>>): string {
  const p = new URLSearchParams();
  for (const [k, v] of Object.entries(f)) for (const x of list(v)) if (x) p.append(k, x);
  const s = p.toString();
  return s ? `?${s}` : "";
}

export { todayJst };
