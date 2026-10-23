import type { Metadata } from "next";
import { pageMeta } from "@/lib/seo";
import { getLang } from "@/lib/i18n";

export const metadata: Metadata = pageMeta({ title: "掲載について・訂正のご依頼", description: "博物館イベントナビの掲載方針、訂正・掲載停止のご依頼、博物館の方への無料掲載のご案内。", path: "/about" });

// 掲載のしかた・訂正の窓口・館への案内・運営（3言語）
const TEXT = {
  ja: {
    title: "掲載について",
    sections: [
      { id: "", h: "掲載のしかた", p: ["各館の公式サイトを週2回自動で確認し、日にち・場所・対象・料金・申込の要否といった事実情報だけを載せています。紹介文や写真は転載せず、詳しくは公式サイトへご案内します。SNSは各社の規約で認められた方法でのみ確認しています。", "「すべて載っている」とは言いません。どれだけの館を見ているかはトップページで公開しています。"] },
      { id: "location", h: "位置情報について", p: ["トップの「現在地から選ぶ」を押したときだけ、端末の位置情報を使います。都道府県を決めるために、国土地理院の逆ジオコーダに緯度・経度を送ります。位置情報は保存しません。押さなければ位置情報は使いません。"] },
      { id: "fix", h: "訂正・掲載停止のご依頼", p: ["内容の誤り、掲載の停止のご希望は info@museumpick.com までご連絡ください。掲載停止は当日中に対応します。"] },
      { id: "museums", h: "博物館・美術館の方へ", p: ["掲載は無料です。催しのチラシやSNSのアカウントを info@museumpick.com までお送りいただくだけでも、こちらで掲載の準備を進めます。決まった形式でのご登録は不要です。", "地域ごとに、どの年齢・テーマの体験が足りていないかのデータもお渡しします。ご相談もお気軽にどうぞ。"] },
      { id: "", h: "運営", p: ["株式会社ミュージアムピック　〒880-0001 宮崎県宮崎市橘通西3-10-32 宮崎ナナイロ東館8階"] },
    ],
  },
  en: {
    title: "About this site",
    sections: [
      { id: "", h: "How we list events", p: ["We check each museum's official website twice a week and list only facts such as date, place, audience, fee and booking. We do not copy descriptions or photos; please see the official website for details.", "We do not claim to list every event. The number of museums we check is shown on the top page."] },
      { id: "location", h: "Your location", p: ["Your location is used only when you tap \"Use my location\" on the top page. We send the coordinates to the Geospatial Information Authority of Japan to find your prefecture, and we do not store them."] },
      { id: "fix", h: "Corrections and removal", p: ["To report a mistake or request removal, please email info@museumpick.com. Removal requests are handled the same day."] },
      { id: "museums", h: "For museums", p: ["Listing is free. Just send us your event flyer or your social media account at info@museumpick.com, and we will prepare the listing for you. No special format is needed.", "We can also share data on which ages and themes are underserved in your area."] },
      { id: "", h: "Operator", p: ["MuseumPick Inc., Miyazaki, Japan"] },
    ],
  },
  easy: {
    title: "この サイトに ついて",
    sections: [
      { id: "", h: "どうやって のせているか", p: ["はくぶつかんの サイトを 1週間に 2回 見て、 日にち・ばしょ・お金・よやくの ことだけを のせています。", "ぜんぶの イベントが のっている わけでは ありません。"] },
      { id: "fix", h: "まちがいを 見つけたら", p: ["info@museumpick.com に メールで 知らせてください。"] },
      { id: "location", h: "いる ばしょに ついて", p: ["「いま いる ところで えらぶ」を おした ときだけ、 いる ばしょを つかいます。 ばしょは のこしません。"] },
      { id: "museums", h: "はくぶつかんの 人へ", p: ["のせるのに お金は いりません。 イベントの チラシや SNSの アカウントを info@museumpick.com に おくって ください。 それだけで、 のせる じゅんびを します。"] },
      { id: "", h: "うんえい", p: ["ミュージアムピック（みやざきし）"] },
    ],
  },
} as const;

export default async function About() {
  const lang = await getLang();
  const c = TEXT[lang];
  return (
    <div className="prose">
      <h1 className="page-title">{c.title}</h1>
      {c.sections.map((s) => (
        <section key={s.h} id={s.id || undefined}>
          <h2>{s.h}</h2>
          {s.p.map((x) => <p key={x}>{x}</p>)}
        </section>
      ))}
      <p><a href="https://museumpick.com/legal/policy" target="_blank" rel="noopener noreferrer">{lang === "en" ? "Privacy policy" : lang === "easy" ? "こじん じょうほうに ついて" : "プライバシーポリシー"}</a></p>
    </div>
  );
}
