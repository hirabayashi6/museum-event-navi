// イメージ画像の選び方：館の種類×催しの種類 → 催しの種類の共通 → なければ手描き風の絵（null）
// 使える画像の一覧は public/images/manifest.json（画像を置いたらファイル名を足す）
import fs from "node:fs";
import path from "node:path";
import type { NaviEvent } from "./types";

const CAT: Record<string, string> = {
  歴史博物館: "hist", 美術博物館: "art", 科学博物館: "sci", 総合博物館: "gen", 野外博物館: "open",
  水族館: "aqua", 動物園: "zoo", 植物園: "bot", 動植物園: "zoo",
};
const KIND: Record<string, string> = {
  ワークショップ: "ws", "講座・公演・音楽イベント": "kz", ギャラリートーク: "gt", "観察会・野外": "ob", "特別展・企画展": "ex", 常設展: "pm",
};

let manifest: string[] | null = null;
function available(): string[] {
  // 開発中は画像を足したらすぐ反映されるよう、毎回読み直す
  if (!manifest || process.env.NODE_ENV === "development") {
    try {
      manifest = JSON.parse(fs.readFileSync(path.join(process.cwd(), "public", "images", "manifest.json"), "utf8")) as string[];
    } catch {
      manifest = [];
    }
  }
  return manifest;
}

function hash(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return h;
}

export function imageFor(e: NaviEvent): string | null {
  const k = e.kind ? KIND[e.kind] : undefined;
  if (!k) return null;
  const c = CAT[e.category ?? ""];
  const files = available();
  const pick = (prefix: string) => files.filter((f) => f.startsWith(`${prefix}-`)).sort();
  const pool = (c ? pick(`${c}-${k}`) : []).length ? pick(`${c}-${k}`) : pick(`any-${k}`);
  if (!pool.length) return null;
  return `/images/${pool[hash(e.id) % pool.length]}`;
}
