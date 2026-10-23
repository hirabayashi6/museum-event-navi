// 館のジャンルとミュージアムピックのキーカラー（ロゴガイドライン 02 キーカラーパレット RGB）
// ink は色の面の上に置く文字色（SNSカードの見本に合わせる）
export type Genre = { slug: string; label: string; color: string; ink: string; categories: string[] };

export const GENRES: Genre[] = [
  // 子どもに人気の順（水族館・動物園・科学館を先に）
  { slug: "aquarium", label: "水族館", color: "#2d78e1", ink: "#ffffff", categories: ["水族館"] },
  { slug: "zoo", label: "動物園", color: "#ffa5cd", ink: "#111111", categories: ["動物園"] },
  { slug: "science", label: "科学博物館", color: "#7d2da5", ink: "#ffffff", categories: ["科学博物館"] },
  { slug: "botanical", label: "植物園", color: "#148c6e", ink: "#ffffff", categories: ["植物園"] },
  { slug: "zoo-botanical", label: "動植物園", color: "#00aaff", ink: "#111111", categories: ["動植物園"] },
  { slug: "open-air", label: "野外博物館", color: "#32c88c", ink: "#111111", categories: ["野外博物館"] },
  { slug: "general", label: "総合博物館", color: "#f5dc00", ink: "#111111", categories: ["総合博物館"] },
  { slug: "history", label: "歴史博物館", color: "#e63c23", ink: "#ffffff", categories: ["歴史博物館"] },
  { slug: "art", label: "美術博物館", color: "#f08c28", ink: "#111111", categories: ["美術博物館"] },
];

const NONE: Genre = { slug: "", label: "博物館", color: "#2b2b2b", ink: "#ffffff", categories: [] };

export function genreOf(category: string | undefined): Genre {
  return GENRES.find((g) => g.categories.includes(category ?? "")) ?? NONE;
}

export function genreBySlug(slug: string): Genre | undefined {
  return GENRES.find((g) => g.slug === slug);
}
