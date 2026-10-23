"use client";
// 右上の言語切り替え（日本語／English／やさしい にほんご）
import { usePathname, useSearchParams } from "next/navigation";
import { LANGS, type Lang } from "@/lib/i18n-client";

export function LangSwitch({ current }: { current: Lang }) {
  const path = usePathname();
  const q = useSearchParams().toString();
  const next = encodeURIComponent(`${path}${q ? `?${q}` : ""}`);
  return (
    <nav className="lang" aria-label="Language">
      {LANGS.map((l) =>
        l.code === current ? (
          <span key={l.code} aria-current="true">{l.label}</span>
        ) : (
          <a key={l.code} href={`/api/lang?l=${l.code}&next=${next}`} lang={l.code === "en" ? "en" : "ja"}>{l.label}</a>
        ),
      )}
    </nav>
  );
}
