"use client";
// 都道府県を選んだら、すぐ一覧を切り替える
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { PREFS } from "@/lib/types";
import type { Lang } from "@/lib/i18n-client";

const EN = ["Hokkaido","Aomori","Iwate","Miyagi","Akita","Yamagata","Fukushima","Ibaraki","Tochigi","Gunma","Saitama","Chiba","Tokyo","Kanagawa","Niigata","Toyama","Ishikawa","Fukui","Yamanashi","Nagano","Gifu","Shizuoka","Aichi","Mie","Shiga","Kyoto","Osaka","Hyogo","Nara","Wakayama","Tottori","Shimane","Okayama","Hiroshima","Yamaguchi","Tokushima","Kagawa","Ehime","Kochi","Fukuoka","Saga","Nagasaki","Kumamoto","Oita","Miyazaki","Kagoshima","Okinawa"];

export function PrefSelect({ current, allLabel, lang }: { current: string; allLabel: string; lang: Lang }) {
  const router = useRouter();
  const path = usePathname();
  const params = useSearchParams();
  return (
    <select
      className="fb-select"
      value={current}
      aria-label={allLabel}
      onChange={(ev) => {
        document.cookie = `navi_pref=${encodeURIComponent(ev.target.value)}; path=/; max-age=31536000; samesite=lax`;
        const p = new URLSearchParams(params.toString());
        p.delete("page");
        p.set("pref", ev.target.value);
        router.push(`${path}?${p.toString()}`, { scroll: false });
      }}
    >
      <option value="">{allLabel}</option>
      {PREFS.map((p, i) => <option key={p} value={p}>{lang === "en" ? EN[i] : p}</option>)}
    </select>
  );
}
