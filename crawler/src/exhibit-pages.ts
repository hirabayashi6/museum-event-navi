// 展覧会ページの選定：探索の結果（discovered.json）から、館ごとに「開催中・予定の展覧会の一覧」らしいページを1つ選び、
// 名簿の「展覧会ページURL」に書く。イベントページとは別に巡回する（展覧会はワークショップのページに載らないことが多いため）
// 使い方: npm run exhibit-pages -- [--dry] [--fetch]
//   --fetch … 探索の結果で見つからない館は、館のトップページを読み直して探す（メニューのリンクも含める）
import fs from "node:fs";
import path from "node:path";
import * as cheerio from "cheerio";
import { politeFetch, mapLimit } from "./lib/http.js";
import { loadMaster, saveMaster, type Row } from "./lib/museums.js";
import { DATA } from "./lib/paths.js";

type Candidate = { url: string; text: string; score: number };
type Discovery = { no: string; candidates: Candidate[] };

const TEXT = /展覧会|企画展|特別展|展示案内|展示情報|展示のご案内|開催中の展示|EXHIBITION/i;
const HREF = /exhibit|tenji|tenran|kikaku|tokubetsu/i;
const PAST = /過去|アーカイブ|これまで|終了|archive|past|backnumber|history|report/i;
const NOW = /開催中|現在|今後|予定|スケジュール|カレンダー|一覧|のご案内|now|current|schedule|calendar|upcoming/i;
// 展覧会1件だけのページ・別の種類のページらしい言葉
const SINGLE = /詳細|「|『|第\d+回|イベントカレンダー|ワークショップ|講座/;

// 全国の展覧会をまとめたサイト（館のサイトではない）。ここを選ぶと別の館の展覧会が付いてしまう
const PORTAL = /(^|\.)(museum\.or\.jp|artscape\.jp|tokyoartbeat\.com|artexhibition\.jp|jalan\.net|walkerplus\.com|iko-yo\.net|enjoytokyo\.jp|jorudan\.co\.jp)$/;
const hostOf = (u: string) => { try { return new URL(u).host.replace(/^www\./, ""); } catch { return ""; } };

const safeDecode = (s: string) => { try { return decodeURIComponent(s); } catch { return s; } };

function score(c: Candidate, eventUrl: string): number | null {
  const u = safeDecode(c.url);
  if (PAST.test(c.text) || PAST.test(u) || SINGLE.test(c.text) || PORTAL.test(hostOf(c.url))) return null;
  if (!TEXT.test(c.text) && !HREF.test(u)) return null;
  let path: string;
  try { path = new URL(c.url).pathname; } catch { return null; }
  const depth = path.split("/").filter(Boolean).length;
  if (depth === 0 && !new URL(c.url).search) return null; // 館のトップページ
  if (c.url.replace(/\/$/, "") === eventUrl.replace(/\/$/, "")) return null; // すでに巡回しているページ
  let s = 0;
  if (TEXT.test(c.text)) s += 3;
  if (HREF.test(u)) s += 2;
  if (NOW.test(c.text) || NOW.test(u)) s += 2;
  if (/\d{3,}|\.html?$/.test(path) && !/index\.html?$/.test(path)) s -= 2; // 個別の記事らしいURL
  if (c.text.length > 18) s -= 2; // 展覧会名そのもののリンク
  s -= Math.max(0, depth - 2);
  return s;
}

function choose(cands: Candidate[], eventUrl: string): string {
  let best: { s: number; url: string } | null = null;
  for (const c of cands) {
    const s = score(c, eventUrl);
    if (s !== null && s >= 3 && (!best || s > best.s)) best = { s, url: c.url };
  }
  return best?.url ?? "";
}

// 館のトップページのリンク（メニューも含める）
async function topLinks(r: Row): Promise<Candidate[]> {
  const res = await politeFetch(r["確認URL"] ?? "");
  if (!res.ok) return [];
  const $ = cheerio.load(res.html);
  const base = new URL(res.url);
  const host = (h: string) => h.replace(/^www\./, "");
  const out: Candidate[] = [];
  $("a[href]").each((_, el) => {
    const text = `${$(el).text()} ${$(el).attr("title") ?? ""} ${$(el).find("img").attr("alt") ?? ""}`.replace(/[\s　]+/g, " ").trim();
    try {
      const u = new URL($(el).attr("href") ?? "", base);
      u.hash = "";
      if (/^https?:$/.test(u.protocol) && host(u.host) === host(base.host) && !/\.(pdf|jpe?g|png)$/i.test(u.pathname)) out.push({ url: u.href, text, score: 0 });
    } catch {
      /* 壊れたリンクは無視 */
    }
  });
  return out;
}

async function main(): Promise<void> {
  const found = JSON.parse(fs.readFileSync(path.join(DATA, "discovery", "discovered.json"), "utf8")) as Record<string, Discovery>;
  const rows = loadMaster();
  const missing: Row[] = [];
  for (const r of rows) {
    const eventUrl = (r["イベントページURL"] ?? "").split(/\s+/)[0] ?? "";
    // 人が入れた値は上書きしない（機械の値だけ入れ直す）
    if (!eventUrl.startsWith("http") || (r["展覧会ページURL"] && !r["展覧会ページURL"].startsWith("http"))) continue;
    r["展覧会ページURL"] = choose(found[r["No."] ?? ""]?.candidates ?? [], eventUrl);
    if (!r["展覧会ページURL"] && (r["確認URL"] ?? "").startsWith("http")) missing.push(r);
  }
  console.log(`探索の結果から選べた館 ${rows.filter((r) => r["展覧会ページURL"]).length}館`);
  if (process.argv.includes("--fetch")) {
    let n = 0;
    await mapLimit(missing, 16, async (r) => {
      r["展覧会ページURL"] = choose(await topLinks(r), (r["イベントページURL"] ?? "").split(/\s+/)[0] ?? "");
      if (++n % 200 === 0) console.log(`  トップページから ${n}/${missing.length}`);
    });
  }
  console.log(`展覧会ページを選べた館 ${rows.filter((r) => r["展覧会ページURL"]).length}館`);
  if (!process.argv.includes("--dry")) saveMaster(rows);
}

await main();
