// 日本語の日付表現を YYYY-MM-DD に直す。年がなければ「今日の30日前〜11か月後」に入る年を当てる

const WAREKI: Record<string, number> = { 令和: 2018, 平成: 1988 };

export function toHalfWidth(s: string): string {
  return s
    .replace(/[０-９]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0xfee0))
    .replace(/[／]/g, "/")
    .replace(/[．]/g, ".")
    .replace(/[〜～]/g, "～")
    .replace(/[：]/g, ":");
}

const pad = (n: number) => String(n).padStart(2, "0");

function iso(y: number, m: number, d: number): string | null {
  if (m < 1 || m > 12 || d < 1 || d > 31) return null;
  const dt = new Date(Date.UTC(y, m - 1, d));
  if (dt.getUTCMonth() !== m - 1) return null;
  return `${y}-${pad(m)}-${pad(d)}`;
}

// 年のない日付は「今日の60日前〜180日後」に入る年とみなす。どちらの年でも入らなければ過去の話として捨てる
function guessYear(m: number, d: number, today: Date): number | null {
  for (const y of [today.getFullYear(), today.getFullYear() + 1, today.getFullYear() - 1]) {
    const diffDays = (new Date(y, m - 1, d).getTime() - today.getTime()) / 86_400_000;
    if (diffDays >= -60 && diffDays <= 180) return y;
  }
  return null;
}

type Hit = { date: string; index: number; length: number; explicitYear: boolean };

// 文中の日付をすべて拾う
export function findDates(raw: string, today = new Date()): Hit[] {
  const s = toHalfWidth(raw);
  const hits: Hit[] = [];
  const taken: [number, number][] = [];
  const free = (i: number, len: number) => !taken.some(([a, b]) => i < b && i + len > a);
  const push = (date: string | null, i: number, len: number, explicitYear: boolean) => {
    if (!date || !free(i, len)) return;
    taken.push([i, i + len]);
    hits.push({ date, index: i, length: len, explicitYear });
  };
  // 令和8年11月14日
  for (const m of s.matchAll(/(令和|平成)\s*(\d{1,2}|元)\s*年\s*(\d{1,2})\s*月\s*(\d{1,2})\s*日/g)) {
    const base = WAREKI[m[1] ?? ""] ?? 2018;
    const ny = m[2] === "元" ? 1 : Number(m[2]);
    push(iso(base + ny, Number(m[3]), Number(m[4])), m.index ?? 0, m[0].length, true);
  }
  // 2026年11月14日 / 2026.11.14 / 2026/11/14 / 2026-11-14
  for (const m of s.matchAll(/(20\d{2})\s*[年./-]\s*(\d{1,2})\s*[月./-]\s*(\d{1,2})\s*日?/g)) {
    push(iso(Number(m[1]), Number(m[2]), Number(m[3])), m.index ?? 0, m[0].length, true);
  }
  // 11月14日 / 11/14
  for (const m of s.matchAll(/(?<![\d./])(\d{1,2})\s*(?:月\s*(\d{1,2})\s*日|\/(\d{1,2})(?![\d/]))/g)) {
    const mo = Number(m[1]);
    const d = Number(m[2] ?? m[3]);
    const y = guessYear(mo, d, today);
    if (y) push(iso(y, mo, d), m.index ?? 0, m[0].length, false);
    else taken.push([m.index ?? 0, (m.index ?? 0) + m[0].length]);
  }
  return hits.sort((a, b) => a.index - b.index);
}

// 「11月1日～11月29日」「10/17(土)～11/1(日)」のような範囲を開始・終了に分ける
export function parseRange(raw: string, today = new Date()): { start: string; end: string | null; explicitYear: boolean } | null {
  const hits = findDates(raw, today);
  const first = hits[0];
  if (!first) return null;
  const s = toHalfWidth(raw);
  const second = hits[1];
  if (second) {
    const between = s.slice(first.index + first.length, second.index);
    if (/^[^。\n]{0,12}[～\-ー―]|から|まで/.test(between) || /～/.test(between)) {
      // 年なしの終了日は開始日の年に合わせ、開始日より前なら翌年
      let end = second.explicitYear ? second.date : `${first.date.slice(0, 4)}${second.date.slice(4)}`;
      if (end < first.date) end = `${Number(end.slice(0, 4)) + 1}${end.slice(4)}`;
      return { start: first.date, end, explicitYear: first.explicitYear };
    }
  }
  // 「11月14日・15日」の2日目は扱わず、開始日のみ
  return { start: first.date, end: null, explicitYear: first.explicitYear };
}

export function timeOf(raw: string): string | null {
  const m = toHalfWidth(raw).match(/(\d{1,2})\s*[:時]\s*(\d{2})?\s*分?\s*[～\-ー]\s*(\d{1,2})\s*[:時]\s*(\d{2})?/);
  if (m) return `${m[1]}:${m[2] ?? "00"}～${m[3]}:${m[4] ?? "00"}`;
  const one = toHalfWidth(raw).match(/(\d{1,2})\s*[:時]\s*(\d{2})?/);
  return one ? `${one[1]}:${one[2] ?? "00"}～` : null;
}
