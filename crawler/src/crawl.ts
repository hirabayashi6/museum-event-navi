// 段階2 巡回：イベントページと展覧会ページを取得し、前回から増えた行だけを「変更」として書き出す
// 記録（state・snapshots）はページごと（イベントページは No、展覧会ページは No-ex）。変更は館（No）にまとめる
// 使い方: npm run crawl -- [--pref 宮崎県] [--concurrency 8] [--force] [--only-exhibit] [--min-no 5001] [--no 5221]
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { politeFetch, mapLimit } from "./lib/http.js";
import { loadMaster, argValue, type Row } from "./lib/museums.js";
import { pageLines, pageLinks, pageHeading, ldEventLines } from "./lib/text.js";
import { kindOf } from "./lib/classify.js";
import { findDates } from "./lib/jpdate.js";
import { DATA } from "./lib/paths.js";
import { z } from "zod";

type State = { url: string; hash: string; lastFetched: string; lastChanged: string; status: string; detail: string };
export type Change = { no: string; name: string; pref: string; city: string; url: string; first: boolean; added: string };

const DIR = path.join(DATA, "crawl");
const STATE = path.join(DIR, "state.json");
const SNAP = path.join(DIR, "snapshots");
const MAX_CHARS = 40000; // 構造化側で分割して送る
const MAX_DETAILS = 30; // 1館1回あたりに読みに行く詳細ページの上限
const DETAIL_CHARS = 6000; // 詳細だと思ったら一覧だったページも読めるよう、長めに取る
// 催しの詳細へのリンクらしい行（題名に催しの言葉があるか、日付が近くにある）
const EVENT_WORDS = /ワークショップ|体験|教室|講座|講演|観察|展|ツアー|トーク|コンサート|上映|おはなし|読み聞かせ|まつり|祭|フェス|イベント|ショー|セミナー|見学|作ろう|つくろう|募集/;
// ページ共通の見出し（催しの名前ではない）。詳細ページの見出しがこれなら、一覧のリンクの文字を題名にする
const GENERIC_HEADING = /(イベント|催し|行事|講座)(情報|一覧|カレンダー|案内|のご案内)|新着情報|お知らせ|トピックス|ニュース|^(HOME|ホーム|トップ)|[>＞›»]/;
const NAV_LIKE = /^(HOME|ホーム|トップ|一覧|もっと見る|詳細|詳しく|こちら|次へ|前へ|戻る|ページ|お知らせ一覧|イベント一覧|.{0,2}\d+.{0,2})$/;

const readJson = <T>(f: string, fallback: T): T => (fs.existsSync(f) ? (JSON.parse(fs.readFileSync(f, "utf8")) as T) : fallback);

const TribeSchema = z.object({
  events: z.array(z.object({ title: z.string(), start_date: z.string(), end_date: z.string(), url: z.string(), cost: z.string().optional() })),
});

async function tribeLines(pageUrl: string): Promise<string[]> {
  const today = new Date().toISOString().slice(0, 10);
  const api = `${new URL(pageUrl).origin}/wp-json/tribe/events/v1/events?per_page=50&start_date=${today}`;
  const res = await politeFetch(api, { json: true });
  if (!res.ok) return [];
  let json: unknown;
  try { json = JSON.parse(res.html); } catch { return []; } // 壊れた応答で巡回全体を止めない
  const parsed = TribeSchema.safeParse(json);
  if (!parsed.success) return [];
  return parsed.data.events.filter((e) => !/開館日|休館日|開館時間/.test(e.title)).map((e) => `【予定】${e.title.replace(/<[^>]+>/g, "")}｜開始 ${e.start_date}｜終了 ${e.end_date}｜料金 ${e.cost ?? ""}｜${e.url}`);
}

async function main(): Promise<void> {
  const pref = argValue("pref");
  const conc = Number(argValue("concurrency") ?? "8");
  fs.mkdirSync(SNAP, { recursive: true });
  fs.mkdirSync(path.join(DIR, "changes"), { recursive: true });
  const state = readJson<Record<string, State>>(STATE, {});
  // 直近12時間以内に取得した館は飛ばす（途中で止まった回の続きから再開できる）
  const recent = Date.now() - 12 * 3_600_000;
  // 巡回するページの一覧（館ごとにイベントページと、あれば展覧会ページ）
  type Job = { r: Row; key: string; url: string };
  const onlyEx = process.argv.includes("--only-exhibit");
  const targets: Job[] = loadMaster()
    // --min-no 5001 … 番号がそれ以上の館だけ（名簿に新しく足した館の初回巡回用）
    .filter((r) => (r["イベントページURL"] ?? "").startsWith("http") && (!pref || r["都道府県"] === pref) && Number(r["No."] ?? 0) >= Number(argValue("min-no") ?? 0) && (!argValue("no") || r["No."] === argValue("no")))
    .flatMap((r): Job[] => {
      const no = r["No."] ?? "";
      const ev = (r["イベントページURL"] ?? "").split(/\s+/)[0] ?? "";
      const ex = (r["展覧会ページURL"] ?? "").split(/\s+/)[0] ?? "";
      return [
        ...(onlyEx ? [] : [{ r, key: no, url: ev }]),
        ...(ex.startsWith("http") ? [{ r, key: `${no}-ex`, url: ex }] : []),
      ];
    })
    .filter((j) => {
      const st = state[j.key];
      return !(st && Date.parse(st.lastFetched) > recent && !process.argv.includes("--force"));
    });
  console.log(`巡回対象 ${targets.length}ページ（${new Set(targets.map((j) => j.r["No."])).size}館）`);
  const changes: Change[] = [];
  const now = new Date().toISOString();
  let done = 0;
  const changesFile = path.join(DIR, "changes", `${now.replace(/[-:]/g, "").slice(0, 13)}.json`);
  // 途中で止まっても続きから再開できるよう、50館ごとに状態と変更を保存する
  const checkpoint = () => {
    fs.writeFileSync(STATE, JSON.stringify(state, null, 1));
    fs.writeFileSync(changesFile, JSON.stringify(changes, null, 1));
  };
  await mapLimit(targets, conc, async ({ r, key, url }) => {
    if (++done % 50 === 0) { checkpoint(); console.log(`  ${done}/${targets.length}`); }
    const no = r["No."] ?? "";
    // --force のときは前回の記録を使わず、全ページを初回として詳細まで読み直す
    const prev = process.argv.includes("--force") ? undefined : state[key];
    const res = await politeFetch(url);
    if (!res.ok) {
      state[key] = { url, hash: prev?.hash ?? "", lastFetched: now, lastChanged: prev?.lastChanged ?? "", status: "失敗", detail: res.detail };
      return;
    }
    const lines = pageLines(res.html);
    // The Events Calendar（WordPress）はカレンダーをJSで描くので、公開APIから予定を取る
    if (res.html.includes("tribe-events")) lines.push(...(await tribeLines(res.url)));
    const text = lines.join("\n");
    const hash = crypto.createHash("sha256").update(text).digest("hex");
    const snapFile = path.join(SNAP, `${key}.txt`);
    if (prev?.hash === hash) {
      state[key] = { ...prev, lastFetched: now, status: "変化なし", detail: "" };
      return;
    }
    // 状態が記録されていない館は、古い本文が残っていても初回として扱う（途中停止した回の取りこぼし防止）
    const before = new Set(prev && fs.existsSync(snapFile) ? fs.readFileSync(snapFile, "utf8").split("\n") : []);
    const addedLines = lines.filter((l) => !before.has(l));
    // 増えた行が詳細ページへのリンクなら、その本文も読む（一覧に開催日がないサイト向け）
    const links = pageLinks(res.html, res.url);
    const details: string[] = [];
    const headingsSeen = new Map<string, string>(); // 詳細ページの見出し → 最初に見たページ
    const seen = new Set<string>();
    for (const [i, l] of addedLines.entries()) {
      if (details.length >= MAX_DETAILS) break;
      const href = links.get(l);
      if (!href || seen.has(href) || NAV_LIKE.test(l)) continue;
      const near = `${addedLines[i - 1] ?? ""} ${l} ${addedLines[i + 1] ?? ""}`;
      if (!kindOf(l) && !EVENT_WORDS.test(l) && !findDates(near).length) continue;
      seen.add(href);
      const d = await politeFetch(href);
      if (!d.ok) continue;
      // 題名はリンクの文字より、詳細ページの見出しを優先する
      const heading = pageHeading(d.html);
      // 同じサイトで見出しが重なる（＝ページ共通の見出し）場合も、リンクの文字を使う
      const shared = headingsSeen.has(heading) && headingsSeen.get(heading) !== d.url;
      if (heading) headingsSeen.set(heading, headingsSeen.get(heading) ?? d.url);
      const title = heading && heading.length >= 4 && !NAV_LIKE.test(heading) && !GENERIC_HEADING.test(heading) && !shared && !heading.includes(r["博物館名"] ?? "@@") ? heading : l;
      const body = pageLines(d.html).filter((x) => !before.has(x) && !lines.includes(x)).join("\n").slice(0, DETAIL_CHARS);
      const ld = ldEventLines(d.html, d.url);
      if (body || ld.length) details.push([`【詳細】${title}`, `【URL】${d.url}`, ...ld, body].join("\n"));
    }
    // 一覧ページ自体に埋め込まれた構造化データも使う
    addedLines.push(...ldEventLines(res.html, res.url).filter((x) => !before.has(x)));
    const added = [...addedLines, ...details].join("\n").slice(0, MAX_CHARS);
    fs.writeFileSync(snapFile, text);
    state[key] = { url, hash, lastFetched: now, lastChanged: now, status: prev ? "変化あり" : "初回", detail: "" };
    if (added.trim()) {
      changes.push({ no, name: r["博物館名"] ?? "", pref: r["都道府県"] ?? "", city: r["市町村"] ?? "", url: res.url, first: !prev, added });
    }
  });
  checkpoint();
  const out = changesFile;
  const tally = (s: string) => targets.filter((t) => state[t.key]?.status === s).length;
  console.log(`初回 ${tally("初回")} / 変化あり ${tally("変化あり")} / 変化なし ${tally("変化なし")} / 失敗 ${tally("失敗")}`);
  console.log(`構造化に回す変更: ${changes.length}件 → ${path.relative(process.cwd(), out)}`);
}

if (import.meta.url === `file://${process.argv[1]}`) await main();
