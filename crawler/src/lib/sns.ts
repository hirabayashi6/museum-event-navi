// SNS（Instagram・Facebookページ）の巡回で共通に使う部分
// 本人確認、投稿からの催しの読み取り（無料LLM）、日付の照合、館のイベントファイルへの合流
// 投稿の本文や写真は転載しない。催しの名前・日付などの事実と、元の投稿へのリンクだけを載せる
import fs from "node:fs";
import path from "node:path";
import { z } from "zod";
import type { Row } from "./museums.js";
import { DATA } from "./paths.js";
import { askJson } from "./llm.js";
import { findDates, parseRange, timeOf, toHalfWidth } from "./jpdate.js";
import { kindOf, audienceOf, feeOf, reservationOf } from "./classify.js";
import { idOf, type NaviEvent } from "../structure.js";

export type Platform = "Instagram" | "Facebook";
export type Read = { title: string; start: string | null; end: string | null };
// 投稿を共通の形にしたもの（本文・投稿日時・元の投稿のURL）
export type SnsPost = { no: string; museum: Row; text: string; at: string; url: string };

export const NONE = "なし";
export const RECENT_DAYS = 45; // これより古い投稿は見ない

export const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));
export const load = <T>(f: string, empty: T): T => (fs.existsSync(f) ? (JSON.parse(fs.readFileSync(f, "utf8")) as T) : empty);
export const today = () => new Date().toISOString().slice(0, 10);
export const daysAgo = (iso: string) => (Date.now() - new Date(iso).getTime()) / 86_400_000;
export const host = (u: string) => { try { return new URL(u.startsWith("http") ? u : `https://${u}`).host.replace(/^www\./, "").toLowerCase(); } catch { return ""; } };
export const norm = (s: string) => toHalfWidth(s).replace(/[\s　「」『』【】（）()・、。,.\-ー_|｜]/g, "").toLowerCase();
// 館名から、設置者や法人の言葉を外した「呼び名」
export const core = (name: string) => norm(name).replace(/^(公益|一般)?(財団|社団)法人|^(国立|県立|都立|道立|府立|市立|区立|町立|村立)/, "");

// 同じサイトか。自治体のサイト（city.〇〇 など）は多くの館が同じホストにあるので、最初の階層まで比べる
export function sameSite(a: string, b: string): boolean {
  const ha = host(a), hb = host(b);
  if (!ha || ha !== hb) return false;
  if (!/^(city|town|vill|pref|metro)\.|\.lg\.jp$/.test(ha)) return true;
  const seg = (u: string) => { try { return new URL(u.startsWith("http") ? u : `https://${u}`).pathname.split("/").filter(Boolean)[0] ?? ""; } catch { return ""; } };
  return seg(a) !== "" && seg(a) === seg(b);
}

// 本人のアカウントか：Webサイト欄が公式サイトと同じ、または名前・紹介文に館の呼び名がある
export function isTheMuseum(p: { name?: string; about?: string; website?: string }, r: Row, strict: boolean): boolean {
  if (p.website && p.website.split(/\s+/).some((w) => sameSite(w, r["確認URL"] ?? ""))) return true;
  const text = norm(`${p.name ?? ""} ${p.about ?? ""}`);
  const c = core(r["博物館名"] ?? "");
  if (c.length >= 3 && text.includes(c)) return true;
  if (strict || c.length < 4) return false;
  // 呼び名の2文字の組の8割が名前・紹介文にあれば同じとみなす
  const grams = new Set<string>();
  for (let i = 0; i < c.length - 1; i++) grams.add(c.slice(i, i + 2));
  let hit = 0;
  for (const g of grams) if (text.includes(g)) hit++;
  return hit / grams.size >= 0.8;
}

export const similar = (a: string, b: string) => {
  const x = norm(a), y = norm(b);
  if (!x || !y) return false;
  if (x.includes(y) || y.includes(x)) return true;
  const grams = new Set<string>();
  for (let i = 0; i < x.length - 1; i++) grams.add(x.slice(i, i + 2));
  let hit = 0;
  for (const g of grams) if (y.includes(g)) hit++;
  return grams.size > 0 && hit / grams.size >= 0.6;
};

const Answer = z.object({ results: z.array(z.object({ i: z.number(), title: z.string(), start: z.string().nullable(), end: z.string().nullable() })) });

// 投稿の本文から、催しの名前と開催日を読み取る（無料LLM）。本文は外に出さず、ここで読むだけ
async function ask(platform: Platform, items: SnsPost[]): Promise<Map<number, Read> | "limit"> {
  const prompt = `博物館・美術館の${platform}投稿です。それぞれ、来館者が参加・鑑賞できる「これからある催し（イベント・ワークショップ・展示など）」の告知かを判断してください。
- 告知なら、催しの名前（30字以内、原文の言葉、日付・館名・ハッシュタグ・絵文字は入れない）と、開催日 start / 終了日 end（YYYY-MM-DD。1日だけなら end は null）
- 年が書かれていなければ投稿日から考える。日付が読み取れなければ start は null
- 開館時間のお知らせ・休館・報告・グッズ・求人・終わった催しの振り返りは「${NONE}」
JSONだけを返す: {"results":[{"i":番号,"title":"名前または${NONE}","start":"YYYY-MM-DD"|null,"end":"YYYY-MM-DD"|null}]}

${items.map((x, i) => `${i}: [${x.museum["博物館名"] ?? ""}／投稿日 ${x.at.slice(0, 10)}] ${x.text.replace(/\s+/g, " ").slice(0, 500)}`).join("\n")}`;
  const json = await askJson(prompt);
  if (json === "limit") return "limit";
  const parsed = Answer.safeParse(json);
  const out = new Map<number, Read>();
  if (parsed.success) for (const r of parsed.data.results) out.set(r.i, { title: r.title.trim().slice(0, 40), start: r.start, end: r.end });
  return out;
}

// これから先の日付が書かれた投稿だけを、まだ読んでいなければ読む。結果は投稿のURLごとに cache に残す
export async function readPosts(platform: Platform, posts: SnsPost[], cacheFile: string): Promise<{ future: SnsPost[]; cache: Record<string, Read> }> {
  const cache = load<Record<string, Read>>(cacheFile, {});
  const t = today();
  const future = posts.filter((p) => p.text.split(/\n/).some((l) => findDates(l).some((h) => h.date >= t)));
  const todo = future.filter((p) => !(p.url in cache));
  console.log(`投稿 ${posts.length}件 → 先の日付あり ${future.length}件（新しく読む ${todo.length}件）`);
  if (process.env.LLM_API_KEY) {
    for (let i = 0; i < todo.length; i += 15) {
      const batch = todo.slice(i, i + 15);
      const got = await ask(platform, batch);
      if (got === "limit") { console.log("LLMの無料枠の上限。残りは次回に読みます"); break; }
      batch.forEach((x, k) => { cache[x.url] = got.get(k) ?? { title: NONE, start: null, end: null }; });
      fs.writeFileSync(cacheFile, JSON.stringify(cache));
    }
  }
  return { future, cache };
}

// LLMの日付が本文の日付と合うかを確かめ、合わなければ本文から読み直す（日付の作り話を防ぐ）
function datesOf(read: Read, text: string): { start: string; end: string | null } | null {
  const inText = new Set(text.split(/\n/).flatMap((l) => findDates(l).map((h) => h.date)));
  if (read.start && inText.has(read.start)) return { start: read.start, end: read.end && inText.has(read.end) ? read.end : null };
  const line = text.split(/\n/).find((l) => findDates(l).length && !/投稿|更新|締切|締め切り/.test(l));
  const r = line ? parseRange(line) : null;
  return r ? { start: r.start, end: r.end } : null;
}

// 読み取った催しを館のイベントファイルに足す。公式サイトから取れている同じ催しがあれば、そちらを優先する
export function addEvents(platform: Platform, future: SnsPost[], cache: Record<string, Read>): number {
  const t = today();
  const byNo = new Map<string, NaviEvent[]>();
  for (const p of future) {
    const read = cache[p.url];
    if (!read || read.title === NONE || read.title.length < 3) continue;
    const d = datesOf(read, p.text);
    if (!d || (d.end ?? d.start) < t) continue;
    // 時刻は、開催日が書かれた行から読む（本文の先頭にある別の日付の行を拾わない）
    const lines = p.text.split(/\n/);
    const line = lines.find((l) => findDates(l).some((h) => h.date === d.start)) ?? lines.find((l) => findDates(l).length) ?? "";
    const e: NaviEvent = {
      id: idOf(p.no, read.title, d.start), no: p.no, museum: p.museum["博物館名"] ?? "", pref: p.museum["都道府県"] ?? "", city: p.museum["市町村"] ?? "",
      title: read.title, kind: kindOf(read.title, p.text), start_date: d.start, end_date: d.end, time: timeOf(line),
      audience: audienceOf(p.text), fee: feeOf(p.text), reservation: reservationOf(p.text), place: null,
      capacity: null, deadline: null, apply: null, bring: null, lecturer: null,
      source_url: p.url, method: platform, confidence: 0.7, raw: p.text.replace(/\s+/g, " ").slice(0, 240), extracted_at: new Date().toISOString(),
    };
    byNo.set(p.no, [...(byNo.get(p.no) ?? []), e]);
  }
  let added = 0;
  const evDir = path.join(DATA, "events");
  for (const [no, fresh] of byNo) {
    const f = path.join(evDir, `${no}.json`);
    const old = load<NaviEvent[]>(f, []).filter((e) => (e.end_date ?? e.start_date) >= t);
    const web = old.filter((e) => e.method !== "Instagram" && e.method !== "Facebook");
    const merged = new Map(old.map((e) => [e.id, e]));
    for (const e of fresh) {
      if (web.some((w) => w.start_date === e.start_date && similar(w.title, e.title))) continue;
      if (!merged.has(e.id)) added++;
      merged.set(e.id, e);
    }
    fs.writeFileSync(f, JSON.stringify([...merged.values()], null, 1));
  }
  return added;
}

// Graph API の使用率（%）。8割を超えたら呼び出し側で休む
export function usagePct(res: Response): number {
  const usage = [res.headers.get("x-app-usage"), res.headers.get("x-business-use-case-usage"), res.headers.get("x-page-usage")].filter(Boolean).join(" ");
  return Math.max(0, ...[...usage.matchAll(/"(call_count|total_time|total_cputime)":(\d+)/g)].map((m) => Number(m[2])));
}
