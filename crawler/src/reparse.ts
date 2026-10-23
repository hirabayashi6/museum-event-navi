// 保存済みのイベントページを、いまの読み取り方で読み直す（読み取りの決まりを直したあとに使う）
// すでにある催しと同じ日付で題名が似ているものは足さない（二重に載せない）
// 使い方: npx tsx src/reparse.ts
import fs from "node:fs";
import path from "node:path";
import { loadMaster } from "./lib/museums.js";
import { DATA } from "./lib/paths.js";
import { similar } from "./lib/sns.js";
import { structure, type NaviEvent } from "./structure.js";

const snapDir = path.join(DATA, "crawl", "snapshots");
const evDir = path.join(DATA, "events");
const master = new Map(loadMaster().map((r) => [r["No."] ?? "", r]));
let added = 0;
for (const f of fs.readdirSync(snapDir)) {
  const no = f.replace(/(-ex)?\.txt$/, "");
  const r = master.get(no);
  if (!r) continue;
  const fresh = structure({ no, name: r["博物館名"] ?? "", pref: r["都道府県"] ?? "", city: r["市町村"] ?? "", url: r[f.includes("-ex") ? "展覧会ページURL" : "イベントページURL"]?.split(/\s+/)[0] ?? "", first: true, added: fs.readFileSync(path.join(snapDir, f), "utf8") });
  if (!fresh.length) continue;
  const file = path.join(evDir, `${no}.json`);
  const old = fs.existsSync(file) ? (JSON.parse(fs.readFileSync(file, "utf8")) as NaviEvent[]) : [];
  const keep = [...old];
  for (const e of fresh) {
    if (keep.some((o) => o.id === e.id || (o.start_date === e.start_date && similar(o.title, e.title)))) continue;
    keep.push(e);
    added++;
  }
  if (keep.length !== old.length) fs.writeFileSync(file, JSON.stringify(keep, null, 1));
}
console.log(`読み直して足した催し ${added}件`);
