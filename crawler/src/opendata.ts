// 自治体のオープンデータ「イベント一覧」の取り込み：BODIK と東京都のカタログから CSV を集め、
// 会場（場所名称）が名簿の館と一致するイベントだけを、その館の催しとして足す
// 使い方: npm run opendata
// 出力: data/opendata/sources.json（使ったデータの一覧）、data/events/{No}.json（method "オープンデータ"、出典 credit 付き）
import fs from "node:fs";
import path from "node:path";
import { parse } from "csv-parse/sync";
import { loadMaster, type Row } from "./lib/museums.js";
import { DATA } from "./lib/paths.js";
import { USER_AGENT } from "./lib/http.js";
import { timeOf } from "./lib/jpdate.js";
import { kindOf, audienceOf, feeOf, reservationOf } from "./lib/classify.js";
import { core, norm, similar, load, today } from "./lib/sns.js";
import { idOf, type NaviEvent } from "./structure.js";

const CATALOGS = [
  { name: "BODIK", base: "https://data.bodik.jp" },
  { name: "東京都", base: "https://catalog.data.metro.tokyo.lg.jp" },
];
const OUT_DIR = path.join(DATA, "opendata");
const MAX_BYTES = 20_000_000;
type Res = { url: string; format?: string; name?: string };
type Pkg = { name: string; title: string; license_title?: string; metadata_modified?: string; organization?: { title?: string }; resources: Res[] };
type Source = { catalog: string; org: string; title: string; page: string; csv: string; license: string; rows: number; matched: number; modified: string };

// 列の名前のゆれ（デジタル庁の標準と、自治体独自の列名）
const COL = {
  title: ["イベント名", "イベント名称", "名称"],
  start: ["開始日", "開催日", "開始年月日"],
  end: ["終了日", "終了年月日"],
  startTime: ["開始時間", "開始時刻"],
  endTime: ["終了時間", "終了時刻"],
  desc: ["説明", "概要"],
  fee: ["料金(基本)", "料金（基本）", "料金", "料金(詳細)"],
  target: ["対象者", "参加資格", "対象者備考", "対象"],
  place: ["場所名称", "会場", "開催場所", "場所"],
  url: ["コンテンツURL", "独自ホームページ", "URL", "ホームページ"],
  apply: ["申込", "参加申込", "申込方法", "参加申込方法"],
  muniCode: ["全国地方公共団体コード"],
};
const pick = (r: Record<string, string>, keys: string[]) => { for (const k of keys) { const v = r[k]?.trim(); if (v) return v; } return ""; };

// 「2026/11/16」「2026-11-16」「20261116」→ 2026-11-16
function ymd(v: string): string | null {
  const m = v.replace(/[年月]/g, "/").replace(/日/, "").match(/(20\d{2})[/.-]?(\d{1,2})[/.-]?(\d{1,2})/);
  return m ? `${m[1]}-${m[2]!.padStart(2, "0")}-${m[3]!.padStart(2, "0")}` : null;
}

const PREF_CODE = ["", "北海道", "青森県", "岩手県", "宮城県", "秋田県", "山形県", "福島県", "茨城県", "栃木県", "群馬県", "埼玉県", "千葉県", "東京都", "神奈川県", "新潟県", "富山県", "石川県", "福井県", "山梨県", "長野県", "岐阜県", "静岡県", "愛知県", "三重県", "滋賀県", "京都府", "大阪府", "兵庫県", "奈良県", "和歌山県", "鳥取県", "島根県", "岡山県", "広島県", "山口県", "徳島県", "香川県", "愛媛県", "高知県", "福岡県", "佐賀県", "長崎県", "熊本県", "大分県", "宮崎県", "鹿児島県", "沖縄県"];

const CATALOG_DAYS = 7;
const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));
// 同じサイトへのダウンロードは3秒以上あける（相手に負担をかけない）
const lastHit = new Map<string, number>();
async function politely(url: string): Promise<void> {
  const host = new URL(url).host;
  const wait = (lastHit.get(host) ?? 0) + 3000 - Date.now();
  if (wait > 0) await sleep(wait);
  lastHit.set(host, Date.now());
}

async function catalogPackages(base: string, name: string): Promise<Pkg[] | "denied"> {
  const cacheFile = path.join(OUT_DIR, `catalog_${name}.json`);
  if (fs.existsSync(cacheFile) && Date.now() - fs.statSync(cacheFile).mtimeMs < CATALOG_DAYS * 86_400_000) return JSON.parse(fs.readFileSync(cacheFile, "utf8")) as Pkg[];
  const out: Pkg[] = [];
  for (let start = 0; start < 10000; start += 1000) {
    await politely(base);
    const res = await fetch(`${base}/api/3/action/package_search?q=${encodeURIComponent("イベント一覧")}&rows=1000&start=${start}`, { headers: { "User-Agent": USER_AGENT } }).catch(() => null);
    if (res?.status === 403 || res?.status === 429) return "denied";
    if (!res?.ok) break;
    const r = ((await res.json()) as { result: { results: Pkg[]; count: number } }).result;
    out.push(...r.results);
    if (start + 1000 >= r.count) break;
  }
  const list = out.filter((p) => /イベント(一覧|情報)/.test(p.title));
  if (list.length) fs.writeFileSync(cacheFile, JSON.stringify(list));
  return list;
}

// 相手側の一時的な不調に備えて、失敗したら5秒あけてもう一度だけ試す
async function csvRows(url: string): Promise<Record<string, string>[] | null> {
  return (await csvRowsOnce(url)) ?? (await new Promise((r) => setTimeout(r, 5000)), await csvRowsOnce(url));
}

async function csvRowsOnce(url: string): Promise<Record<string, string>[] | null> {
  await politely(url);
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 30_000);
  try {
    const res = await fetch(url, { headers: { "User-Agent": USER_AGENT }, signal: ctrl.signal });
    if (!res.ok) return null;
    const buf = Buffer.from(await res.arrayBuffer());
    if (buf.length > MAX_BYTES) return null;
    let txt = new TextDecoder("utf-8").decode(buf);
    if (txt.includes("�")) txt = new TextDecoder("shift_jis").decode(buf); // 自治体のCSVは Shift_JIS も多い
    txt = txt.replace(/^﻿/, "");
    if (/^\s*</.test(txt)) return null; // CSVではなくページが返ってきた
    return parse(txt, { columns: true, skip_empty_lines: true, relax_column_count: true, relax_quotes: true, trim: true }) as Record<string, string>[];
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

// 会場の名前から館を探す（同じ都道府県・市区町村の館だけ）
function matcher(master: Row[]) {
  const byPref = new Map<string, Row[]>();
  for (const r of master) byPref.set(r["都道府県"] ?? "", [...(byPref.get(r["都道府県"] ?? "") ?? []), r]);
  return (place: string, pref: string, muni: string): Row | null => {
    const p = norm(place);
    if (p.length < 3) return null;
    const cands = (byPref.get(pref) ?? []).filter((r) => !muni || /[都道府県]$/.test(muni) || (r["市町村"] ?? "").includes(muni.replace(/^.*?[都道府県]/, "")) || muni.includes(r["市町村"] ?? "@@"));
    // 「東公園・東公園動物園」のように複数の名前が並ぶ会場は、一つずつ照らし合わせる
    const parts = place.split(/[・、,／/]|\s+/).map(norm).filter((x) => x.length >= 4 && /館|園|ミュージアム|センター|プラネタリウム/.test(x));
    let best: { r: Row; len: number } | null = null;
    for (const r of cands) {
      const c = core(r["博物館名"] ?? "");
      if (c.length < 3) continue;
      // 館の名前の先頭の市町村名（「岡崎市東公園動物園」の「岡崎市」）は外しても比べる
      const c2 = c.replace(/^.{1,4}?[市町村区]/, "");
      // 会場名に館の呼び名がまるごと入る（「岡崎市美術博物館 1階」など）、または館の名前に会場名が入る（会場名が館らしい場合）
      const hit = p.includes(c) || (c2.length >= 4 && p.includes(c2)) || (c.includes(p) && p.length >= 4 && /館|園|ミュージアム|センター|プラネタリウム/.test(place)) || parts.some((x) => c.includes(x));
      if (hit && (!best || c.length > best.len)) best = { r, len: c.length };
    }
    return best?.r ?? null;
  };
}

async function main(): Promise<void> {
  fs.mkdirSync(OUT_DIR, { recursive: true });
  const master = loadMaster().filter((r) => (r["博物館名"] ?? "").length > 0);
  const findMuseum = matcher(master);
  const t = today();
  const sources: Source[] = [];
  const byNo = new Map<string, NaviEvent[]>();
  for (const cat of CATALOGS) {
    const pkgs = await catalogPackages(cat.base, cat.name);
    if (pkgs === "denied") { console.log(`${cat.name}：アクセスを拒否されたため、今回は読まない`); continue; }
    console.log(`${cat.name}：イベント一覧 ${pkgs.length}件`);
    for (const p of pkgs) {
      const res = p.resources.filter((r) => (r.format ?? "").toUpperCase() === "CSV" || /\.csv(\?|$)/i.test(r.url));
      // 同じデータに複数のCSVがあるときは、最後（新しいことが多い）を使う
      const csv = res.at(-1);
      if (!csv) continue;
      const rows = await csvRows(csv.url);
      if (!rows) continue;
      const org = p.organization?.title ?? "";
      const license = (p.license_title ?? "").replace("Creative Commons Attribution 4.0 International", "CC BY 4.0").replace("Creative Commons Attribution", "CC BY");
      let matched = 0;
      for (const r of rows) {
        const title = pick(r, COL.title);
        const start = ymd(pick(r, COL.start));
        if (!title || !start) continue;
        const end = ymd(pick(r, COL.end));
        if ((end ?? start) < t) continue;
        const code = pick(r, COL.muniCode).slice(0, 2);
        const pref = PREF_CODE[Number(code)] ?? (cat.name === "東京都" ? "東京都" : "");
        const place = pick(r, COL.place);
        const m = findMuseum(place, pref || (master.find((x) => (x["市町村"] ?? "") && org.includes(x["市町村"] ?? "@@"))?.["都道府県"] ?? ""), org);
        if (!m) continue;
        matched++;
        const desc = pick(r, COL.desc);
        const no = m["No."] ?? "";
        const st = pick(r, COL.startTime), et = pick(r, COL.endTime);
        const url = pick(r, COL.url);
        const e: NaviEvent = {
          id: idOf(no, title, start), no, museum: m["博物館名"] ?? "", pref: m["都道府県"] ?? "", city: m["市町村"] ?? "",
          title: title.slice(0, 80), kind: kindOf(title, desc), start_date: start, end_date: end && end !== start ? end : null,
          time: st ? timeOf(`${st}～${et}`) : null,
          audience: audienceOf(`${pick(r, COL.target)} ${title}`), fee: feeOf(pick(r, COL.fee)) ?? (pick(r, COL.fee) ? pick(r, COL.fee).slice(0, 30) : null),
          reservation: reservationOf(`${pick(r, COL.apply)} ${desc}`), place: place.slice(0, 40) || null,
          capacity: null, deadline: null, apply: pick(r, COL.apply).slice(0, 60) || null, bring: null, lecturer: null,
          source_url: /^https?:\/\//.test(url) ? url : `${cat.base}/dataset/${p.name}`,
          method: "オープンデータ", confidence: 0.95, raw: `${title} ／ ${desc}`.slice(0, 240),
          credit: `出典：${org}「${p.title}」${license ? `（${license}）` : ""}`,
          extracted_at: new Date().toISOString(),
        };
        byNo.set(no, [...(byNo.get(no) ?? []), e]);
      }
      sources.push({ catalog: cat.name, org, title: p.title, page: `${cat.base}/dataset/${p.name}`, csv: csv.url, license, rows: rows.length, matched, modified: (p.metadata_modified ?? "").slice(0, 10) });
    }
  }
  // 館のイベントファイルに足す。すでに同じ日付で似た題名の催しがあれば、そちらを残す
  let added = 0;
  for (const [no, fresh] of byNo) {
    const f = path.join(DATA, "events", `${no}.json`);
    const old = load<NaviEvent[]>(f, []).filter((e) => (e.end_date ?? e.start_date) >= t);
    const others = old.filter((e) => e.method !== "オープンデータ");
    const merged = new Map(others.map((e) => [e.id, e]));
    for (const e of fresh) {
      if (others.some((o) => o.start_date === e.start_date && similar(o.title, e.title))) continue;
      if (!merged.has(e.id)) added++;
      merged.set(e.id, e);
    }
    fs.writeFileSync(f, JSON.stringify([...merged.values()], null, 1));
  }
  const prevSources = load<Source[]>(path.join(OUT_DIR, "sources.json"), []);
  const merged = new Map([...prevSources, ...sources].map((x) => [x.page, x]));
  fs.writeFileSync(path.join(OUT_DIR, "sources.json"), JSON.stringify([...merged.values()], null, 1));
  console.log(`使ったデータ ${sources.length}件（館と一致したイベントがあったもの ${sources.filter((s) => s.matched).length}件）／ 館のイベントとして足した ${added}件（${byNo.size}館）`);
}

await main();
