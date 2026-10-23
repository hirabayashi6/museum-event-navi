import Link from "next/link";
import type { Query } from "@/lib/filters";
import { WANTS, type Want } from "@/lib/types";
import { t, wantLabel, type Lang, type UIKey } from "@/lib/i18n";
import { PrefSelect } from "./PrefSelect";

// 一覧の上の絞り込み。開かずに、押すだけで切り替わる（同じものをもう一度押すと解除）
const list = (v: string | string[] | undefined) => (Array.isArray(v) ? v : v ? [v] : []);

function href(q: Query, key: string, value: string | null, drop: string[] = []): string {
  const p = new URLSearchParams();
  for (const [k, v] of Object.entries(q)) {
    if (k === key || k === "page" || drop.includes(k)) continue;
    for (const x of list(v)) p.append(k, x);
  }
  if (value) p.set(key, value);
  const s = p.toString();
  return `/events${s ? `?${s}` : ""}`;
}

function Row({ label, items }: { label: string; items: { text: string; to: string; on: boolean }[] }) {
  return (
    <div className="fb-row">
      <span className="fb-label">{label}</span>
      <div className="fb-opts">
        {items.map((it) => (
          <Link key={it.text} href={it.to} className={it.on ? "fb-opt on" : "fb-opt"} aria-pressed={it.on} scroll={false}>{it.text}</Link>
        ))}
      </div>
    </div>
  );
}

export function FilterBar({ q, lang }: { q: Query; lang: Lang }) {
  const get = (k: string) => list(q[k])[0] ?? "";
  const toggle = (key: string, value: string, drop: string[] = []) => ({ to: get(key) === value ? href(q, key, null, drop) : href(q, key, value, drop), on: get(key) === value });
  const WHEN: [string, UIKey][] = [["today", "today"], ["tomorrow", "tomorrow"], ["this-weekend", "thisWeekend"], ["next-weekend", "nextWeekend"], ["ending", "endingSoon"], ["冬休み", "winter"]];
  const AGES: [string, UIKey][] = [["baby", "ageBaby"], ["low", "ageLow"], ["high", "ageHigh"]];
  return (
    <div className="fb">
      <div className="fb-row">
        <span className="fb-label">{t(lang, "where")}</span>
        <PrefSelect current={get("pref")} allLabel={t(lang, "allJapan")} lang={lang} />
      </div>
      <Row label={t(lang, "when")} items={WHEN.map(([v, k]) => ({ text: t(lang, k), ...toggle("when", v) }))} />
      {lang === "easy" ? (
        <Row label={t(lang, "who")} items={[{ text: t(lang, "family"), ...toggle("with", "family") }, { text: t(lang, "friends"), ...toggle("with", "friends") }]} />
      ) : (
        <Row label={t(lang, "childAge")} items={AGES.map(([v, k]) => ({ text: t(lang, k), ...toggle("kid", v, ["age"]) }))} />
      )}
      <Row label={t(lang, "want")} items={(Object.keys(WANTS) as Want[]).map((w) => ({ text: wantLabel(w, lang), ...toggle("want", w) }))} />
      <Row
        label={t(lang, "conditions")}
        items={[
          { text: t(lang, "free"), ...toggle("free", "1") },
          { text: t(lang, "noReserve"), ...toggle("noreserve", "1") },
          { text: t(lang, "babyOk"), ...toggle("baby", "1") },
          { text: t(lang, "toiletOk"), ...toggle("toilet", "1") },
        ]}
      />
    </div>
  );
}
