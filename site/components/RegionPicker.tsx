"use client";
// トップの「どこで？」。地方ごとにまとめた選択欄で県を選ぶと、その県を覚えてトップを切り替える（全国に戻すこともできる）
// 「現在地から選ぶ」を押したときだけ位置情報を使う（ページを開いただけでは尋ねない）
import { useState } from "react";
import { useRouter } from "next/navigation";
import { currentPosition, prefFromPosition } from "@/lib/geo-pref";

export type RegionRow = { label: string; prefs: { value: string; text: string; count: number }[] };
type GeoLabels = { pick: string; busy: string; fail: string; outside: string };

const remember = (v: string) => { document.cookie = `navi_pref=${encodeURIComponent(v)}; path=/; max-age=31536000; samesite=lax`; };

export function RegionPicker({ rows, current, allLabel, allCount, geo }: { rows: RegionRow[]; current: string; allLabel: string; allCount: number; geo: GeoLabels }) {
  const router = useRouter();
  const [msg, setMsg] = useState("");
  const pick = (v: string) => { remember(v); router.refresh(); };
  const locate = async () => {
    setMsg(geo.busy);
    try {
      const pos = await currentPosition();
      const pref = await prefFromPosition(pos.coords.latitude, pos.coords.longitude);
      if (!pref) { setMsg(geo.outside); return; }
      setMsg("");
      pick(pref);
    } catch {
      setMsg(geo.fail);
    }
  };
  return (
    <div className="region-wrap">
      <select className="region-select" value={current} aria-label={allLabel} onChange={(ev) => pick(ev.target.value)}>
        <option value="">{allLabel}（{allCount}）</option>
        {rows.map((r) => (
          <optgroup key={r.label} label={r.label}>
            {r.prefs.map((p) => <option key={p.value} value={p.value}>{p.text}（{p.count}）</option>)}
          </optgroup>
        ))}
      </select>
      <button type="button" className="geo-btn" onClick={locate}>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" aria-hidden="true"><circle cx="12" cy="12" r="4" /><path d="M12 2v3M12 19v3M2 12h3M19 12h3" /></svg>
        {geo.pick}
      </button>
      {msg && <p className="note geo-msg" role="status">{msg}</p>}
    </div>
  );
}
