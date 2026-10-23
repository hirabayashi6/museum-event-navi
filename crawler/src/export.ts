// 段階5 公開用データ：館ごとのイベントを1つにまとめ、サイトが読む形で書き出す
// SUPABASE_URL と SUPABASE_SERVICE_ROLE_KEY があれば Supabase にも反映し、サイトの再生成を依頼する
import fs from "node:fs";
import path from "node:path";
import { loadMaster } from "./lib/museums.js";
import { DATA } from "./lib/paths.js";
import type { NaviEvent } from "./structure.js";
import { rejectReason, cleanPublicTitle } from "./lib/quality.js";
import { cleanClosed } from "./closed-days.js";

if (fs.existsSync(".env")) process.loadEnvFile(".env");

export type SiteMuseum = { no: string; name: string; pref: string; city: string; category: string; url: string; instagram: string | null; closed?: string; amen?: { nursing: boolean; toilet: boolean; diaper: boolean; stroller: boolean } };

const today = new Date().toISOString().slice(0, 10);

function collect(): { events: NaviEvent[]; museums: SiteMuseum[] } {
  const evDir = path.join(DATA, "events");
  const events = fs.existsSync(evDir)
    ? fs.readdirSync(evDir).flatMap((f) => JSON.parse(fs.readFileSync(path.join(evDir, f), "utf8")) as NaviEvent[])
    : [];
  // 照合（verify.ts）で、元のページに題名も日付も見つからなかった催しは載せない。次の照合で見つかれば戻る
  const verifyFile = path.join(DATA, "verify.json");
  const checks = (fs.existsSync(verifyFile) ? JSON.parse(fs.readFileSync(verifyFile, "utf8")) : {}) as Record<string, { title: boolean; date: boolean }>;
  const unmatched = (e: NaviEvent) => { const c = checks[e.id]; return Boolean(c && !c.title && !c.date); };
  // 試験用（審査の画面録画など）の催しは、INCLUDE_TEST=1 のときだけ出す
  const includeTest = process.env.INCLUDE_TEST === "1";
  const current = events.filter((e) => (e.end_date ?? e.start_date) >= today && !unmatched(e) && (includeTest || !e.no.startsWith("test-")));
  console.log(`照合で外した催し ${events.filter((e) => (e.end_date ?? e.start_date) >= today && unmatched(e)).length}件`);
  // 公開の関門を通ったものだけを出し、落ちたものは要確認として残す
  const review = current.filter((e) => rejectReason(e)).map((e) => ({ ...e, reason: rejectReason(e) }));
  fs.mkdirSync(path.join(DATA, "review"), { recursive: true });
  fs.writeFileSync(path.join(DATA, "review", "rejected.json"), JSON.stringify(review, null, 1));
  // 画像を選ぶため、館の種類（歴史・美術など）を付ける
  const category = new Map(loadMaster().map((r) => [r["No."] ?? "", r["カテゴリ"] ?? ""]));
  const live = current
    .filter((e) => !rejectReason(e))
    // 元の文章（raw）は題名の作り直しにだけ使い、公開データには入れない
    .map(({ raw: _raw, ...e }) => ({ ...e, title: cleanPublicTitle(e.title), category: category.get(e.no) ?? "" }))
    .sort((a, b) => a.start_date.localeCompare(b.start_date));
  console.log(`公開 ${live.length}件 / 要確認 ${review.length}件`);
  const nos = new Set(live.map((e) => e.no));
  // 館の設備（授乳室など）。調べていない館は付けない
  const amenFile = path.join(DATA, "amenities.json");
  type AmenRaw = { nursing: boolean; toilet: boolean; diaper: boolean; stroller: boolean; level?: Partial<Record<"nursing" | "toilet" | "diaper" | "stroller", string>> };
  const rawAmen = (fs.existsSync(amenFile) ? JSON.parse(fs.readFileSync(amenFile, "utf8")) : {}) as Record<string, AmenRaw>;
  // 絞り込みボタンに使うのは「確実」（あり・設置などと書かれている、または利用案内の設備一覧にある）だけ
  const sure = (a: AmenRaw, k: "nursing" | "toilet" | "diaper" | "stroller") => a[k] && a.level?.[k] === "確実";
  const amen = Object.fromEntries(Object.entries(rawAmen).map(([no, a]) => [no, { nursing: sure(a, "nursing"), toilet: sure(a, "toilet"), diaper: sure(a, "diaper"), stroller: sure(a, "stroller") }]));
  // 休館日（公式サイトの記載を短く切ったもの）
  const closedFile = path.join(DATA, "closed.json");
  const closedRaw = (fs.existsSync(closedFile) ? JSON.parse(fs.readFileSync(closedFile, "utf8")) : {}) as Record<string, { text: string }>;
  const closed = new Map(Object.entries(closedRaw).map(([no, c]) => [no, cleanClosed(c.text)]));
  const museums: SiteMuseum[] = loadMaster()
    .filter((r) => nos.has(r["No."] ?? ""))
    .map((r) => ({
      no: r["No."] ?? "", name: r["博物館名"] ?? "", pref: r["都道府県"] ?? "", city: r["市町村"] ?? "",
      category: r["カテゴリ"] ?? "", url: r["確認URL"] ?? "",
      ...(closed.get(r["No."] ?? "") ? { closed: closed.get(r["No."] ?? "") ?? undefined } : {}),
      instagram: r["情報の確度"] === "機械（館サイト）" || r["情報の確度"]?.startsWith("人") ? (r["Instagram"] ?? "").split(" ")[0] || null : null,
      ...(amen[r["No."] ?? ""] ? { amen: { nursing: amen[r["No."] ?? ""]!.nursing, toilet: amen[r["No."] ?? ""]!.toilet, diaper: amen[r["No."] ?? ""]!.diaper, stroller: amen[r["No."] ?? ""]!.stroller } } : {}),
    }));
  if (includeTest) {
    const tests = (fs.existsSync(path.join(DATA, "sns", "fb_test_pages.json")) ? JSON.parse(fs.readFileSync(path.join(DATA, "sns", "fb_test_pages.json"), "utf8")) : []) as { no: string; name: string; pref: string; city: string; url: string }[];
    for (const t of tests) if (nos.has(t.no)) museums.push({ no: t.no, name: t.name, pref: t.pref, city: t.city, category: "", url: t.url, instagram: null });
  }
  return { events: live, museums };
}

async function pushSupabase(events: NaviEvent[], museums: SiteMuseum[]): Promise<void> {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return;
  const auth: Record<string, string> = key.startsWith("eyJ") ? { apikey: key, Authorization: `Bearer ${key}` } : { apikey: key };
  const headers = { ...auth, "Content-Type": "application/json", Prefer: "resolution=merge-duplicates" };
  const post = async (table: string, rows: unknown[]) => {
    for (let i = 0; i < rows.length; i += 500) {
      const res = await fetch(`${url}/rest/v1/${table}`, { method: "POST", headers, body: JSON.stringify(rows.slice(i, i + 500)) });
      if (!res.ok) throw new Error(`Supabase ${table}: HTTP ${res.status} ${(await res.text()).slice(0, 200)}`);
    }
  };
  await post("museums", museums);
  await post("events", events.map((e) => ({ ...e, last_date: e.end_date ?? e.start_date })));
  // 終わった催しを消す
  await fetch(`${url}/rest/v1/events?last_date=lt.${today}`, { method: "DELETE", headers });
  console.log(`Supabase に反映: 館 ${museums.length} / イベント ${events.length}`);
  // サイトに再生成を依頼（随時反映）
  const hook = process.env.SITE_REVALIDATE_URL;
  const secret = process.env.REVALIDATE_SECRET;
  if (hook && secret) {
    const r = await fetch(hook, { method: "POST", headers: { Authorization: `Bearer ${secret}` } });
    console.log(`サイトの再生成依頼: HTTP ${r.status}`);
  }
}

async function main(): Promise<void> {
  const { events, museums } = collect();
  const out = path.join(DATA, "site");
  fs.mkdirSync(out, { recursive: true });
  fs.writeFileSync(path.join(out, "events.json"), JSON.stringify(events));
  fs.writeFileSync(path.join(out, "museums.json"), JSON.stringify(museums));
  // 「すべて網羅」とは言わず、監視している館の数を公開する
  const monitored = loadMaster().filter((r) => (r["イベントページURL"] ?? "").startsWith("http")).length;
  const stats = { monitored, events: events.length, museums: museums.length, updated_at: new Date().toISOString() };
  fs.writeFileSync(path.join(out, "stats.json"), JSON.stringify(stats));
  // サイトに同梱する公開用データ（Supabase 未設定のときに使う）
  const siteData = path.resolve(DATA, "..", "site", "data");
  if (fs.existsSync(siteData)) for (const f of ["events.json", "museums.json", "stats.json"]) fs.copyFileSync(path.join(out, f), path.join(siteData, f));
  console.log(`公開用データ: 館 ${museums.length} / イベント ${events.length}`);
  await pushSupabase(events, museums);
}

await main();
