// 段階3 構造化（決まりベース）：巡回で増えた行から、イベントを決まった形に整える。LLMは使わない
// 使い方: npm run structure -- [--file data/crawl/changes/xxx.json]
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { argValue } from "./lib/museums.js";
import { DATA } from "./lib/paths.js";
import { findDates, parseRange, timeOf, toHalfWidth } from "./lib/jpdate.js";
import { kindOf, audienceOf, feeOf, reservationOf, NOT_EVENT, GENERIC_TITLE, type Kind, type Audience } from "./lib/classify.js";
import type { Change } from "./crawl.js";

export type NaviEvent = {
  id: string;
  no: string;
  museum: string;
  pref: string;
  city: string;
  title: string;
  kind: Kind | null;
  start_date: string;
  end_date: string | null;
  time: string | null;
  audience: Audience[];
  fee: string | null;
  reservation: "必要" | "不要" | "不明";
  place: string | null;
  capacity: string | null;
  deadline: string | null;
  apply: string | null;
  bring: string | null;
  lecturer: string | null;
  source_url: string;
  method: "api" | "詳細ページ" | "一覧" | "Instagram" | "Facebook";
  confidence: number;
  raw?: string; // 題名を作り直すときに使う、元のページの前後の文章（公開はしない）
  extracted_at: string;
};

const LABEL = {
  date: /^[【■◆●・]?(日にち|日時|開催日時?|期日|期間|会期|日程|開催期間|実施日)[】]?\s*[:：]?\s*(.*)$/,
  time: /^[【■◆●・]?(時間|開催時間|時刻)[】]?\s*[:：]?\s*(.*)$/,
  target: /^[【■◆●・]?(対象|対象者|参加対象)[】]?\s*[:：]?\s*(.*)$/,
  fee: /^[【■◆●・]?(費用|参加費|料金|入場料|観覧料|受講料|材料費)[】]?\s*[:：]?\s*(.*)$/,
  apply: /^[【■◆●・]?(申込|申し込み|申込方法|申し込み方法|予約|予約方法|お申込み|お申し込み|参加方法)[】]?\s*[:：]?\s*(.*)$/,
  place: /^[【■◆●・]?(場所|会場|開催場所|集合場所)[】]?\s*[:：]?\s*(.*)$/,
  capacity: /^[【■◆●・]?(定員|募集人数|募集人員)[】]?\s*[:：]?\s*(.*)$/,
  deadline: /^[【■◆●・]?(申込締切|申し込み締切|締切|締め切り|申込期限|申込期間|受付期間)[】]?\s*[:：]?\s*(.*)$/,
  bring: /^[【■◆●・]?(持ち物|持参するもの|持参物)[】]?\s*[:：]?\s*(.*)$/,
  lecturer: /^[【■◆●・]?(講師|出演|出演者|案内|ナビゲーター|解説)[】]?\s*[:：]?\s*(.*)$/,
};

type Fields = Partial<Record<keyof typeof LABEL, string>>;

// 「日にち」の次の行に値がある書き方と、「日時：」の同じ行に値がある書き方の両方を読む
// 事実の値は短く切る（紹介文の転載にならないよう、項目の値だけを使う）
const short = (v: string | undefined, n = 60): string | null => {
  const t = (v ?? "").replace(/[\s\u3000]+/g, " ").trim();
  return t ? (t.length > n ? `${t.slice(0, n)}…` : t) : null;
};

function readFields(lines: string[]): Fields {
  const f: Fields = {};
  lines.forEach((line, i) => {
    for (const [key, re] of Object.entries(LABEL) as [keyof typeof LABEL, RegExp][]) {
      const m = line.match(re);
      if (m && !f[key]) f[key] = (m[2] || lines[i + 1] || "").slice(0, 120);
    }
  });
  return f;
}

const today = () => new Date().toISOString().slice(0, 10);
export const idOf = (no: string, title: string, start: string) => crypto.createHash("sha1").update(`${no}|${title}|${start}`).digest("hex").slice(0, 16);

function cleanTitle(s: string): string {
  const t = toHalfWidth(s)
    .replace(/(令和|平成)\s*\d+\s*年度?|20\d{2}\s*年度|20\d{2}\s*[年./-]/g, "")
    .replace(/\d{1,2}\s*(月\s*\d{1,2}\s*日|\/\d{1,2})\s*([(（][^)）]{1,4}[)）])?/g, "")
    // 「,8(日)」のように日だけ残った部分
    .replace(/^[\s,、]*(\d{1,2}\s*[(（][^)）]{1,4}[)）][\s,、]*)+/g, "")
    .replace(/[～\-ー,、・]\s*(?=\s|$)/g, "")
    .replace(/^[\s◆◇■□●○★☆＜<【\[・,、～]+|[\s◆◇■□●○★☆＞>】\]・,、～]+$/g, "")
    .replace(/[◆]+/g, "")
    .replace(/\s+/g, " ")
    .trim();
  // 日付を抜いたあとに残った空のかっこを消す
  const t2 = t.replace(/[（(［\[【]\s*[・、,～〜\-\s]*\s*[)）］\]】]/g, "").replace(/\s{2,}/g, " ").trim();
  // 括弧書きだけ・見出し語だけの行は題名にしない
  const core = t2.replace(/[(（][^)）]*[)）]/g, "").trim();
  return core.length < 3 || GENERIC_TITLE.test(core) ? "" : t2;
}

// 日付の行に残りがちな「状態」「場所」の言葉
const STATUS_WORDS = /開催中|開催予定|近日開催|近日公開|会期中|終了|予告|会期|会場|NEW|New|[0-9・,、]+階|[^\s]{0,8}展示室|ギャラリー\s*[0-9A-Z]?|ホール|\b(Sun|Mon|Tue|Wed|Thu|Fri|Sat)(day|\.)?\b|[-–]/g;
const STATUS_ONLY = /^[\s:：・,、()（）]*$/;
const SUBTITLE_HEAD = /(展|展覧会|フェア|フェスタ|コレクション)$/;

// 日付の行の上にある題名を探す。英語だけの行は飛ばし、「○○展」の次の行が副題ならつなげる
function titleAbove(lines: string[], i: number): string {
  const above: string[] = [];
  for (let k = i - 1; k >= 0 && above.length < 2 && k >= i - 3; k--) {
    const raw = lines[k] ?? "";
    if (findDates(raw).length) break; // 前の催しの日付行まで来たら止める
    if (/^[A-Za-z0-9\s:;,.'’&!?\-–()]+$/.test(raw.trim())) continue; // 英語の題名だけの行
    const t = cleanTitle(raw);
    if (t) above.unshift(t);
  }
  const [a, b] = above.length === 2 ? above : [undefined, above[0]];
  if (a && b && SUBTITLE_HEAD.test(a) && !/展|祭|会|教室|講座/.test(b)) return `${a} ${b}`;
  // 「隙あらば猫／町田尚子絵本原画展」のように、短い副題が先に来る書き方
  if (a && b && SUBTITLE_HEAD.test(b) && !SUBTITLE_HEAD.test(a) && a.length <= 15) return `${a} ${b}`;
  return b ?? "";
}

function make(c: Change, base: Omit<NaviEvent, "id" | "no" | "museum" | "pref" | "city" | "extracted_at">): NaviEvent {
  return { ...base, id: idOf(c.no, base.title, base.start_date), no: c.no, museum: c.name, pref: c.pref, city: c.city, extracted_at: new Date().toISOString() };
}

export function structure(c: Change): NaviEvent[] {
  const out: NaviEvent[] = [];
  const [listPart = "", ...detailParts] = c.added.split("【詳細】");
  const listLines = listPart.split("\n");

  // 1. The Events Calendar のAPIから取った予定
  const plannedLines = c.added.split("\n").filter((x) => x.startsWith("【予定】"));
  for (const l of plannedLines) {
    const [t = "", s = "", e = "", fee = "", url = ""] = l.slice(4).split("｜");
    const start = s.replace("開始 ", "").slice(0, 10);
    const end = e.replace("終了 ", "").slice(0, 10);
    const title = cleanTitle(t);
    if (!title || NOT_EVENT.test(title)) continue;
    out.push(make(c, {
      title, kind: kindOf(title), start_date: start, end_date: end && end !== start ? end : null,
      time: timeOf(s.slice(16) + "～" + e.slice(16)), audience: audienceOf(title), fee: feeOf(fee.replace("料金", "")),
      reservation: reservationOf(title), place: null, capacity: null, deadline: null, apply: null, bring: null, lecturer: null,
      source_url: url || c.url, method: "api", confidence: 0.95, raw: t.slice(0, 200),
    }));
  }

  // 2. 詳細ページ：「日にち」「対象」「費用」などの見出しから読む
  const detailTitles = new Set<string>();
  for (const part of detailParts) {
    const all = part.split("\n").filter(Boolean);
    const urlLine = all.find((x) => x.startsWith("【URL】"));
    const lines = all.filter((x) => !x.startsWith("【URL】") && !x.startsWith("【予定】"));
    const detailUrl = urlLine ? urlLine.slice(5) : c.url;
    // 構造化データ（【予定】）がある詳細ページは、そちらを正とする
    if (all.some((x) => x.startsWith("【予定】"))) { detailTitles.add(lines[0] ?? ""); continue; }
    const title = cleanTitle(lines[0] ?? "");
    if (!title || NOT_EVENT.test(title)) continue;
    detailTitles.add(lines[0] ?? "");
    const f = readFields(lines.slice(1));
    const body = lines.slice(1).join("\n");
    const range = parseRange(f.date ?? "") ?? parseRange(body.split("\n").find((x) => findDates(x).length && !/掲載|更新|投稿|締切|締め切り/.test(x)) ?? "");
    if (!range) continue;
    out.push(make(c, {
      title, kind: kindOf(title, body), start_date: range.start, end_date: range.end,
      time: f.time ? timeOf(f.time) : f.date ? timeOf(f.date) : null,
      audience: audienceOf(`${f.target ?? ""} ${title}`), fee: feeOf(f.fee ?? "") ?? feeOf(body),
      reservation: reservationOf(title) !== "不明" ? reservationOf(title) : reservationOf(`${f.apply ?? ""} ${body}`), place: short(f.place, 40),
      capacity: short(f.capacity, 30), deadline: short(f.deadline, 40), apply: short(f.apply, 60), bring: short(f.bring, 50), lecturer: short(f.lecturer, 50),
      source_url: detailUrl, method: "詳細ページ", confidence: f.date ? 0.9 : 0.7, raw: lines.slice(0, 4).join(" ／ ").slice(0, 240),
    }));
  }

  // 3. 一覧の行：日付と題名が同じ行にあるもの（日付だけの行は掲載日なので使わない）
  for (const line of listLines) {
    if (line.startsWith("【予定】") || detailTitles.has(line) || /掲載|更新日|投稿|締切|締め切り/.test(line)) continue;
    const hits = findDates(line);
    if (!hits.length) continue;
    // 題名の次の行に会期だけが書かれている場合は、前の行を題名にする（掲載日だけの行は除く）
    // 「開催中」「3階展示室」のような状態・場所の言葉だけが残った行は、題名がない行として扱う
    let title = cleanTitle(line);
    const rest = title.replace(STATUS_WORDS, "").replace(/[\d.\/:：()（）~～\s]+/g, "").trim();
    if (STATUS_ONLY.test(rest) || rest.length < 3) title = "";
    const i = listLines.indexOf(line);
    if (!title && (parseRange(line)?.end || /会期|期間|日時|開催|～/.test(toHalfWidth(line)))) title = titleAbove(listLines, i);
    if (title.length < 4 || NOT_EVENT.test(title)) continue;
    const range = parseRange(line);
    const isRange = Boolean(range?.end);
    // 「11/22(日) 12/6(日) どんぐりやじろべぇ」のように範囲でない複数日付は、日付ごとに1件
    const dates = isRange && range ? [range] : hits.map((h) => ({ start: h.date, end: null as string | null }));
    for (const d of dates) {
      out.push(make(c, {
        title, kind: kindOf(title), start_date: d.start, end_date: d.end, time: timeOf(line),
        audience: audienceOf(line), fee: feeOf(line), reservation: reservationOf(line), place: null,
        capacity: null, deadline: null, apply: null, bring: null, lecturer: null,
        source_url: c.url, method: "一覧", confidence: 0.75,
        raw: [listLines[i - 1], line, listLines[i + 1]].filter(Boolean).join(" ／ ").slice(0, 240),
      }));
    }
  }

  // 終わった催しは除き、同じ題名・同じ開始日はまとめる
  const t = today();
  const uniq = new Map<string, NaviEvent>();
  for (const e of out) if ((e.end_date ?? e.start_date) >= t && !uniq.has(e.id)) uniq.set(e.id, e);
  return [...uniq.values()];
}

function main(): void {
  const dir = path.join(DATA, "crawl", "changes");
  const file = argValue("file") ?? path.join(dir, fs.readdirSync(dir).sort().at(-1) ?? "");
  const changes = JSON.parse(fs.readFileSync(file, "utf8")) as Change[];
  const evDir = path.join(DATA, "events");
  fs.mkdirSync(evDir, { recursive: true });
  let total = 0;
  for (const c of changes) {
    const fresh = structure(c);
    const f = path.join(evDir, `${c.no}.json`);
    const old = fs.existsSync(f) ? (JSON.parse(fs.readFileSync(f, "utf8")) as NaviEvent[]) : [];
    const merged = new Map(old.filter((e) => (e.end_date ?? e.start_date) >= today()).map((e) => [e.id, e]));
    for (const e of fresh) merged.set(e.id, e);
    fs.writeFileSync(f, JSON.stringify([...merged.values()], null, 1));
    total += fresh.length;
  }
  console.log(`構造化 ${changes.length}館 → ${total}件`);
}

if (import.meta.url === `file://${process.argv[1]}`) main();
