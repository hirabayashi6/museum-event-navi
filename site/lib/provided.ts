// 館から直接いただいた情報（content/provided.json）。巡回の結果より優先し、子ども向けかどうかの判定もかけない
// サイトのコードと一緒に置くので、自動実行のどの公開でも必ず載る（data/ は実行ごとに書き出し直されるため使わない）
import raw from "@/content/provided.json";
import { AUDIENCES, KINDS, type Museum, type NaviEvent } from "./types";

export const PROVIDED_METHOD = "館からの情報提供";

type ProvidedFile = { hide: string[]; museums: Museum[]; events: NaviEvent[] };

// JSON の文字列は型が広がるので、種類・対象・申込の値を確かめてから使う
function valid(e: NaviEvent): boolean {
  const kindOk = e.kind === null || (KINDS as readonly string[]).includes(e.kind);
  const audOk = e.audience.every((a) => (AUDIENCES as readonly string[]).includes(a));
  const resOk = ["必要", "不要", "不明"].includes(e.reservation);
  return kindOk && audOk && resOk && /^\d{4}-\d{2}-\d{2}$/.test(e.start_date) && e.method === PROVIDED_METHOD;
}

const file = raw as unknown as ProvidedFile;
export const providedEvents: NaviEvent[] = file.events.filter(valid);
export const providedMuseums: Museum[] = file.museums;
const hidden = new Set(file.hide);

// 巡回で拾った催しから、隠すIDと、館の情報と同じ館・同じ題名・同じ開始日のものを除いて、館の情報を足す
export function mergeProvided(rows: NaviEvent[]): NaviEvent[] {
  const key = (e: NaviEvent) => `${e.no}|${e.title}|${e.start_date}`;
  const own = new Set(providedEvents.map(key));
  return [...rows.filter((e) => !hidden.has(e.id) && !own.has(key(e))), ...providedEvents];
}

export const isProvided = (e: NaviEvent) => e.method === PROVIDED_METHOD;
