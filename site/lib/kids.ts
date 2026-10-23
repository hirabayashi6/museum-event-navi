// 子どもと行けるイベントだけを載せるための判定と、カードに出す「何歳から」の目安
import type { Audience, NaviEvent } from "./types";

const KID_AUD: Audience[] = ["未就学", "小学生低学年", "小学生高学年", "親子"];
const KID_WORDS = /子ども|こども|子供|キッズ|親子|ファミリー|家族|小学生|幼児|ちびっこ|夏休み|冬休み|春休み|工作|作ろう|つくろう|作り|づくり|体験|ワークショップ|えほん|絵本|読み聞かせ|よみきかせ|おはなし|ふれあい|えさやり|エサやり|観察|実験|サイエンス|プラネタリウム|恐竜|化石|昆虫|虫|どうぶつ|動物|いきもの|生き物|魚|クイズ|スタンプ|ラリー|あそび|遊び|ハロウィン|クリスマス|紙芝居|人形劇|まつり|祭り|フェス|アニメ|キャラクター|マンガ|おもちゃ|ロボット|宇宙|星空|鉄道|のりもの|乗り物|忍者|妖怪|なぞとき|謎解き|原画|絵本作家|しかけ絵本|はらぺこあおむし|エリック・カール|ミッフィー|ムーミン|スヌーピー|ピーターラビット|ノンタン|ぐりとぐら|はらぺこ|キティ|サンリオ|ポケモン|ポケットモンスター|ジブリ|トトロ|ディズニー|ドラえもん|アンパンマン|しまじろう|プラレール|トミカ|レゴ|LEGO|ブロック|すみっコ|かがくい/;
// 子ども向けの館（こども美術館・子ども科学館など）の催しは、題名にかかわらず載せる
const KID_MUSEUM = /こども|子ども|子供|キッズ|児童/;
const ADULT_WORDS = /講演会|シンポジウム|古文書|セミナー|研究会|講義|総会|句会|茶会|茶道|書道|写真展|美術展|作品展|公募展|大人|シニア|高齢|手話|ヨガ|健康|認知症|歴史講座|文化講座|教養|市民大学|会員|研修|講習会|ビジネス|就活|頒布会|販売会/;
const KID_GENRES = ["水族館", "動物園", "科学博物館", "植物園", "動植物園"];

export function isKidFriendly(e: NaviEvent): boolean {
  if (e.audience.some((a) => KID_AUD.includes(a))) return true;
  // 対象が大人・中高生だけと書かれているものは載せない
  if (e.audience.length && e.audience.every((a) => a === "大人" || a === "中高生")) return false;
  if (KID_MUSEUM.test(e.museum)) return true;
  if (ADULT_WORDS.test(e.title)) return false;
  if (KID_WORDS.test(e.title)) return true;
  return KID_GENRES.includes(e.category ?? "");
}

// 「何歳から行けるか」の目安（対象の書き方から）
export type AgeKey = "baby" | "low" | "high";
export const AGE_TO_AUD: Record<AgeKey, Audience[]> = {
  baby: ["未就学", "親子"],
  low: ["小学生低学年", "親子"],
  high: ["小学生高学年"],
};

export function ageBadge(e: NaviEvent): "baby" | "school" | "family" | "all" | null {
  const a = new Set(e.audience);
  if (a.has("未就学")) return "baby";
  if (a.has("小学生低学年") || a.has("小学生高学年")) return "school";
  if (a.has("親子")) return "family";
  if (!a.size) return "all";
  return null;
}
