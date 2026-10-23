// 日付はすべて日本時間で扱う
import { isHoliday } from "./holidays";
const JST = 9 * 60 * 60 * 1000;
const DAY = 86_400_000;

export function todayJst(): string {
  return new Date(Date.now() + JST).toISOString().slice(0, 10);
}

function addDays(iso: string, n: number): string {
  return new Date(Date.parse(`${iso}T00:00:00Z`) + n * DAY).toISOString().slice(0, 10);
}

function weekday(iso: string): number {
  return new Date(`${iso}T00:00:00Z`).getUTCDay();
}

// お休みの日＝土日・祝日。今日から見て次のお休みのかたまり（例：土日月の三連休、平日の祝日）を返す
// offsetWeeks=1 は、その次のかたまり
export function isOffDay(iso: string): boolean {
  const w = weekday(iso);
  return w === 0 || w === 6 || isHoliday(iso);
}

export function weekend(offsetWeeks = 0): { from: string; to: string } {
  let d = todayJst();
  let block: { from: string; to: string } | null = null;
  for (let n = 0; n <= offsetWeeks; n++) {
    if (block) d = addDays(block.to, 1);
    while (!isOffDay(d)) d = addDays(d, 1);
    let end = d;
    while (isOffDay(addDays(end, 1))) end = addDays(end, 1);
    block = { from: d, to: end };
  }
  return block ?? { from: d, to: d };
}

// 今日・明日（平日に旅行先で探す人向け）
export function dayRange(offset: number): { from: string; to: string } {
  const d = addDays(todayJst(), offset);
  return { from: d, to: d };
}

export const SEASONS = {
  春休み: (y: number) => ({ from: `${y}-03-20`, to: `${y}-04-07` }),
  GW: (y: number) => ({ from: `${y}-04-29`, to: `${y}-05-06` }),
  夏休み: (y: number) => ({ from: `${y}-07-20`, to: `${y}-08-31` }),
  冬休み: (y: number) => ({ from: `${y}-12-25`, to: `${y + 1}-01-07` }),
} as const;
export type Season = keyof typeof SEASONS;

export function seasonRange(s: Season): { from: string; to: string } {
  const t = todayJst();
  const y = Number(t.slice(0, 4));
  const r = SEASONS[s](y);
  return r.to < t ? SEASONS[s](y + 1) : r;
}

export function overlaps(start: string, end: string | null, from: string, to: string): boolean {
  return start <= to && (end ?? start) >= from;
}

const WD = ["日", "月", "火", "水", "木", "金", "土"];
export function jaDate(iso: string): string {
  const [, m, d] = iso.split("-");
  return `${Number(m)}月${Number(d)}日（${WD[weekday(iso)]}）`;
}

export function jaRange(start: string, end: string | null): string {
  if (!end || end === start) return jaDate(start);
  return `${jaDate(start)}〜${jaDate(end)}`;
}
