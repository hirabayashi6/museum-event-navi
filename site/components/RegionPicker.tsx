"use client";
// トップの「どこで？」。地方ごとにまとめた選択欄で県を選ぶと、その県を覚えてトップを切り替える（全国に戻すこともできる）
import { useRouter } from "next/navigation";

export type RegionRow = { label: string; prefs: { value: string; text: string; count: number }[] };

const remember = (v: string) => { document.cookie = `navi_pref=${encodeURIComponent(v)}; path=/; max-age=31536000; samesite=lax`; };

export function RegionPicker({ rows, current, allLabel, allCount }: { rows: RegionRow[]; current: string; allLabel: string; allCount: number }) {
  const router = useRouter();
  return (
    <select className="region-select" value={current} aria-label={allLabel} onChange={(ev) => { remember(ev.target.value); router.refresh(); }}>
      <option value="">{allLabel}（{allCount}）</option>
      {rows.map((r) => (
        <optgroup key={r.label} label={r.label}>
          {r.prefs.map((p) => <option key={p.value} value={p.value}>{p.text}（{p.count}）</option>)}
        </optgroup>
      ))}
    </select>
  );
}
