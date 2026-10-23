// 館の設備（授乳室・多目的トイレ・おむつ替え・ベビーカー貸出）を、公式サイトの利用案内などから探す
// 使い方: npm run amenities -- [--only-live] [--concurrency 12]
// 出力: data/amenities.json { No: { nursing, toilet, diaper, stroller, pages[], checkedAt } }
import fs from "node:fs";
import path from "node:path";
import * as cheerio from "cheerio";
import { politeFetch, mapLimit } from "./lib/http.js";
import { loadMaster, argValue } from "./lib/museums.js";
import { pageLines } from "./lib/text.js";
import { DATA } from "./lib/paths.js";

type Level = "確実" | "記載あり";
type Amenity = {
  nursing: boolean; toilet: boolean; diaper: boolean; stroller: boolean;
  level: Partial<Record<Key, Level>>; // 設備ごとの確かさ
  pages: string[]; evidence: string[]; checkedAt: string; v: number;
};
type Key = "nursing" | "toilet" | "diaper" | "stroller";
const VERSION = 2;
const OUT = path.join(DATA, "amenities.json");

// 利用案内・施設案内らしいリンク
const GUIDE_LINK = /利用案内|ご利用|施設案内|館内案内|館内マップ|フロアマップ|バリアフリー|設備|サービス|アクセス|来館|はじめて|よくある質問|FAQ|guide|facility|access|barrier/i;
const RULES: [Key, RegExp][] = [
  ["nursing", /授乳室|授乳スペース|授乳コーナー|授乳ルーム|ベビールーム|赤ちゃん休憩室|ベビーケアルーム/],
  ["toilet", /多目的トイレ|多機能トイレ|だれでもトイレ|誰でもトイレ|みんなのトイレ|バリアフリートイレ|車いす(用|対応)トイレ|車椅子(用|対応)トイレ/],
  ["diaper", /おむつ替え|オムツ替え|おむつ交換|オムツ交換|ベビーシート|ベビーベッド/],
  ["stroller", /ベビーカー(の)?(貸出|貸し出し|貸与|レンタル|あり|ございます|ご利用いただけ)/],
];
// 否定（前後30字）。「〜はありません」「なし」「×」など
const NEGATIVE = /(ありません|ございません|ない|無い|なし|無し|×|✕|設置していません|設置しておりません|ご用意(が|は)?(ありません|ございません|しておりません)|お断り|不可|ご遠慮)/;
// 問い合わせフォームの例文や、例示の行は数えない
const EXAMPLE = /（例|\(例|例[：:]|例えば|お問い合わせ内容|ご質問|ご要望|ご意見|入力して|選択して|チェック(を)?入れ/;
// そばにあれば「確実」とみなす言葉
const POSITIVE = /あり|有り|設置|ございます|完備|ご用意|ご利用(いただ|でき|ください)|使え|使用でき|◯|○|●/;
const GUIDE_PAGE = /利用案内|施設案内|館内案内|フロア|マップ|バリアフリー|設備|サービス|facility|guide|barrier|map/i;

function judge(lines: string[], isGuidePage: boolean): Pick<Amenity, Key | "evidence" | "level"> {
  const out = { nursing: false, toilet: false, diaper: false, stroller: false, level: {} as Partial<Record<Key, Level>>, evidence: [] as string[] };
  for (const line of lines) {
    if (EXAMPLE.test(line)) continue;
    for (const [key, re] of RULES) {
      const m = line.match(re);
      if (!m) continue;
      const at = m.index ?? 0;
      const around = line.slice(Math.max(0, at - 30), at + m[0].length + 30);
      if (NEGATIVE.test(around)) continue;
      // 確実：そばに「あり・設置」など。または案内ページで設備名だけの短い行（設備の一覧）
      const sure = POSITIVE.test(around) || (isGuidePage && line.length <= 25);
      const level: Level = sure ? "確実" : "記載あり";
      if (!out[key] || (level === "確実" && out.level[key] !== "確実")) {
        out.evidence = out.evidence.filter((x) => !x.startsWith(`${key}:`));
        out.evidence.push(`${key}: ${line.slice(0, 100)}`);
        out.level[key] = level;
      }
      out[key] = true;
    }
  }
  return out;
}

function merge(a: ReturnType<typeof judge>, b: ReturnType<typeof judge>): ReturnType<typeof judge> {
  const out = { ...a, level: { ...a.level }, evidence: [...a.evidence] };
  for (const k of ["nursing", "toilet", "diaper", "stroller"] as Key[]) {
    if (!b[k]) continue;
    if (!out[k] || (b.level[k] === "確実" && out.level[k] !== "確実")) {
      out.evidence = out.evidence.filter((x) => !x.startsWith(`${k}:`)).concat(b.evidence.filter((x) => x.startsWith(`${k}:`)));
      out.level[k] = b.level[k];
    }
    out[k] = true;
  }
  return out;
}

function guideLinks(html: string, pageUrl: string): string[] {
  const $ = cheerio.load(html);
  const base = new URL(pageUrl);
  const host = (h: string) => h.replace(/^www\./, "");
  const found = new Set<string>();
  $("a[href]").each((_, el) => {
    const text = `${$(el).text()} ${$(el).attr("title") ?? ""} ${$(el).attr("href") ?? ""}`;
    if (!GUIDE_LINK.test(text)) return;
    try {
      const u = new URL($(el).attr("href") ?? "", base);
      u.hash = "";
      if (/^https?:$/.test(u.protocol) && host(u.host) === host(base.host) && !/\.(pdf|jpe?g|png)$/i.test(u.pathname)) found.add(u.href);
    } catch {
      /* 壊れたリンクは無視 */
    }
  });
  // フロアマップ・バリアフリー・施設案内を優先して、8件まで
  const score = (u: string) => (/barrier|バリアフリー|floor|map|フロア|マップ/i.test(decodeURIComponent(u)) ? 0 : /guide|facility|利用|施設|館内/i.test(decodeURIComponent(u)) ? 1 : 2);
  return [...found].sort((a, b) => score(a) - score(b)).slice(0, 8);
}

async function main(): Promise<void> {
  const conc = Number(argValue("concurrency") ?? "12");
  const done: Record<string, Amenity> = fs.existsSync(OUT) ? JSON.parse(fs.readFileSync(OUT, "utf8")) : {};
  // 既定は、いま催しが載っている館だけ（家族が行く先として意味があるため）
  const live = new Set<string>(
    fs.existsSync(path.join(DATA, "site", "events.json")) ? (JSON.parse(fs.readFileSync(path.join(DATA, "site", "events.json"), "utf8")) as { no: string }[]).map((e) => e.no) : [],
  );
  const targets = loadMaster().filter((r) => {
    const no = r["No."] ?? "";
    // 古い判定（v1）は作り直す
    return (r["確認URL"] ?? "").startsWith("http") && r["接続"] === "OK" && (done[no]?.v ?? 0) < VERSION && (!process.argv.includes("--only-live") || live.has(no));
  });
  console.log(`設備を調べる館 ${targets.length}館（済み ${Object.keys(done).length}館）`);
  let n = 0;
  await mapLimit(targets, conc, async (r) => {
    const no = r["No."] ?? "";
    const top = await politeFetch(r["確認URL"] ?? "");
    const pages: string[] = [];
    let result = judge([], false);
    if (top.ok) {
      pages.push(top.url);
      result = judge(pageLines(top.html), GUIDE_PAGE.test(top.url));
      for (const u of guideLinks(top.html, top.url)) {
        const p = await politeFetch(u);
        if (!p.ok) continue;
        pages.push(p.url);
        result = merge(result, judge(pageLines(p.html), true));
      }
    }
    done[no] = { ...result, pages, checkedAt: new Date().toISOString(), v: VERSION };
    if (++n % 50 === 0) { fs.writeFileSync(OUT, JSON.stringify(done)); console.log(`  ${n}/${targets.length}`); }
  });
  fs.writeFileSync(OUT, JSON.stringify(done));
  const v = Object.values(done);
  for (const k of ["nursing", "toilet", "diaper", "stroller"] as Key[]) {
    console.log(`${k}: 確実 ${v.filter((x) => x.level?.[k] === "確実").length} / 記載あり ${v.filter((x) => x[k] && x.level?.[k] === "記載あり").length}`);
  }
  console.log(`調べた館 ${v.length}`);
}

await main();
