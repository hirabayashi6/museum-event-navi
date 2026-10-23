// Instagram の巡回：館のアカウントの最近の投稿から、これからある催しを拾う（Business Discovery を使う）
// 使い方: npm run instagram -- [--limit 300] [--guess] [--only 1234]
//   --guess … 名簿にアカウントがない館について、公式サイトのドメインからアカウント名を推測して試す
// 出力: data/sns/instagram.json（アカウントの確認結果）、data/events/{No}.json（method "Instagram" の催し）
// 投稿の本文や写真は転載しない。催しの名前・日付などの事実と、元の投稿へのリンクだけを載せる
import fs from "node:fs";
import path from "node:path";
import { loadMaster, argValue, type Row } from "./lib/museums.js";
import { DATA } from "./lib/paths.js";
import { sleep, load, daysAgo, host, norm, core, isTheMuseum, readPosts, addEvents, usagePct, RECENT_DAYS, type SnsPost } from "./lib/sns.js";

if (fs.existsSync(".env")) process.loadEnvFile(".env");
const TOKEN = process.env.META_TOKEN ?? "";
const IG_USER_ID = process.env.IG_USER_ID ?? "";
const V = process.env.META_API_VERSION ?? "v24.0";
// 1時間に200回までの上限があるので、既定は18秒に1回（1時間に200回弱）
const INTERVAL_MS = Number(process.env.IG_INTERVAL_MS ?? "18000");
const RECHECK_DAYS = 30; // 本人と確かめられなかったアカウントを試し直す間隔
const FILE = path.join(DATA, "sns", "instagram.json");
const CANDIDATES = path.join(DATA, "sns", "ig_candidates.json"); // 検索で見つけた候補 { No: ["username", ...] }
const CACHE = path.join(DATA, "sns", "ig_post_cache.json"); // 投稿ごとの読み取り結果（同じ投稿をLLMに二度送らない）

type Status = "確認済" | "不一致" | "見つからない";
type Source = "館サイト" | "親サイト" | "人が確認" | "検索" | "推測";
type Account = { username: string; status: Status; source: Source; name: string; website: string; followers: number; checkedAt: string; postsAt?: string };
type Store = Record<string, Account[]>; // No → 試したアカウント
type Post = { caption?: string; timestamp: string; permalink: string; media_type?: string };
type Profile = { username: string; name?: string; biography?: string; website?: string; followers_count?: number; media?: { data: Post[] } };

function usernamesOf(cell: string): string[] {
  return [...cell.matchAll(/instagram\.com\/([A-Za-z0-9._]{2,30})/g)].map((m) => (m[1] ?? "").replace(/\.$/, "").toLowerCase()).filter((u) => !["p", "reel", "explore", "stories", "accounts"].includes(u));
}

// 公式サイトのドメインから推測するアカウント名（例：m-art-center.jp → m_art_center）
function guesses(url: string): string[] {
  const parts = host(url).replace(/^www\d*\./, "").split(".");
  // 自治体のサイト（city.〇〇.lg.jp など）は館のドメインではないので推測しない
  if (/^(city|town|vill|pref|metro)$/.test(parts[0] ?? "") || parts.includes("lg")) return [];
  const n = parts.length;
  const label = (/^(co|or|ne|ac|go|gr|ed)$/.test(parts[n - 2] ?? "") ? parts[n - 3] : parts[n - 2]) ?? "";
  // レンタルサーバーの共用ドメインや、一般的すぎる名前は使わない
  if (label.length < 4 || /^(sakura|xsrv|lolipop|jimdo|wixsite|fc2|blogspot|github|google|museum|kanko|kankou|kyoiku)$/.test(label)) return [];
  const base = label.replace(/-/g, "_");
  return [...new Set([base, base.replace(/_/g, ""), `${base}_official`, `${base}.official`])].filter((u) => u.length <= 30);
}

let lastCall = 0;
// Business Discovery で1アカウントを取る。上限に近づいたら休み、使い切ったら "limit"
async function discover(username: string): Promise<Profile | null | "limit" | "offline"> {
  const wait = lastCall + INTERVAL_MS - Date.now();
  if (wait > 0) await sleep(wait);
  lastCall = Date.now();
  const fields = `business_discovery.username(${username}){username,name,biography,website,followers_count,media.limit(20){caption,timestamp,permalink,media_type}}`;
  const url = `https://graph.facebook.com/${V}/${IG_USER_ID}?fields=${encodeURIComponent(fields)}&access_token=${TOKEN}`;
  const res = await fetch(url).catch(() => null);
  if (!res || res.status >= 500) return "offline"; // 通信の失敗・Meta側の不調は「見つからない」と記録しない
  // 使用率（%）が8割を超えたら15分休む
  const pct = usagePct(res);
  if (pct >= 80) { console.log(`  使用率 ${pct}% のため15分休みます`); await sleep(15 * 60_000); }
  const body = (await res.json().catch(() => ({}))) as { business_discovery?: Profile; error?: { code?: number; error_subcode?: number; message?: string } };
  if (body.error) {
    const code = body.error.code ?? 0;
    if ([4, 17, 32, 613].includes(code)) return "limit";
    if (code === 190) throw new Error("鍵（アクセストークン）が切れています。ops/save-meta-key.sh token で入れ直してください");
    return null; // 存在しない・個人アカウント・非公開など
  }
  return body.business_discovery ?? null;
}

async function main(): Promise<void> {
  if (!TOKEN || !IG_USER_ID) { console.log("鍵がありません。ops/save-meta-key.sh で保存してください"); return; }
  const limit = Number(argValue("limit") ?? "300");
  const only = argValue("only");
  const store = load<Store>(FILE, {});
  const cands = load<Record<string, string[]>>(CANDIDATES, {});
  const master = loadMaster().filter((r) => !only || r["No."] === only);
  // 1つのアカウントが3館以上に付いているのは、親組織や観光協会のアカウントのことが多い
  const shared = new Map<string, number>();
  for (const r of master) for (const u of usernamesOf(r["Instagram"] ?? "")) shared.set(u, (shared.get(u) ?? 0) + 1);

  // 調べる館とアカウント名の組を作る
  type Job = { r: Row; username: string; source: Source };
  const jobs: Job[] = [];
  for (const r of master) {
    const no = r["No."] ?? "";
    const tried = store[no] ?? [];
    const ok = tried.find((a) => a.status === "確認済");
    if (ok) { jobs.push({ r, username: ok.username, source: ok.source }); continue; }
    const conf = r["情報の確度"] ?? "";
    const fromSite: Source = conf.startsWith("人") ? "人が確認" : conf.includes("親サイト") ? "親サイト" : "館サイト";
    const list: [string, Source][] = [
      ...usernamesOf(r["Instagram"] ?? "").map((u) => [u, fromSite] as [string, Source]),
      ...(cands[no] ?? []).map((u) => [u.toLowerCase(), "検索"] as [string, Source]),
      ...(process.argv.includes("--guess") && !usernamesOf(r["Instagram"] ?? "").length && !(cands[no] ?? []).length ? guesses(r["確認URL"] ?? "").map((u) => [u, "推測"] as [string, Source]) : []),
    ];
    for (const [u, source] of list) {
      const prev = tried.find((a) => a.username === u);
      if (prev && daysAgo(prev.checkedAt) < RECHECK_DAYS) continue;
      jobs.push({ r, username: u, source });
    }
  }
  // 確認済みは投稿を取り直す（1日1回）。新しい候補はそのあと
  const due = jobs.filter((j) => {
    const a = store[j.r["No."] ?? ""]?.find((x) => x.username === j.username && x.status === "確認済");
    return !a?.postsAt || daysAgo(a.postsAt) >= 0.8;
  });
  due.sort((a, b) => Number(Boolean(store[b.r["No."] ?? ""]?.some((x) => x.status === "確認済"))) - Number(Boolean(store[a.r["No."] ?? ""]?.some((x) => x.status === "確認済"))));
  console.log(`Instagram：調べる組 ${due.length}件（今回は ${Math.min(limit, due.length)}件まで、1件あたり約${Math.round(INTERVAL_MS / 1000)}秒）`);

  const fetched = new Map<string, Profile | null>(); // 同じアカウントは1回だけ取る
  const posts: SnsPost[] = [];
  let added = 0;
  // 1つのアカウントが複数の館で確認済なら、催しはアカウント名にいちばん近い館にだけ載せる（重複を防ぐ）
  const flush = async (batch: SnsPost[]): Promise<number> => {
    const owner = new Map<string, string>();
    const score = (no: string, username: string): number => {
      const r = master.find((x) => x["No."] === no);
      const acc = store[no]?.find((a) => a.username === username);
      const name = norm(acc?.name ?? ""), c = core(r?.["博物館名"] ?? "");
      return (name.includes(c) ? 100 : 0) - c.length; // 名前に呼び名がまるごと入る館を優先し、その中では短い名前（本館）を優先
    };
    for (const [no, accs] of Object.entries(store)) for (const a of accs) {
      if (a.status !== "確認済") continue;
      const cur = owner.get(a.username);
      if (!cur || score(no, a.username) > score(cur, a.username)) owner.set(a.username, no);
    }
    const usernameOf = (no: string) => store[no]?.find((a) => a.status === "確認済")?.username ?? "";
    const mine = batch.filter((x) => owner.get(usernameOf(x.no)) === x.no);
    const { future, cache } = await readPosts("Instagram", mine, CACHE);
    return addEvents("Instagram", future, cache);
  };
  let calls = 0;
  let offline = 0;
  for (const j of due) {
    if (calls >= limit) break;
    const no = j.r["No."] ?? "";
    let p = fetched.get(j.username);
    if (p === undefined) {
      const got = await discover(j.username);
      calls++;
      if (got === "limit") { console.log("Instagramの上限に達しました。続きは次回"); break; }
      if (got === "offline") { offline++; if (offline >= 5) { console.log("通信できない状態が続くため中断。続きは次回"); break; } continue; }
      offline = 0;
      p = got;
      fetched.set(j.username, p);
    }
    const strict = (shared.get(j.username) ?? 0) >= 3 || j.source === "推測";
    const status: Status = !p ? "見つからない" : isTheMuseum({ name: p.name, about: p.biography, website: p.website }, j.r, strict) ? "確認済" : "不一致";
    const acc: Account = { username: j.username, status, source: j.source, name: p?.name ?? "", website: p?.website ?? "", followers: p?.followers_count ?? 0, checkedAt: new Date().toISOString() };
    if (status === "確認済") {
      acc.postsAt = acc.checkedAt;
      for (const post of p?.media?.data ?? []) if (post.caption && daysAgo(post.timestamp) <= RECENT_DAYS) posts.push({ no, museum: j.r, text: post.caption, at: post.timestamp, url: post.permalink });
    }
    store[no] = [...(store[no] ?? []).filter((a) => a.username !== j.username), acc];
    if (calls % 25 === 0) { fs.writeFileSync(FILE, JSON.stringify(store, null, 1)); console.log(`  ${calls}件（投稿 ${posts.length}件）`); }
    // 途中で止まっても集めた投稿を失わないよう、100件ごとにイベント化して保存する
    if (calls % 100 === 0 && posts.length) { added += await flush(posts.splice(0)); }
  }
  fs.writeFileSync(FILE, JSON.stringify(store, null, 1));

  if (posts.length) added += await flush(posts.splice(0));
  const all = Object.values(store).flat();
  console.log(`催しを追加 ${added}件 ／ アカウント：確認済 ${all.filter((a) => a.status === "確認済").length}・不一致 ${all.filter((a) => a.status === "不一致").length}・見つからない ${all.filter((a) => a.status === "見つからない").length}`);
}

await main();
