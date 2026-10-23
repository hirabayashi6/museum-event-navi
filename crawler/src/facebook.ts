// Facebookページの巡回：館の公開ページの最近の投稿から、これからある催しを拾う（Page Public Content Access を使う）
// 使い方: npm run facebook -- [--limit 300] [--only 1234] [--test]
//   --test … data/sns/fb_test_pages.json のページだけを読む（審査用の画面録画や動作確認。公開データには出さない）
// 出力: data/sns/facebook.json（ページの確認結果）、data/events/{No}.json（method "Facebook" の催し）
// 投稿の本文や写真は転載しない。催しの名前・日付などの事実と、元の投稿へのリンクだけを載せる
// 審査（Page Public Content Access）に通るまでは、アプリに役割を持つ人が管理するページしか読めない
import fs from "node:fs";
import path from "node:path";
import { loadMaster, argValue, type Row } from "./lib/museums.js";
import { DATA } from "./lib/paths.js";
import { sleep, load, daysAgo, isTheMuseum, readPosts, addEvents, usagePct, RECENT_DAYS, type SnsPost } from "./lib/sns.js";

if (fs.existsSync(".env")) process.loadEnvFile(".env");
// 審査用の新しいアプリの鍵があればそれを使い、なければ Instagram と同じ鍵を使う
const TOKEN = process.env.FB_TOKEN || process.env.META_TOKEN || "";
const V = process.env.META_API_VERSION ?? "v24.0";
const INTERVAL_MS = Number(process.env.FB_INTERVAL_MS ?? "10000");
const RECHECK_DAYS = 30;
const FILE = path.join(DATA, "sns", "facebook.json");
const CACHE = path.join(DATA, "sns", "fb_post_cache.json");
// 試験用のページ（名簿にない）。{ no: "test-…", page, name, pref, city, url }
const TEST_PAGES = path.join(DATA, "sns", "fb_test_pages.json");

type Status = "確認済" | "不一致" | "見つからない" | "権限待ち";
type Page = { page: string; id: string; status: Status; name: string; website: string; checkedAt: string; postsAt?: string };
type Store = Record<string, Page[]>;
type PageInfo = { id: string; name?: string; about?: string; website?: string };
type Post = { message?: string; created_time: string; permalink_url?: string };
type GraphError = { error?: { code?: number; message?: string } };

// 名簿の Facebook 列から、ページの名前（またはID）を取り出す
function pagesOf(cell: string): string[] {
  const out: string[] = [];
  for (const m of cell.matchAll(/facebook\.com\/(?:pages\/[^/\s]+\/)?(profile\.php\?id=\d+|[A-Za-z0-9.\-]{3,80})/g)) {
    const v = (m[1] ?? "").replace(/^profile\.php\?id=/, "").replace(/\.$/, "");
    if (!/^(sharer|sharer\.php|share|dialog|plugins|groups|events|watch|photo\.php|login|help|policies|tr)$/i.test(v)) out.push(v);
  }
  return [...new Set(out)];
}

let lastCall = 0;
async function graph<T>(pathAndQuery: string): Promise<T | "limit" | "offline" | "denied" | null> {
  const wait = lastCall + INTERVAL_MS - Date.now();
  if (wait > 0) await sleep(wait);
  lastCall = Date.now();
  const res = await fetch(`https://graph.facebook.com/${V}/${pathAndQuery}${pathAndQuery.includes("?") ? "&" : "?"}access_token=${TOKEN}`).catch(() => null);
  if (!res || res.status >= 500) return "offline";
  const pct = usagePct(res);
  if (pct >= 80) { console.log(`  使用率 ${pct}% のため15分休みます`); await sleep(15 * 60_000); }
  const body = (await res.json().catch(() => ({}))) as T & GraphError;
  if (body.error) {
    const code = body.error.code ?? 0;
    if ([4, 17, 32, 613].includes(code)) return "limit";
    if (code === 190) throw new Error("鍵（アクセストークン）が切れています。ops/save-meta-key.sh token で入れ直してください");
    // 審査で認められた機能（Page Public Content Access）がないと読めないページ
    if (code === 10 || (code === 100 && /permission|reviewable feature/i.test(body.error.message ?? ""))) return "denied";
    return null;
  }
  return body;
}

async function main(): Promise<void> {
  if (!TOKEN) { console.log("鍵がありません。ops/save-meta-key.sh で保存してください"); return; }
  const limit = Number(argValue("limit") ?? "300");
  const only = argValue("only");
  const test = process.argv.includes("--test");
  const store = load<Store>(FILE, {});
  // 調べる館とページの組。試験用は名簿の代わりに試験用ページを使う
  type Job = { r: Row; page: string; trusted: boolean };
  const jobs: Job[] = [];
  if (test) {
    for (const p of load<{ no: string; page: string; name: string; pref: string; city: string; url: string }[]>(TEST_PAGES, [])) {
      jobs.push({ r: { "No.": p.no, "博物館名": p.name, "都道府県": p.pref, "市町村": p.city, "確認URL": p.url }, page: p.page, trusted: true });
    }
  } else {
    const master = loadMaster().filter((r) => !only || r["No."] === only);
    const shared = new Map<string, number>();
    for (const r of master) for (const p of pagesOf(r["Facebook"] ?? "")) shared.set(p, (shared.get(p) ?? 0) + 1);
    for (const r of master) {
      const no = r["No."] ?? "";
      const ok = store[no]?.find((a) => a.status === "確認済");
      if (ok) { jobs.push({ r, page: ok.id || ok.page, trusted: true }); continue; }
      for (const p of pagesOf(r["Facebook"] ?? "")) {
        const prev = store[no]?.find((a) => a.page === p);
        // 権限待ちは、審査に通ったあと（次の実行）にすぐ試し直す
        if (prev && prev.status !== "権限待ち" && daysAgo(prev.checkedAt) < RECHECK_DAYS) continue;
        if ((shared.get(p) ?? 0) >= 3) continue; // 3館以上に付くページは観光協会などのことが多いので使わない
        jobs.push({ r, page: p, trusted: false });
      }
    }
  }
  const due = jobs.filter((j) => {
    const a = store[j.r["No."] ?? ""]?.find((x) => (x.id === j.page || x.page === j.page) && x.status === "確認済");
    return !a?.postsAt || daysAgo(a.postsAt) >= 0.8;
  });
  console.log(`Facebook：調べるページ ${due.length}件（今回は ${Math.min(limit, due.length)}件まで）`);

  const since = Math.floor((Date.now() - RECENT_DAYS * 86_400_000) / 1000);
  const posts: SnsPost[] = [];
  let calls = 0, denied = 0, offline = 0;
  for (const j of due) {
    if (calls >= limit) break;
    const no = j.r["No."] ?? "";
    const info = await graph<PageInfo>(`${encodeURIComponent(j.page)}?fields=id,name,about,website`);
    calls++;
    if (info === "limit") { console.log("Facebookの上限に達しました。続きは次回"); break; }
    if (info === "offline") { if (++offline >= 5) { console.log("通信できない状態が続くため中断"); break; } continue; }
    offline = 0;
    const now = new Date().toISOString();
    if (info === "denied") {
      store[no] = [...(store[no] ?? []).filter((a) => a.page !== j.page), { page: j.page, id: "", status: "権限待ち", name: "", website: "", checkedAt: now }];
      // 審査前は他館のページが一切読めないので、続けても無駄になる
      if (++denied >= 5 && !test) { console.log("審査で認められた機能（Page Public Content Access）がないため読めません。審査の通過後に再実行してください"); break; }
      continue;
    }
    const status: Status = !info ? "見つからない" : j.trusted || isTheMuseum(info, j.r, false) ? "確認済" : "不一致";
    const page: Page = { page: j.page, id: info?.id ?? "", status, name: info?.name ?? "", website: info?.website ?? "", checkedAt: now };
    if (info && status === "確認済") {
      const got = await graph<{ data?: Post[] }>(`${info.id}/posts?fields=message,created_time,permalink_url&since=${since}&limit=25`);
      calls++;
      if (got && typeof got === "object") {
        page.postsAt = now;
        for (const p of got.data ?? []) if (p.message && p.permalink_url) posts.push({ no, museum: j.r, text: p.message, at: p.created_time, url: p.permalink_url });
      }
    }
    store[no] = [...(store[no] ?? []).filter((a) => a.page !== j.page), page];
    if (calls % 25 === 0) fs.writeFileSync(FILE, JSON.stringify(store, null, 1));
  }
  fs.writeFileSync(FILE, JSON.stringify(store, null, 1));

  const { future, cache } = await readPosts("Facebook", posts, CACHE);
  const added = addEvents("Facebook", future, cache);
  const all = Object.values(store).flat();
  console.log(`催しを追加 ${added}件 ／ ページ：確認済 ${all.filter((a) => a.status === "確認済").length}・権限待ち ${all.filter((a) => a.status === "権限待ち").length}・不一致 ${all.filter((a) => a.status === "不一致").length}・見つからない ${all.filter((a) => a.status === "見つからない").length}`);
}

await main();
