import Link from "next/link";
import { todayJst } from "@/lib/dates";
import type { Lang } from "@/lib/i18n";

// 冒頭の特集看板。季節で入れ替え、見出しはキーカラーの面に載せる
type Text = { ja: string; en: string; easy: string };
type Banner = { href: string; img: string; color: string; ink: string; kicker: Text; title: Text };

const WEEKEND: Banner = { href: "/events?when=this-weekend", img: "hist-ws-01", color: "#e63c23", ink: "#ffffff", kicker: { ja: "毎週木曜に更新", en: "Updated every Thursday", easy: "毎週 木曜日に 新しく なります" }, title: { ja: "今週末の\nミュージアム", en: "Museums\nthis weekend", easy: "今週の 土日の\nはくぶつかん" } };
const RAIN: Banner = { href: "/events?want=つくる", img: "banner-rain", color: "#2d78e1", ink: "#ffffff", kicker: { ja: "雨の日も", en: "Rainy days", easy: "雨の 日も" }, title: { ja: "屋内で、つくる・\n見る・聞く", en: "Make, see and listen\nindoors", easy: "へやの 中で\n作る・見る・聞く" } };
const KIDS: Banner = { href: "/events?kind=ワークショップ&age=未就学&age=親子", img: "banner-kids", color: "#ffa5cd", ink: "#111111", kicker: { ja: "小さな子と", en: "With little ones", easy: "小さな 子と" }, title: { ja: "親子で\nはじめての体験", en: "First museum\nexperiences", easy: "親子で\nはじめての たいけん" } };
const FREE: Banner = { href: "/events?free=1&noreserve=1", img: "any-ob-01", color: "#32c88c", ink: "#111111", kicker: { ja: "思い立ったら", en: "Just drop in", easy: "すぐ 行ける" }, title: { ja: "無料・予約なしで\n行けるイベント", en: "Free events,\nno booking", easy: "0円・よやく なしで\n行ける イベント" } };
const SEASON: Record<string, Banner> = {
  spring: { href: "/events?when=春休み", img: "banner-spring", color: "#ffa5cd", ink: "#111111", kicker: { ja: "春休み", en: "Spring break", easy: "春休み" }, title: { ja: "桜の季節の\nミュージアム", en: "Museums in\ncherry blossom season", easy: "さくらの ころの\nはくぶつかん" } },
  summer: { href: "/events?when=夏休み", img: "banner-summer", color: "#f5dc00", ink: "#111111", kicker: { ja: "夏休み", en: "Summer break", easy: "夏休み" }, title: { ja: "自由研究に\n使える体験", en: "Ideas for\nsummer projects", easy: "夏休みの しゅくだいに\nつかえる たいけん" } },
  autumn: { href: "/events?kind=観察会・野外", img: "banner-autumn", color: "#f08c28", ink: "#111111", kicker: { ja: "秋の特集", en: "Autumn", easy: "秋" }, title: { ja: "どんぐり、落ち葉、\n虫をさがしに", en: "Acorns, leaves\nand bugs", easy: "どんぐり、 はっぱ、\n虫を さがしに" } },
  winter: { href: "/events?when=冬休み", img: "banner-winter", color: "#00aaff", ink: "#111111", kicker: { ja: "冬休み", en: "Winter break", easy: "冬休み" }, title: { ja: "冬休みの\n体験さがし", en: "Winter break\nactivities", easy: "冬休みの\nたいけん さがし" } },
};

function season(): string {
  const m = Number(todayJst().slice(5, 7));
  return m <= 2 || m === 12 ? "winter" : m <= 5 ? "spring" : m <= 8 ? "summer" : "autumn";
}

export function Banners({ lang }: { lang: Lang }) {
  const s = season();
  const next = { winter: "spring", spring: "summer", summer: "autumn", autumn: "winter" }[s] ?? "winter";
  const list = [WEEKEND, SEASON[s], KIDS, FREE, RAIN, SEASON[next]].filter((b): b is Banner => Boolean(b));
  return (
    <div className="banners" aria-label="特集">
      {list.map((b) => (
        <Link key={b.img} href={b.href} className="banner">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={`/images/${b.img}.webp`} alt="" width={1200} height={800} />
          <span className="banner-label" style={{ background: b.color, color: b.ink }}>
            <span className="banner-kicker">{b.kicker[lang]}</span>
            <span className="banner-title">{b.title[lang]}</span>
          </span>
        </Link>
      ))}
    </div>
  );
}
