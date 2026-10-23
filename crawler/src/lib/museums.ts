// 全国館マスタの読み書き。人が確認した値は機械で上書きしない
import fs from "node:fs";
import { parse } from "csv-parse/sync";
import { stringify } from "csv-stringify/sync";
import { MASTER_CSV, SOURCE_CSV } from "./paths.js";

export type Row = Record<string, string>;

export const MASTER_COLUMNS = [
  "No.", "都道府県", "市町村", "カテゴリ", "博物館名", "確認URL", "URL種別", "接続", "営業状況",
  "イベントページURL", "展覧会ページURL", "Instagram", "X", "Facebook", "自治体OD", "巡回可否(robots/規約)",
  "監視状態", "情報の確度", "備考",
] as const;

export function readCsv(file: string): Row[] {
  const text = fs.readFileSync(file, "utf8").replace(/^﻿/, "");
  return parse(text, { columns: true, skip_empty_lines: true }) as Row[];
}

export function loadMaster(): Row[] {
  const rows = readCsv(MASTER_CSV);
  // 元データの URL種別・接続 を足す（初回のみ必要）
  // 元データ（営業リスト）は手元にしかないので、なければ使わない（GitHub の自動実行など）
  const src = new Map((fs.existsSync(SOURCE_CSV) ? readCsv(SOURCE_CSV) : []).map((r) => [r["No."] ?? "", r]));
  for (const r of rows) {
    const s = src.get(r["No."] ?? "");
    for (const c of MASTER_COLUMNS) r[c] ??= "";
    if (s) {
      if (!r["URL種別"]) r["URL種別"] = s["URL種別"] ?? "";
      if (!r["接続"]) r["接続"] = s["接続"] ?? "";
    }
  }
  return rows;
}

export function saveMaster(rows: Row[]): void {
  const body = stringify(rows, { header: true, columns: [...MASTER_COLUMNS] });
  const tmp = `${MASTER_CSV}.tmp`;
  fs.writeFileSync(tmp, "﻿" + body);
  fs.renameSync(tmp, MASTER_CSV);
}

export function isCrawlable(r: Row): boolean {
  return (r["確認URL"] ?? "").startsWith("http") && r["接続"] === "OK";
}

export function argValue(name: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? process.argv[i + 1] : undefined;
}
