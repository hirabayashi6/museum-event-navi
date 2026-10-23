// 段階3 構造化：巡回で増えた行を無料枠のLLMに渡し、イベントを決まった形に整える
// 使い方: npm run extract -- [--file data/crawl/changes/xxx.json] [--limit 5]
// 必要な環境変数（crawler/.env）: LLM_API_KEY。任意: LLM_BASE_URL, LLM_MODEL
import fs from "node:fs";
import path from "node:path";
import { z } from "zod";
import { argValue } from "./lib/museums.js";
import { DATA } from "./lib/paths.js";
import type { Change } from "./crawl.js";

if (fs.existsSync(".env")) process.loadEnvFile(".env");
const API_KEY = process.env.LLM_API_KEY ?? "";
const BASE_URL = process.env.LLM_BASE_URL ?? "https://api.groq.com/openai/v1";
const MODEL = process.env.LLM_MODEL ?? "openai/gpt-oss-120b";
const INTERVAL_MS = 2500; // 無料枠のレート制限に収める

export const KINDS = ["ワークショップ", "講座・公演・音楽イベント", "ギャラリートーク", "観察会・野外", "特別展・企画展", "常設展"] as const;
export const AUDIENCES = ["未就学", "小学生低学年", "小学生高学年", "中高生", "大人", "親子"] as const;

type Kind = (typeof KINDS)[number];

// LLM が決めた言葉以外を返しても、近い種類に寄せる（寄せられなければ null＝要確認）
function normalizeKind(raw: string): Kind | null {
  const exact = KINDS.find((k) => k === raw);
  if (exact) return exact;
  if (/ワークショップ|工作|体験|教室|つくる|作り/.test(raw)) return "ワークショップ";
  if (/講座|講演|公演|音楽|コンサート|ショー|上映|朗読|読み聞かせ|よみきかせ|おはなし/.test(raw)) return "講座・公演・音楽イベント";
  if (/トーク|解説|ガイド/.test(raw)) return "ギャラリートーク";
  if (/観察|野外|自然|探検|散策|まち歩き/.test(raw)) return "観察会・野外";
  if (/常設/.test(raw)) return "常設展";
  if (/展/.test(raw)) return "特別展・企画展";
  return null;
}

const EventSchema = z.object({
  title: z.string().min(1),
  kind: z.string(),
  start_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  end_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable(),
  time: z.string().nullable(),
  audience: z.array(z.string()).transform((a) => a.filter((x): x is (typeof AUDIENCES)[number] => (AUDIENCES as readonly string[]).includes(x))),
  fee: z.string().nullable(),
  reservation: z.enum(["必要", "不要", "不明"]),
  summary: z.string().transform((x) => x.slice(0, 80)),
  confidence: z.number().min(0).max(1),
});
const ResponseSchema = z.object({ events: z.array(z.unknown()) });
export type NaviEvent = Omit<z.infer<typeof EventSchema>, "kind"> & { kind: Kind } & { no: string; museum: string; pref: string; city: string; source_url: string; extracted_at: string };

function prompt(c: Change, part: string): string {
  const today = new Date().toISOString().slice(0, 10);
  return `次は博物館「${c.name}」（${c.pref}${c.city}）の公式ページから取り出した文章です。今日は${today}です。
この中から、今日以降に開催される催しを取り出し、JSONで返してください。

ルール:
- 対象は ${KINDS.join("／")} のいずれか。開館日・休館日・お知らせ・募集（作品募集など）・報告記事は含めない
- 開催日が読み取れないものは含めない。年が書かれていなければ、今日以降で最も近い日付と解釈する
- summary は原文を写さず、自分の言葉で40字程度にまとめる
- audience は対象の記載から当てはまる区分をすべて選ぶ（例：「小学生以上」→小学生低学年・小学生高学年・中高生・大人、「どなたでも」→親子・大人、「親子で」→親子）
- 分からない項目は null（reservation は "不明"、audience は空配列）
- confidence は日付と内容の読み取りに自信がある度合い（0〜1）

返す形: {"events":[{"title":"","kind":"","start_date":"YYYY-MM-DD","end_date":"YYYY-MM-DD"|null,"time":""|null,"audience":[],"fee":""|null,"reservation":"必要"|"不要"|"不明","summary":"","confidence":0.0}]}

--- 文章 ---
${part}`;
}

// 無料枠の1回あたりの上限に収まるよう、行の区切りで3,500字ずつに分ける
const PART_CHARS = 3500;
function splitParts(text: string): string[] {
  const parts: string[] = [];
  let cur = "";
  for (const line of text.split("\n")) {
    if (cur && cur.length + line.length > PART_CHARS) { parts.push(cur); cur = ""; }
    cur += (cur ? "\n" : "") + line.slice(0, PART_CHARS);
  }
  if (cur) parts.push(cur);
  return parts;
}

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

// "7.66s" や "1m2.5s" を秒に直す
function parseResetSeconds(v: string): number {
  const m = v.match(/(?:(\d+)m)?(?:([\d.]+)s)?/);
  return Number(m?.[1] ?? 0) * 60 + Number(m?.[2] ?? 0);
}

function postLlm(text: string, jsonMode: boolean): Promise<Response> {
  return fetch(`${BASE_URL}/chat/completions`, {
    method: "POST",
    headers: { Authorization: `Bearer ${API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: MODEL,
      temperature: 0,
      ...(jsonMode ? { response_format: { type: "json_object" } } : {}),
      messages: [{ role: "user", content: text }],
    }),
  });
}

async function callLlm(text: string, attempt = 0, jsonMode = true): Promise<unknown> {
  let res: Response;
  try {
    res = await postLlm(text, jsonMode);
  } catch (e) {
    // 通信が一時的に切れたときは、間をあけて再試行する
    if (attempt >= 3) throw e;
    await sleep(10_000 * (attempt + 1));
    return callLlm(text, attempt + 1, jsonMode);
  }
  // 無料枠の上限に当たったら、指示された秒数だけ待って再試行する
  if (res.status === 429 && attempt < 4) {
    const wait = Number(res.headers.get("retry-after") ?? "20");
    console.log(`  上限に到達。${wait}秒待って再試行`);
    await sleep((wait + 1) * 1000);
    return callLlm(text, attempt + 1, jsonMode);
  }
  // JSONモードで生成に失敗したら、形式指定なしで1回だけやり直す
  if (res.status === 400 && jsonMode) return callLlm(text, attempt, false);
  if (!res.ok) throw new Error(`LLM HTTP ${res.status}: ${(await res.text()).slice(0, 200)}`);
  // 1分あたりのトークン残量が少なければ、回復まで待つ
  const remaining = Number(res.headers.get("x-ratelimit-remaining-tokens") ?? "99999");
  const reset = res.headers.get("x-ratelimit-reset-tokens") ?? "";
  if (remaining < 4000) await sleep(Math.ceil(parseResetSeconds(reset) * 1000) + 500);
  const body = (await res.json()) as { choices?: { message?: { content?: string } }[] };
  const content = body.choices?.[0]?.message?.content ?? "{}";
  const json = content.slice(content.indexOf("{"), content.lastIndexOf("}") + 1);
  return JSON.parse(json || "{}");
}



async function main(): Promise<void> {
  if (!API_KEY) {
    console.log("LLM_API_KEY が未設定です。crawler/.env に LLM_API_KEY=... を書いてください（.env は .gitignore 済み）");
    return;
  }
  const dir = path.join(DATA, "crawl", "changes");
  const file = argValue("file") ?? path.join(dir, fs.readdirSync(dir).sort().at(-1) ?? "");
  const limit = Number(argValue("limit") ?? "0");
  let changes = JSON.parse(fs.readFileSync(file, "utf8")) as Change[];
  if (limit) changes = changes.slice(0, limit);
  const evDir = path.join(DATA, "events");
  fs.mkdirSync(evDir, { recursive: true });
  const review: { no: string; museum: string; reason: string; detail: string }[] = [];
  let total = 0;
  for (const c of changes) {
    try {
      const rawEvents: unknown[] = [];
      for (const part of splitParts(c.added)) {
        try {
          const parsed = ResponseSchema.safeParse(await callLlm(prompt(c, part)));
          if (parsed.success) rawEvents.push(...parsed.data.events);
          else review.push({ no: c.no, museum: c.name, reason: "形式エラー", detail: parsed.error.message.slice(0, 200) });
        } catch (e) {
          // 1つの分割で失敗しても、残りの分割は続ける
          review.push({ no: c.no, museum: c.name, reason: "LLMエラー", detail: e instanceof Error ? e.message.slice(0, 200) : String(e) });
        }
      }
      const now = new Date().toISOString();
      const fresh: NaviEvent[] = [];
      // 1件ずつ検査し、おかしな1件で館全体を捨てない
      for (const raw of rawEvents) {
        const ev = EventSchema.safeParse(raw);
        if (!ev.success) {
          review.push({ no: c.no, museum: c.name, reason: "形式エラー", detail: JSON.stringify(raw).slice(0, 200) });
          continue;
        }
        const kind = normalizeKind(ev.data.kind);
        if (!kind) {
          review.push({ no: c.no, museum: c.name, reason: "種類が不明", detail: `${ev.data.title}（${ev.data.kind}）` });
          continue;
        }
        // 終わった催しは載せない
        const today = new Date().toISOString().slice(0, 10);
        if ((ev.data.end_date ?? ev.data.start_date) < today) continue;
        fresh.push({ ...ev.data, kind, no: c.no, museum: c.name, pref: c.pref, city: c.city, source_url: c.url, extracted_at: now });
      }
      // 同じ館・同じ題名・同じ開始日は上書き
      const f = path.join(evDir, `${c.no}.json`);
      const old = fs.existsSync(f) ? (JSON.parse(fs.readFileSync(f, "utf8")) as NaviEvent[]) : [];
      const key = (e: NaviEvent) => `${e.title}|${e.start_date}`;
      const merged = new Map(old.map((e) => [key(e), e]));
      for (const e of fresh) merged.set(key(e), e);
      fs.writeFileSync(f, JSON.stringify([...merged.values()], null, 1));
      for (const e of fresh) if (e.confidence < 0.7) review.push({ no: c.no, museum: c.name, reason: "確度が低い", detail: `${e.title} ${e.start_date}` });
      total += fresh.length;
      console.log(`${c.name}: ${fresh.length}件`);
    } catch (e) {
      review.push({ no: c.no, museum: c.name, reason: "LLMエラー", detail: e instanceof Error ? e.message : String(e) });
    }
    await sleep(INTERVAL_MS);
  }
  const qf = path.join(DATA, "review", "queue.json");
  fs.mkdirSync(path.dirname(qf), { recursive: true });
  const queue = fs.existsSync(qf) ? (JSON.parse(fs.readFileSync(qf, "utf8")) as typeof review) : [];
  fs.writeFileSync(qf, JSON.stringify([...queue, ...review], null, 1));
  console.log(`抽出 ${total}件 / 要確認キュー追加 ${review.length}件`);
}

await main();
