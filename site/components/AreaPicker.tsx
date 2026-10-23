"use client";
// 「近くで」に応える地域の選択。選んだ県は端末とクッキーに覚え、トップを自分の県で表示する
import { useRouter } from "next/navigation";
import { PREFS } from "@/lib/types";

export function AreaPicker({ current, label, allLabel }: { current: string; label: string; allLabel: string }) {
  const router = useRouter();
  return (
    <label className="area">
      <span>{label}</span>
      <select
        value={current}
        onChange={(ev) => {
          const v = ev.target.value;
          document.cookie = `navi_pref=${encodeURIComponent(v)}; path=/; max-age=31536000; samesite=lax`;
          router.refresh();
        }}
      >
        <option value="">{allLabel}</option>
        {PREFS.map((p) => <option key={p}>{p}</option>)}
      </select>
    </label>
  );
}
