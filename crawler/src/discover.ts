// 段階1 探索：各館の登録URLから、イベントページ候補とSNSアカウントを見つけてマスタに書く
// 使い方: npm run discover -- --pref 宮崎県 [--limit 50] [--concurrency 8] [--force]
import fs from "node:fs";
import path from "node:path";
import * as cheerio from "cheerio";
import { politeFetch, robotsState, mapLimit } from "./lib/http.js";
import { loadMaster, saveMaster, isCrawlable, argValue, readCsv, type Row } from "./lib/museums.js";
import { DATA, MIYAZAKI_CSV } from "./lib/paths.js";

type Candidate = { url: string; text: string; score: number };
type Discovery = {
  no: string;
  fetchedUrl: string;
  status: "候補あり" | "登録ページを監視" | "候補なし" | "取得失敗" | "robots禁止";
  detail: string;
  robots: string;
  candidates: Candidate[];
  instagram: string[];
  x: string[];
  facebook: string[];
  checkedAt: string;
};

const OUT = path.join(DATA, "discovery", "discovered.json");

// リンク文字列の語ごとの重み。参加型プログラムを優先する
const TEXT_WORDS: [RegExp, number][] = [
  [/ワークショップ|体験教室|講座|教室|観察会|ギャラリートーク|講演会/, 6],
  [/イベント|催し|催事|行事|プログラム/, 5],
  [/スケジュール|カレンダー|予定/, 4],
  [/企画展|特別展|展覧会|展示案内/, 3],
  [/お知らせ|新着|ニュース|トピックス|information|news/i, 1],
];
const HREF_WORDS: [RegExp, number][] = [
  [/event|workshop|kouza|koza|schedule|calendar|program/i, 3],
  [/exhibition|tenji/i, 2],
  [/news|info|topics/i, 1],
];
const NOISE = /アクセス|交通|料金|利用案内|採用|入札|プライバシー|サイトマップ|English|お問い合わせ|ログイン|pdf$/i;

function safeDecode(s: string): string {
  try { return decodeURIComponent(s); } catch { return s; }
}

function sameSite(a: URL, b: URL): boolean {
  const base = (h: string) => h.replace(/^www\./, "");
  return base(a.host) === base(b.host);
}

function snsHandle(href: string): { kind: "instagram" | "x" | "facebook"; url: string } | null {
  let u: URL;
  try { u = new URL(href); } catch { return null; }
  const host = u.host.replace(/^www\.|^m\./, "");
  const first = u.pathname.split("/").filter(Boolean)[0] ?? "";
  if (!first || /^(share|sharer|intent|home|explore|p|reel|hashtag|dialog|plugins|tr)(\.php)?$/i.test(first)) return null;
  if (host === "instagram.com") return { kind: "instagram", url: `https://www.instagram.com/${first}/` };
  if (host === "x.com" || host === "twitter.com") return { kind: "x", url: `https://x.com/${first}` };
  if (host === "facebook.com") {
    const id = first === "profile.php" ? `profile.php?id=${u.searchParams.get("id") ?? ""}` : first;
    return { kind: "facebook", url: `https://www.facebook.com/${id}` };
  }
  return null;
}

function analyse(html: string, pageUrl: string) {
  const $ = cheerio.load(html);
  const base = new URL(pageUrl);
  const cands = new Map<string, Candidate>();
  const sns = { instagram: new Set<string>(), x: new Set<string>(), facebook: new Set<string>() };
  $("a[href]").each((_, el) => {
    const raw = $(el).attr("href") ?? "";
    let abs: URL;
    try { abs = new URL(raw, base); } catch { return; }
    const s = snsHandle(abs.href);
    if (s) { sns[s.kind].add(s.url); return; }
    if (!/^https?:$/.test(abs.protocol) || !sameSite(abs, base)) return;
    const text = ($(el).text() || $(el).attr("title") || $(el).find("img").attr("alt") || "").replace(/\s+/g, " ").trim();
    if (text.length > 40 || NOISE.test(text) || NOISE.test(abs.pathname)) return;
    let score = 0;
    for (const [re, w] of TEXT_WORDS) if (re.test(text)) score += w;
    // 画像だけのリンクなど文字がない場合は URL だけで判定する
    for (const [re, w] of HREF_WORDS) if (re.test(safeDecode(abs.pathname))) score += w;
    if (score < 3) return;
    abs.hash = "";
    const prev = cands.get(abs.href);
    if (!prev || prev.score < score) cands.set(abs.href, { url: abs.href, text, score });
  });
  const candidates = [...cands.values()].sort((a, b) => b.score - a.score).slice(0, 5);
  return { candidates, instagram: [...sns.instagram], x: [...sns.x], facebook: [...sns.facebook] };
}

async function discover(r: Row): Promise<Discovery> {
  const no = r["No."] ?? "";
  const url = r["確認URL"] ?? "";
  const now = new Date().toISOString();
  const robots = await robotsState(url).catch(() => "不明");
  const empty = { candidates: [], instagram: [], x: [], facebook: [] };
  let res = await politeFetch(url);
  if (!res.ok) {
    const status = res.reason === "robots" ? "robots禁止" : "取得失敗";
    return { no, fetchedUrl: url, status, detail: res.detail, robots, ...empty, checkedAt: now };
  }
  let found = analyse(res.html, res.url);
  // 館や親組織のサイトでサブページが登録されている場合は、トップページも見る
  const origin = new URL(res.url).origin + "/";
  const ownOrParent = ["独自サイト", "公式HP", "民間サイト内ページ"].includes(r["URL種別"] ?? "");
  if (found.candidates.length === 0 && ownOrParent && res.url !== origin) {
    const top = await politeFetch(origin);
    if (top.ok) {
      const more = analyse(top.html, top.url);
      found = {
        candidates: more.candidates,
        instagram: [...new Set([...found.instagram, ...more.instagram])],
        x: [...new Set([...found.x, ...more.x])],
        facebook: [...new Set([...found.facebook, ...more.facebook])],
      };
      res = top;
    }
  }
  // 自治体などの大きなサイト内の館ページは、そのページ自体の更新を監視する
  const hostSite = ["自治体サイト内ページ", "大学サイト内ページ", "行政サイト"].includes(r["URL種別"] ?? "");
  if (!found.candidates.length && hostSite) {
    found.candidates = [{ url: res.url, text: "（登録ページ）", score: 0 }];
    return { no, fetchedUrl: res.url, status: "登録ページを監視", detail: "", robots, ...found, checkedAt: now };
  }
  const status = found.candidates.length ? "候補あり" : "候補なし";
  return { no, fetchedUrl: res.url, status, detail: "", robots, ...found, checkedAt: now };
}

function loadDone(): Record<string, Discovery> {
  return fs.existsSync(OUT) ? (JSON.parse(fs.readFileSync(OUT, "utf8")) as Record<string, Discovery>) : {};
}

function writeDone(done: Record<string, Discovery>): void {
  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  fs.writeFileSync(`${OUT}.tmp`, JSON.stringify(done, null, 1));
  fs.renameSync(`${OUT}.tmp`, OUT);
}

// 自治体・民間サイト内ページのSNSは、館ではなくサイト運営者のアカウントのことが多い
function confidence(r: Row): string {
  return ["独自サイト", "公式HP"].includes(r["URL種別"] ?? "") ? "機械（館サイト）" : "機械（親サイト・要確認）";
}

function applyToMaster(rows: Row[], done: Record<string, Discovery>): void {
  // 宮崎は人が確認した棚卸しを優先する
  const human = new Map(fs.existsSync(MIYAZAKI_CSV) ? readCsv(MIYAZAKI_CSV).map((h) => [h["No."] ?? "", h]) : []);
  const pick = (v: string | undefined) => (v && v.startsWith("http") ? v : "");
  for (const r of rows) {
    const no = r["No."] ?? "";
    const h = human.get(no);
    if (h) {
      r["イベントページURL"] ||= pick(h["イベントページURL"]);
      r["Instagram"] ||= pick(h["Instagram"]?.split(/[（ ]/)[0]);
      r["X"] ||= pick(h["X"]?.split(/[（ ]/)[0]);
      r["Facebook"] ||= pick(h["Facebook"]?.split(/[（ ]/)[0]);
      r["情報の確度"] ||= "人が確認（10/21棚卸し）";
    }
    const d = done[no];
    if (!d) continue;
    if (r["情報の確度"]?.startsWith("人")) { r["監視状態"] = d.status; continue; }
    r["イベントページURL"] ||= d.candidates[0]?.url ?? "";
    r["Instagram"] ||= d.instagram.join(" ");
    r["X"] ||= d.x.join(" ");
    r["Facebook"] ||= d.facebook.join(" ");
    r["巡回可否(robots/規約)"] ||= d.robots;
    r["監視状態"] = d.status;
    r["情報の確度"] ||= confidence(r);
  }
}

async function main(): Promise<void> {
  const pref = argValue("pref");
  const limit = Number(argValue("limit") ?? "0");
  const conc = Number(argValue("concurrency") ?? "8");
  const force = process.argv.includes("--force");
  const rows = loadMaster();
  const done = loadDone();
  let targets = rows.filter((r) => isCrawlable(r) && (!pref || r["都道府県"] === pref) && (force || !done[r["No."] ?? ""]));
  if (limit) targets = targets.slice(0, limit);
  console.log(`探索対象 ${targets.length}館（完了済み ${Object.keys(done).length}館）`);
  let n = 0;
  await mapLimit(targets, conc, async (r) => {
    // 1館の想定外エラーで全体を止めない
    const d = await discover(r).catch((e: unknown): Discovery => ({
      no: r["No."] ?? "", fetchedUrl: r["確認URL"] ?? "", status: "取得失敗",
      detail: `処理エラー: ${e instanceof Error ? e.message : String(e)}`, robots: "不明",
      candidates: [], instagram: [], x: [], facebook: [], checkedAt: new Date().toISOString(),
    }));
    done[d.no] = d;
    if (++n % 25 === 0) { writeDone(done); console.log(`  ${n}/${targets.length}`); }
  });
  writeDone(done);
  applyToMaster(rows, done);
  saveMaster(rows);
  const scope = Object.values(done).filter((d) => targets.some((t) => t["No."] === d.no));
  const count = (s: string) => scope.filter((d) => d.status === s).length;
  console.log(`完了: 候補あり ${count("候補あり")} / 候補なし ${count("候補なし")} / 取得失敗 ${count("取得失敗")} / robots禁止 ${count("robots禁止")}`);
  console.log(`Instagramあり ${scope.filter((d) => d.instagram.length).length}館`);
}

await main();
