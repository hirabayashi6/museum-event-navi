// 段階4 種類の判定：決まりで種類が分からなかった催しの「題名だけ」を、60件ずつ無料LLMに判定させる
// 上限に当たったら待たずに打ち切り、続きは次回。結果は data/kind_cache.json に残し、同じ題名は二度と送らない
import fs from "node:fs";
import path from "node:path";
import { z } from "zod";
import { DATA } from "./lib/paths.js";
import { askJson } from "./lib/llm.js";
import { KINDS, type Kind } from "./lib/classify.js";
import type { NaviEvent } from "./structure.js";

if (fs.existsSync(".env")) process.loadEnvFile(".env");
const API_KEY = process.env.LLM_API_KEY ?? "";
const BASE_URL = process.env.LLM_BASE_URL ?? "https://api.groq.com/openai/v1";
const MODEL = process.env.LLM_MODEL ?? "openai/gpt-oss-120b";
const BATCH = 60;
const MAX_CALLS = Number(process.env.LLM_MAX_CALLS ?? "150"); // 1回の実行で送る上限（無料枠は1日1,000回）

const NOT_EVENT = "催しではない";
type Verdict = Kind | typeof NOT_EVENT;
const CACHE = path.join(DATA, "kind_cache.json");
const Answer = z.object({ results: z.array(z.object({ i: z.number(), kind: z.string() })) });

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

function prompt(titles: string[]): string {
  return `博物館・美術館の公式サイトから取り出した行です。それぞれが来館者向けの催しの題名かどうかを判定し、催しなら種類を1つ選んでください。
種類: ${KINDS.join("／")}
催しの題名でないもの（お知らせ・施設名・時刻だけ・注意書き・報告記事・募集・販売・休館の案内・文の切れ端）は「${NOT_EVENT}」。
JSONだけを返す: {"results":[{"i":番号,"kind":"種類または${NOT_EVENT}"}]}

${titles.map((t, i) => `${i}: ${t}`).join("\n")}`;
}

async function ask(titles: string[]): Promise<Map<number, Verdict> | "limit"> {
  const json = await askJson(prompt(titles));
  if (json === "limit") return "limit";
  const parsed = Answer.safeParse(json);
  const out = new Map<number, Verdict>();
  if (!parsed.success) return out;
  for (const r of parsed.data.results) {
    const k = r.kind === NOT_EVENT ? NOT_EVENT : KINDS.find((x) => x === r.kind);
    if (k) out.set(r.i, k);
  }
  return out;
}

async function main(): Promise<void> {
  const cache: Record<string, Verdict> = fs.existsSync(CACHE) ? JSON.parse(fs.readFileSync(CACHE, "utf8")) : {};
  const evDir = path.join(DATA, "events");
  const files = fs.readdirSync(evDir).map((f) => path.join(evDir, f));
  const all = files.flatMap((f) => JSON.parse(fs.readFileSync(f, "utf8")) as NaviEvent[]);
  const todo = [...new Set(all.filter((e) => !e.kind && !(e.title in cache)).map((e) => e.title))];
  console.log(`種類の判定待ち ${todo.length}件（判定済み ${Object.keys(cache).length}件）`);
  if (API_KEY) {
    let calls = 0;
    for (let i = 0; i < todo.length && calls < MAX_CALLS; i += BATCH, calls++) {
      const batch = todo.slice(i, i + BATCH);
      const got = await ask(batch);
      if (got === "limit") { console.log("無料枠の上限に到達。続きは次回"); break; }
      got.forEach((k, idx) => { const t = batch[idx]; if (t) cache[t] = k; });
      fs.writeFileSync(CACHE, JSON.stringify(cache));
      if (calls % 10 === 0) console.log(`  ${Math.min(i + BATCH, todo.length)}/${todo.length}`);
    }
  } else {
    console.log("LLM_API_KEY が未設定のため、判定済みの結果だけを反映します");
  }
  // 判定結果を各館のファイルに反映（「催しではない」は種類なしのまま＝公開の関門で落ちる）
  let applied = 0;
  for (const f of files) {
    const evs = JSON.parse(fs.readFileSync(f, "utf8")) as NaviEvent[];
    let changed = false;
    for (const e of evs) {
      const v = cache[e.title];
      if (!e.kind && v && v !== NOT_EVENT) { e.kind = v; changed = true; applied++; }
    }
    if (changed) fs.writeFileSync(f, JSON.stringify(evs, null, 1));
  }
  console.log(`種類を付けた催し ${applied}件`);
}

await main();
