// 礼儀正しい取得：robots.txt を守り、同じホストへは間隔をあけ、文字コードを判定して文字列で返す
import { parseRobots, type Robots } from "./robots.js";

export const USER_AGENT =
  "MuseumEventNaviBot/0.1 (+https://museumpick.com/legal/policy; info@museumpick.com)";
const BOT_NAME = "MuseumEventNaviBot";
const TIMEOUT_MS = 15_000;
const HOST_INTERVAL_MS = 2_000;

const robotsCache = new Map<string, Promise<Robots | null>>();
const lastHit = new Map<string, number>();

export type FetchResult =
  | { ok: true; url: string; status: number; html: string }
  | { ok: false; url: string; reason: "robots" | "http" | "network" | "not-html"; detail: string };

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

async function waitForHost(host: string): Promise<void> {
  // 同じホストへの連続アクセスを避ける
  for (;;) {
    const prev = lastHit.get(host) ?? 0;
    const wait = prev + HOST_INTERVAL_MS - Date.now();
    if (wait <= 0) break;
    await sleep(wait);
  }
  lastHit.set(host, Date.now());
}

async function rawGet(url: string): Promise<Response> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  try {
    return await fetch(url, {
      headers: { "User-Agent": USER_AGENT, Accept: "text/html,application/xhtml+xml,application/json" },
      redirect: "follow",
      signal: ctrl.signal,
    });
  } finally {
    clearTimeout(timer);
  }
}

function loadRobots(origin: string): Promise<Robots | null> {
  let p = robotsCache.get(origin);
  if (!p) {
    p = (async () => {
      const robotsUrl = `${origin}/robots.txt`;
      try {
        await waitForHost(new URL(origin).host);
        const res = await rawGet(robotsUrl);
        if (!res.ok) return null; // robots.txt なし＝制限なし
        return parseRobots(await res.text(), BOT_NAME);
      } catch {
        return null;
      }
    })();
    robotsCache.set(origin, p);
  }
  return p;
}

export async function robotsState(url: string): Promise<"許可" | "禁止" | "robots.txtなし"> {
  const robots = await loadRobots(new URL(url).origin);
  if (!robots) return "robots.txtなし";
  return !robots.isAllowed(url) ? "禁止" : "許可";
}

function detectCharset(contentType: string | null, head: string): string {
  const fromHeader = contentType?.match(/charset=["']?([\w-]+)/i)?.[1];
  const fromMeta = head.match(/<meta[^>]+charset=["']?([\w-]+)/i)?.[1];
  const cs = (fromHeader ?? fromMeta ?? "utf-8").toLowerCase();
  if (["shift_jis", "sjis", "x-sjis", "windows-31j", "cp932"].includes(cs)) return "shift_jis";
  if (["euc-jp", "x-euc-jp"].includes(cs)) return "euc-jp";
  return "utf-8";
}

export async function politeFetch(url: string, opts: { json?: boolean } = {}): Promise<FetchResult> {
  let target: URL;
  try {
    target = new URL(url);
  } catch {
    return { ok: false, url, reason: "network", detail: "URLの形式が不正" };
  }
  if ((await robotsState(url)) === "禁止") {
    return { ok: false, url, reason: "robots", detail: "robots.txtで禁止" };
  }
  try {
    await waitForHost(target.host);
    const res = await rawGet(url);
    if (!res.ok) return { ok: false, url, reason: "http", detail: `HTTP ${res.status}` };
    const ct = res.headers.get("content-type");
    if (ct && !(opts.json ? /json/i : /html|xml/i).test(ct)) return { ok: false, url, reason: "not-html", detail: ct };
    const buf = new Uint8Array(await res.arrayBuffer());
    const head = new TextDecoder("latin1").decode(buf.slice(0, 4096));
    const html = new TextDecoder(detectCharset(ct, head)).decode(buf);
    return { ok: true, url: res.url || url, status: res.status, html };
  } catch (e) {
    return { ok: false, url, reason: "network", detail: e instanceof Error ? e.message : String(e) };
  }
}

// 件数の多い処理を同時実行数を絞って回す
export async function mapLimit<T, R>(items: T[], limit: number, fn: (item: T, i: number) => Promise<R>): Promise<R[]> {
  const out = new Array<R>(items.length);
  let next = 0;
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (next < items.length) {
      const i = next++;
      out[i] = await fn(items[i] as T, i);
    }
  });
  await Promise.all(workers);
  return out;
}
