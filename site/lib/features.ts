// 「この時期ならこれ」：今の月と年齢から、特集を自動で組む（登録不要）
import type { Audience, Kind } from "./types";
import { todayJst } from "./dates";

type Text = { ja: string; en: string; easy: string };
export type Feature = { title: Text; lead: Text; kinds: Kind[]; ages: Audience[]; when?: string };

const INDOOR: Feature = {
  title: { ja: "未就学の子と、屋内でつくる", en: "Indoor crafts with little ones", easy: "小さな 子と へやの 中で 作る" },
  lead: { ja: "雨の日や寒い日でも行ける工作・体験", en: "Crafts you can enjoy on rainy or cold days", easy: "雨や さむい 日でも 行ける" },
  kinds: ["ワークショップ"], ages: ["未就学", "親子"],
};
const ADULT: Feature = {
  title: { ja: "大人がゆっくり聞く講座", en: "Talks for adults", easy: "大人が 聞く 話" },
  lead: { ja: "企画展の関連講座・ギャラリートーク", en: "Lectures and gallery talks", easy: "てんじの せつめいなど" },
  kinds: ["講座・公演・音楽イベント", "ギャラリートーク"], ages: ["大人"],
};

export function featuresNow(): Feature[] {
  const m = Number(todayJst().slice(5, 7));
  if (m >= 6 && m <= 8)
    return [
      { title: { ja: "自由研究に使える観察会", en: "Nature events for summer projects", easy: "夏休みの しゅくだいに つかえる" }, lead: { ja: "夏休みの小学生高学年向け", en: "For older elementary students", easy: "小学4〜6年 むけ" }, kinds: ["観察会・野外", "ワークショップ"], ages: ["小学生高学年"], when: "夏休み" },
      INDOOR,
      ADULT,
    ];
  if (m >= 11 || m <= 2)
    return [
      { ...INDOOR, title: { ja: "冬は屋内で、親子の工作", en: "Winter crafts indoors", easy: "冬は へやの 中で 親子で 作る" } },
      { title: { ja: "冬休みに小学生と", en: "Winter break with kids", easy: "冬休みに 小学生と" }, lead: { ja: "年末年始のワークショップ・講座", en: "Workshops and talks over the holidays", easy: "冬休みの イベント" }, kinds: ["ワークショップ", "講座・公演・音楽イベント"], ages: ["小学生低学年", "小学生高学年"], when: "冬休み" },
      ADULT,
    ];
  return [
    { title: { ja: "外で見つける、季節の観察会", en: "Seasonal nature walks", easy: "外で 見つける 秋の しぜん" }, lead: { ja: "小学生と自然の中へ", en: "Into nature with kids", easy: "小学生と 外へ" }, kinds: ["観察会・野外"], ages: ["小学生低学年", "小学生高学年", "親子"] },
    INDOOR,
    ADULT,
  ];
}
