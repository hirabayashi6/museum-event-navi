// 精度の照合：掲載中のイベントについて元のページを読み直し、題名と開催日がそのページに書かれているかを確かめる
// 使い方: npm run verify -- [--sample 200] [--concurrency 12]
// 出力: data/verify.json { id: { title: true|false, date: true|false, url, checkedAt } } と、正しく取れている割合
import fs from "node:fs";
import path from "node:path";
import { politeFetch, mapLimit } from "./lib/http.js";
import { argValue } from "./lib/museums.js";
import { pageLines } from "./lib/text.js";
import { findDates, toHalfWidth } from "./lib/jpdate.js";
import { DATA } from "./lib/paths.js";
import type { NaviEvent } from "./structure.js";

type Check = { title: boolean; date: boolean; url: string; checkedAt: string };
const OUT = path.join(DATA, "verify.json");

// 記号・空白・かっこを落として比べる
const norm = (s: string) => toHalfWidth(s).replace(/[\s　「」『』【】［］\[\]（）()〈〉《》"'“”‘’・、。,.:：!！?？~〜～\-ー―]/g, "").toLowerCase();

// 題名が本文にあるか。完全に含まれなくても、題名の2文字の組の8割以上が本文にあれば合格
function titleFound(title: string, text: string): boolean {
  const t = norm(title);
  if (!t) return false;
  if (text.includes(t)) return true;
  const grams = new Set<string>();
  for (let i = 0; i < t.length - 1; i++) grams.add(t.slice(i, i + 2));
  if (!grams.size) return false;
  let hit = 0;
  for (const g of grams) if (text.includes(g)) hit++;
  return hit / grams.size >= 0.8;
}

async function main(): Promise<void> {
  const sample = Number(argValue("sample") ?? "0");
  const conc = Number(argValue("concurrency") ?? "12");
  let events = JSON.parse(fs.readFileSync(path.join(DATA, "site", "events.json"), "utf8")) as NaviEvent[];
  // Instagram の投稿は外から読み直せない（ログインが必要）ので、照合の対象から外す
  events = events.filter((e) => e.method !== "Instagram");
  if (sample) events = events.sort(() => Math.random() - 0.5).slice(0, sample);
  // 同じページの読み直しは1回にまとめる
  const byUrl = new Map<string, NaviEvent[]>();
  for (const e of events) byUrl.set(e.source_url, [...(byUrl.get(e.source_url) ?? []), e]);
  console.log(`照合するイベント ${events.length}件（ページ ${byUrl.size}件）`);
  const out: Record<string, Check> = {};
  let n = 0;
  await mapLimit([...byUrl.entries()], conc, async ([url, evs]) => {
    const res = await politeFetch(url);
    const lines = res.ok ? pageLines(res.html) : [];
    const text = norm(lines.join(""));
    const dates = new Set(lines.flatMap((l) => findDates(l).map((h) => h.date)));
    const now = new Date().toISOString();
    for (const e of evs) {
      // 開催中の展示は終了日だけが書かれていることもあるので、開始日か終了日のどちらかがあれば合格
      const dateOk = dates.has(e.start_date) || (e.end_date ? dates.has(e.end_date) : false);
      out[e.id] = { title: res.ok && titleFound(e.title, text), date: res.ok && dateOk, url, checkedAt: now };
    }
    if (++n % 100 === 0) console.log(`  ${n}/${byUrl.size}`);
  });
  fs.writeFileSync(OUT, JSON.stringify(out));
  const v = Object.values(out);
  const pct = (x: number) => `${Math.round((x / v.length) * 100)}%`;
  console.log(`題名が合う ${pct(v.filter((x) => x.title).length)} / 日付が合う ${pct(v.filter((x) => x.date).length)} / 両方合う ${pct(v.filter((x) => x.title && x.date).length)} / 両方合わない ${pct(v.filter((x) => !x.title && !x.date).length)}（${v.length}件）`);
}

await main();
