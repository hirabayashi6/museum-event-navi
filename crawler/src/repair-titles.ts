// 段階4b 題名の作り直し：日付や種類は取れているのに題名が壊れている催しを、元の前後の文章から無料LLMで作り直す
// 種類の判定で「催しではない」とされたものも、前後の文章があれば作り直す（作り直した題名は classify-llm でもう一度種類を判定する）
// 落とす前に救う。結果は data/title_cache.json に残し、同じ文章は二度と送らない。上限に当たったら次回に回す
import fs from "node:fs";
import path from "node:path";
import { z } from "zod";
import { DATA } from "./lib/paths.js";
import { askJson } from "./lib/llm.js";
import { rejectReason } from "./lib/quality.js";
import { staleReason } from "./lib/raw-checks.js";
import type { NaviEvent } from "./structure.js";

if (fs.existsSync(".env")) process.loadEnvFile(".env");
const API_KEY = process.env.LLM_API_KEY ?? "";
const BASE_URL = process.env.LLM_BASE_URL ?? "https://api.groq.com/openai/v1";
const MODEL = process.env.LLM_MODEL ?? "openai/gpt-oss-120b";
const BATCH = 40;
const MAX_CALLS = Number(process.env.LLM_MAX_CALLS ?? "150");
const CACHE = path.join(DATA, "title_cache.json");
const NONE = "なし";
// 題名の問題で落ちた催しだけを対象にする（種類が分からないものは classify-llm 側で扱う）
const TITLE_REASONS = /題名|文章|お知らせ|日付の抜けた跡|見出し|リンク文字|日本語の題名|時刻だけ|語を含む|館名だけ/;

const Answer = z.object({ results: z.array(z.object({ i: z.number(), title: z.string() })) });
const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));
const keyOf = (e: NaviEvent) => `${e.no}|${e.raw ?? e.title}`;
// 種類の判定で「催しではない」とされた題名。日付の行を題名にしてしまい、本当の名前は前の行にあることが多い（抜き取りで約3割）
const KIND_CACHE = path.join(DATA, "kind_cache.json");
const notEvent: Record<string, string> = fs.existsSync(KIND_CACHE) ? JSON.parse(fs.readFileSync(KIND_CACHE, "utf8")) : {};
// 文章に書かれた年（西暦・令和）がすべて今年より前なら、年を読み違えた古い催しなので救わない
function onlyPastYears(raw: string): boolean {
  const thisYear = new Date().getFullYear();
  const years = [...raw.normalize("NFKC").matchAll(/(20\d{2})\s*年|令和\s*(\d{1,2})\s*年/g)].map((m) => (m[1] ? Number(m[1]) : 2018 + Number(m[2])));
  return years.length > 0 && Math.max(...years) < thisYear;
}
// 古い催し・他館の催しは、題名を作り直しても載らないので送らない（無料枠の節約）
const titleBroken = (e: NaviEvent) =>
  staleReason(e) ? false : e.kind ? TITLE_REASONS.test(rejectReason(e) ?? "") : notEvent[e.title] === "催しではない" && (e.raw ?? "").length > e.title.length + 8 && !onlyPastYears(e.raw ?? "");

function prompt(items: NaviEvent[]): string {
  return `博物館・美術館の公式サイトの一部分です。それぞれの文章から、来館者が参加・鑑賞する「催しの名前」だけを取り出してください。
- 日付・時刻・料金・申込方法・館名の見出しは題名に入れない。「」や『』の中に名前があればそれを中心にする
- 30字以内。原文の言葉を使い、作り話はしない
- 文章は「前の行 ／ 日付の行 ／ 後ろの行」の順のことが多い。前の行と後ろの行の両方に別々の催しの名前があり、日付がどちらのものか分からないときは「${NONE}」
- 催しの名前が読み取れない、お知らせ・報告・募集・見出し・割引やキャンペーンの案内だけの場合は「${NONE}」
JSONだけを返す: {"results":[{"i":番号,"title":"催しの名前または${NONE}"}]}

${items.map((e, i) => `${i}: [${e.museum}／${e.kind ?? "種類不明"}] ${e.raw ?? e.title}`).join("\n")}`;
}

async function ask(items: NaviEvent[]): Promise<Map<number, string> | "limit"> {
  const json = await askJson(prompt(items));
  if (json === "limit") return "limit";
  const parsed = Answer.safeParse(json);
  const out = new Map<number, string>();
  if (parsed.success) for (const r of parsed.data.results) out.set(r.i, r.title.trim().slice(0, 40));
  return out;
}

async function main(): Promise<void> {
  const cache: Record<string, string> = fs.existsSync(CACHE) ? JSON.parse(fs.readFileSync(CACHE, "utf8")) : {};
  const evDir = path.join(DATA, "events");
  const files = fs.readdirSync(evDir).map((f) => path.join(evDir, f));
  const all = files.flatMap((f) => JSON.parse(fs.readFileSync(f, "utf8")) as NaviEvent[]);
  const today = new Date().toISOString().slice(0, 10);
  const targets = all.filter((e) => e.raw && (e.end_date ?? e.start_date) >= today && titleBroken(e) && !(keyOf(e) in cache));
  const uniq = [...new Map(targets.map((e) => [keyOf(e), e])).values()];
  console.log(`題名の作り直し待ち ${uniq.length}件（済み ${Object.keys(cache).length}件）`);
  if (API_KEY) {
    let calls = 0;
    for (let i = 0; i < uniq.length && calls < MAX_CALLS; i += BATCH, calls++) {
      const batch = uniq.slice(i, i + BATCH);
      const got = await ask(batch);
      if (got === "limit") { console.log("無料枠の上限に到達。続きは次回"); break; }
      got.forEach((t, idx) => { const e = batch[idx]; if (e) cache[keyOf(e)] = t; });
      fs.writeFileSync(CACHE, JSON.stringify(cache));
      if (calls % 10 === 0) console.log(`  ${Math.min(i + BATCH, uniq.length)}/${uniq.length}`);
    }
  }
  // 作り直した題名を反映（「なし」は催しではないので、そのまま落ちる）
  let fixed = 0;
  for (const f of files) {
    const evs = JSON.parse(fs.readFileSync(f, "utf8")) as NaviEvent[];
    let changed = false;
    for (const e of evs) {
      const t = cache[keyOf(e)];
      if (t && t !== NONE && t !== e.title && titleBroken(e)) { e.title = t; changed = true; fixed++; }
    }
    if (changed) fs.writeFileSync(f, JSON.stringify(evs, null, 1));
  }
  console.log(`題名を作り直した催し ${fixed}件`);
}

await main();
