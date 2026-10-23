// データの読み出し。EVENTS_FROM_SUPABASE=1 なら Supabase から、なければ同梱の data/*.json から読む
import fs from "node:fs/promises";
import path from "node:path";
import type { Museum, NaviEvent } from "./types";
import { todayJst } from "./dates";
import { isKidFriendly } from "./kids";

const REVALIDATE_SECONDS = 600;

async function fromSupabase<T>(table: string, query: string): Promise<T[] | null> {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_ANON_KEY;
  // イベントの読み先は EVENTS_FROM_SUPABASE=1 のときだけ Supabase にする（鍵は「親御さんの声」でも使うため）
  if (!url || !key || process.env.EVENTS_FROM_SUPABASE !== "1") return null;
  const res = await fetch(`${url}/rest/v1/${table}?${query}`, {
    // 新形式のキー（sb_…）は apikey ヘッダーだけ、旧形式（JWT）は Authorization も付ける
    headers: key.startsWith("eyJ") ? { apikey: key, Authorization: `Bearer ${key}` } : { apikey: key },
    next: { revalidate: REVALIDATE_SECONDS, tags: [table] },
  });
  if (!res.ok) throw new Error(`Supabase ${table}: HTTP ${res.status}`);
  return (await res.json()) as T[];
}

async function fromFile<T>(name: string): Promise<T[]> {
  const raw = await fs.readFile(path.join(process.cwd(), "data", name), "utf8").catch(() => "[]");
  return JSON.parse(raw) as T[];
}

export async function getEvents(): Promise<NaviEvent[]> {
  const today = todayJst();
  const rows =
    (await fromSupabase<NaviEvent>("events", `select=*&last_date=gte.${today}&order=start_date.asc&limit=20000`)) ??
    (await fromFile<NaviEvent>("events.json"));
  // 館のジャンル（色分けに使う）が無いデータには、館の一覧から補う
  const ms = await getMuseums();
  const museums = new Map(ms.map((m) => [m.no, m.category]));
  const amen = new Map(ms.map((m) => [m.no, m.amen]));
  // このサイトは子どものいる家族向け：子どもと行けるイベントだけを載せる
  return rows
    .filter((e) => (e.end_date ?? e.start_date) >= today)
    .map((e) => ({ ...e, category: e.category || (museums.get(e.no) ?? ""), amen: amen.get(e.no) }))
    .filter(isKidFriendly);
}

export async function getMuseums(): Promise<Museum[]> {
  return (await fromSupabase<Museum>("museums", "select=*&limit=10000")) ?? (await fromFile<Museum>("museums.json"));
}

export async function getEvent(id: string): Promise<NaviEvent | undefined> {
  return (await getEvents()).find((e) => e.id === id);
}

export async function getMuseum(no: string): Promise<Museum | undefined> {
  return (await getMuseums()).find((m) => m.no === no);
}

export type Stats = { monitored: number; events: number; museums: number; updated_at: string };

export async function getStats(): Promise<Stats | null> {
  const raw = await fs.readFile(path.join(process.cwd(), "data", "stats.json"), "utf8").catch(() => "");
  return raw ? (JSON.parse(raw) as Stats) : null;
}
