import Link from "next/link";
import { GENRES } from "@/lib/genres";
import { genreLabel, t, type Lang } from "@/lib/i18n";

// 館の種類から探す：キーカラーの面に、白いMマーク
export function GenreTiles({ counts, lang }: { counts: Record<string, number>; lang: Lang }) {
  return (
    <nav className="genres" aria-label="館の種類">
      {GENRES.map((g) => (
        <Link key={g.slug} href={`/genres/${g.slug}`} className="genre" style={{ background: g.color, color: g.ink }}>
          <span className="genre-m" style={{ background: g.ink }} aria-hidden="true" />
          <span className="genre-name">{genreLabel(g.slug, g.label, lang)}</span>
          <span className="genre-count">{counts[g.slug] ?? 0}{t(lang, "count")}</span>
        </Link>
      ))}
    </nav>
  );
}
