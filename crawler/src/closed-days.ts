// 館の休館日：公式サイトのトップページと利用案内のページから「休館日」の記載を探して記録する
// 使い方: npm run closed-days -- [--all] [--concurrency 16]
//   既定は、サイトに催しが載っている館だけ。--all で巡回中の全館
// 出力: data/closed.json { No: { text, url, checkedAt } }。text は記載をそのまま短く切ったもの（意味の解釈はしない）
import fs from "node:fs";
import path from "node:path";
import * as cheerio from "cheerio";
import { politeFetch, mapLimit } from "./lib/http.js";
import { loadMaster, argValue } from "./lib/museums.js";
import { pageLines } from "./lib/text.js";
import { toHalfWidth } from "./lib/jpdate.js";
import { DATA } from "./lib/paths.js";

type Closed = { text: string; url: string; checkedAt: string };
const OUT = path.join(DATA, "closed.json");
const GUIDE = /利用案内|ご利用|施設案内|開館時間|休館日|ご来館|来館案内|アクセス|はじめて|guide|access|visit|info/i;
// 休館日の記載らしい値（曜日・年末年始・無休・祝日など）
const VALUE = /曜|年末|年始|無休|祝|休日|毎月|第\d|臨時|不定休|展示替/;
// 休館日の告知・カレンダーの見出しなど、決まった休館日ではない行
const NOT_RULE = /本日|明日|お知らせ|カレンダー|臨時休館のお知らせ|休館日を変更|休館します|でした|です|ます/;

// 記載を整える。先頭の記号を落とし、その月だけのお知らせの文は使わない
export function cleanClosed(v: string): string | null {
  const t = v.replace(/^[】\]）)」、,。・:：\s]+/, "").trim();
  if (t.length < 3 || NOT_RULE.test(t) || !VALUE.test(t)) return null;
  return t;
}

function find(lines: string[]): string | null {
  for (const [i, raw] of lines.entries()) {
    const line = toHalfWidth(raw).replace(/\s+/g, " ").trim();
    const m = line.match(/(休館日|定休日)\s*[:：]?\s*(.*)$/);
    if (!m || NOT_RULE.test(line)) continue;
    let value = (m[2] ?? "").replace(/^[はが:：\s]+/, "").trim();
    // 「休館日」だけの行は、次の行に中身がある書き方
    if (value.length < 3) value = toHalfWidth(lines[i + 1] ?? "").replace(/\s+/g, " ").trim();
    const clean = cleanClosed(value);
    if (!clean) continue;
    return clean.length > 70 ? `${clean.slice(0, 70)}…` : clean;
  }
  return null;
}

function guideLinks(html: string, pageUrl: string): string[] {
  const $ = cheerio.load(html);
  const base = new URL(pageUrl);
  const host = (h: string) => h.replace(/^www\./, "");
  const out = new Set<string>();
  $("a[href]").each((_, el) => {
    const text = `${$(el).text()} ${$(el).attr("href") ?? ""}`;
    if (!GUIDE.test(text)) return;
    try {
      const u = new URL($(el).attr("href") ?? "", base);
      u.hash = "";
      if (/^https?:$/.test(u.protocol) && host(u.host) === host(base.host) && !/\.(pdf|jpe?g|png)$/i.test(u.pathname)) out.add(u.href);
    } catch {
      /* 壊れたリンクは無視 */
    }
  });
  // 利用案内・休館日・開館時間らしいものを先に、3件まで
  const rank = (u: string) => (/guide|riyou|riyo|annai|kaikan|kyukan|opening|hours|visit/i.test(u) ? 0 : 1);
  return [...out].sort((a, b) => rank(a) - rank(b)).slice(0, 3);
}

async function main(): Promise<void> {
  const conc = Number(argValue("concurrency") ?? "16");
  const live = new Set((JSON.parse(fs.readFileSync(path.join(DATA, "site", "museums.json"), "utf8")) as { no: string }[]).map((m) => m.no));
  const targets = loadMaster().filter((r) => (r["確認URL"] ?? "").startsWith("http") && r["接続"] === "OK" && (process.argv.includes("--all") || live.has(r["No."] ?? "")));
  const done: Record<string, Closed> = fs.existsSync(OUT) ? JSON.parse(fs.readFileSync(OUT, "utf8")) : {};
  console.log(`休館日を調べる館 ${targets.length}館`);
  let n = 0, found = 0;
  await mapLimit(targets, conc, async (r) => {
    const no = r["No."] ?? "";
    const top = await politeFetch(r["確認URL"] ?? "");
    let hit: Closed | null = null;
    if (top.ok) {
      const t = find(pageLines(top.html));
      if (t) hit = { text: t, url: top.url, checkedAt: new Date().toISOString() };
      for (const u of hit ? [] : guideLinks(top.html, top.url)) {
        const p = await politeFetch(u);
        if (!p.ok) continue;
        const t2 = find(pageLines(p.html));
        if (t2) { hit = { text: t2, url: p.url, checkedAt: new Date().toISOString() }; break; }
      }
    }
    if (hit) { done[no] = hit; found++; }
    if (++n % 100 === 0) { fs.writeFileSync(OUT, JSON.stringify(done)); console.log(`  ${n}/${targets.length}（見つかった ${found}）`); }
  });
  fs.writeFileSync(OUT, JSON.stringify(done));
  console.log(`休館日が見つかった館 ${found}/${targets.length}`);
}

if (import.meta.url === `file://${process.argv[1]}`) await main();
