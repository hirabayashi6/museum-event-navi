// 表示する言葉（日本語・英語・やさしい日本語）
// やさしい日本語は、小学2年生までに習う漢字（240字）だけを漢字にし、ほかはひらがな。文節ごとに空白（scripts/check-easy.py で確認）
import { cookies } from "next/headers";
import type { Audience, Kind, Want } from "./types";
import { isHoliday } from "./holidays";

import type { Lang } from "./i18n-client";
export type { Lang } from "./i18n-client";
export { LANGS } from "./i18n-client";

export async function getLang(): Promise<Lang> {
  const v = (await cookies()).get("navi_lang")?.value;
  return v === "en" || v === "easy" ? v : "ja";
}

type L3 = { ja: string; en: string; easy: string };
const d = <T extends Record<string, L3>>(x: T) => x;

export const UI = d({
  babyOk: { ja: "赤ちゃん連れOK", en: "Baby-friendly", easy: "赤ちゃんと 行ける" },
  toiletOk: { ja: "多目的トイレ", en: "Accessible toilet", easy: "だれでも トイレ" },
  nursing: { ja: "授乳室", en: "Nursing room", easy: "じゅにゅう室" },
  diaper: { ja: "おむつ替え", en: "Diaper changing", easy: "おむつがえ" },
  stroller: { ja: "ベビーカー貸出", en: "Stroller rental", easy: "ベビーカーを かりられる" },
  facilities: { ja: "赤ちゃん連れにうれしい設備", en: "Facilities for babies", easy: "赤ちゃんと 行く 人へ" },
  facilitiesNote: { ja: "公式サイトの利用案内などに書かれていた設備です。お出かけ前に公式でご確認ください。", en: "Based on each museum's official website. Please check before you go.", easy: "はくぶつかんの サイトに 書いて あった ものです。" },
  heroTitle: { ja: "子どもと行く、\n今週末のはくぶつかん。", en: "Museum fun\nwith your kids this weekend.", easy: "子どもと 行く\n今週の はくぶつかん" },
  heroLead: { ja: "工作、観察、実験、絵本。全国の博物館・水族館・動物園から、子どもと参加できるイベントだけを集めました。", en: "Crafts, nature walks, experiments and story time — only events you can enjoy with your kids, from museums, aquariums and zoos across Japan.", easy: "作る、 見る、 しらべる。 子どもと 行ける イベントだけを あつめました。" },
  ageQ: { ja: "お子さんは何歳？", en: "How old is your child?", easy: "子どもは 何さい？" },
  childAge: { ja: "子どもの年齢", en: "Child's age", easy: "子どもの 年" },
  ageBaby: { ja: "0〜5さい", en: "Ages 0–5", easy: "0〜5さい" },
  ageLow: { ja: "小学1〜3年", en: "Grades 1–3", easy: "小学1〜3年" },
  ageHigh: { ja: "小学4〜6年", en: "Grades 4–6", easy: "小学4〜6年" },
  ageTeen: { ja: "中学生", en: "Middle school", easy: "中学生" },
  badgeBaby: { ja: "0〜5さいOK", en: "Ages 0–5", easy: "0〜5さい OK" },
  badgeSchool: { ja: "小学生OK", en: "Kids OK", easy: "小学生 OK" },
  badgeFamily: { ja: "親子で", en: "With parents", easy: "親子で" },
  badgeAll: { ja: "だれでも", en: "All ages", easy: "だれでも" },
  withBaby: { ja: "0〜5さいの子と", en: "With little ones (0–5)", easy: "0〜5さいの 子と" },
  withBabyLead: { ja: "絵本、ふれあい、はじめての工作", en: "Story time, animals and first crafts", easy: "絵本・どうぶつ・はじめての 工作" },
  withLow: { ja: "小学1〜3年の子と", en: "With kids in grades 1–3", easy: "小学1〜3年の 子と" },
  withLowLead: { ja: "工作・観察会・クイズラリー", en: "Crafts, nature walks and quiz rallies", easy: "工作・かんさつ・クイズ" },
  withHigh: { ja: "小学4〜6年の子と", en: "With kids in grades 4–6", easy: "小学4〜6年の 子と" },
  withHighLead: { ja: "実験や自由研究にも使える体験", en: "Experiments and ideas for school projects", easy: "じっけん・しらべる たいけん" },
  freeEasy: { ja: "無料・予約なしで気軽に", en: "Free, no booking needed", easy: "0円・よやく なしで 行ける" },
  freeEasyLead: { ja: "思い立ったらすぐ行ける", en: "Just drop in", easy: "すぐ 行ける" },
  kidsWeekend: { ja: "次のお休みに、子どもと行けるイベント", en: "Next days off with kids", easy: "つぎの 休みに 子どもと 行ける" },
  whereGo: { ja: "どこへ行く？", en: "Where to go", easy: "どこへ 行く？" },
  whatDo: { ja: "子どもと何をする？", en: "What will you do?", easy: "子どもと 何を する？" },
  siteName: { ja: "博物館イベントナビ", en: "Museum Event Navi", easy: "はくぶつかん イベント ナビ" },
  tagline: { ja: "子どもと行く、近くの博物館", en: "Museum events for families with kids", easy: "子どもと 行く 近くの はくぶつかん" },
  searchPh: { ja: "キーワードでさがす", en: "Search by keyword", easy: "ことばで さがす" },
  when: { ja: "いつ", en: "When", easy: "いつ" },
  who: { ja: "だれと", en: "With whom", easy: "だれと" },
  want: { ja: "したいこと", en: "What to do", easy: "したい こと" },
  genre: { ja: "館の種類", en: "Type of museum", easy: "どんな ところ" },
  kindMore: { ja: "催しの種類で探す", en: "Search by event type", easy: "もよおしの しゅるいで さがす" },
  thisWeekend: { ja: "今週末・祝日", en: "This weekend & holidays", easy: "つぎの 休みの 日" },
  today: { ja: "今日", en: "Today", easy: "今日" },
  endingSoon: { ja: "もうすぐ終わる", en: "Ending soon", easy: "もうすぐ おわる" },
  closedDays: { ja: "休館日", en: "Closed", easy: "休みの 日" },
  closedNote: { ja: "公式サイトの記載です。臨時休館もあるので、お出かけ前にご確認ください。", en: "As written (in Japanese) on the official website. Please check before you go.", easy: "はくぶつかんの サイトに 書いて あった ことです。 行く 前に たしかめて ください。" },
  endingSoonLead: { ja: "2週間以内に終わる展示・催し", en: "Ending within 2 weeks", easy: "2週間で おわる もの" },
  tomorrow: { ja: "明日", en: "Tomorrow", easy: "あした" },
  nextWeekend: { ja: "来週末", en: "Next weekend", easy: "来週の 土日" },
  winter: { ja: "冬休み", en: "Winter break", easy: "冬休み" },
  anytime: { ja: "いつでも", en: "Any time", easy: "いつでも" },
  searchAll: { ja: "条件でさがす", en: "Search with filters", easy: "えらんで さがす" },
  about: { ja: "掲載について", en: "About this site", easy: "この サイトに ついて" },
  forMuseums: { ja: "博物館の方へ", en: "For museums", easy: "はくぶつかんの 人へ" },
  fix: { ja: "訂正のご依頼", en: "Report a correction", easy: "まちがいを 知らせる" },
  privacy: { ja: "プライバシーポリシー", en: "Privacy policy", easy: "こじん じょうほうに ついて" },
  footLead: { ja: "博物館イベントナビは、全国の博物館のイベントを、家族の週末に届けるサイトです。", en: "Museum Event Navi brings museum events across Japan to your family weekend.", easy: "はくぶつかん イベント ナビは、 日本中の はくぶつかんの イベントを しらせる サイトです。" },
  footSmall: { ja: "運営 株式会社ミュージアムピック ／ 掲載内容は各館の公式情報をもとにしています。お出かけ前に必ず公式でご確認ください。", en: "Operated by MuseumPick Inc. Information is based on each museum's official website. Please check the official site before you go.", easy: "うんえい ミュージアムピック ／ 行く 前に、 かならず はくぶつかんの サイトを 見てください。" },
  prefNav: { ja: "都道府県から探す", en: "Browse by prefecture", easy: "ばしょから さがす" },
  statement: { ja: "博物館イベントナビは、家族の週末にうれしい、博物館の催しの案内です。", en: "Find hands-on workshops, talks and exhibitions at museums across Japan.", easy: "はくぶつかんで 作る、 見る、 聞く。 土日に 行ける イベントを さがせます。" },
  yourArea: { ja: "あなたの地域", en: "Your area", easy: "すんでいる ところ" },
  allJapan: { ja: "全国", en: "All of Japan", easy: "日本中" },
  fewInArea: { ja: "の今週末の催しが少ないため、全国から表示しています", en: " has few events this weekend, so events from all of Japan are shown.", easy: "は 今週の イベントが 少ないので、 日本中から 見せています" },
  weekendTitle: { ja: "今週末のミュージアム", en: "Museums this weekend", easy: "今週の 土日に 行ける はくぶつかん" },
  seeAll: { ja: "件をすべて見る", en: " events — see all", easy: "こ ぜんぶ 見る" },
  wantsTitle: { ja: "したいことから探す", en: "Search by what you want to do", easy: "したい ことから さがす" },
  genresTitle: { ja: "館の種類から探す", en: "Search by type of museum", easy: "どんな ところか えらぶ" },
  more: { ja: "もっと見る", en: "See more", easy: "もっと 見る" },
  numsTitle: { ja: "いま見ている範囲", en: "What we cover", easy: "いま しらべている はくぶつかん" },
  numsNote: { ja: "「すべて載っている」とは言いません", en: "We do not claim to list everything", easy: "ぜんぶ のっている わけでは ありません" },
  numsMonitored: { ja: "イベント情報を見ている館", en: "museums we check", easy: "しらべている はくぶつかん" },
  numsEvents: { ja: "掲載中の催し", en: "events listed", easy: "のっている イベント" },
  numsMuseums: { ja: "催しのある館", en: "museums with events", easy: "イベントが ある はくぶつかん" },
  updated: { ja: "最終更新", en: "Last updated", easy: "さいごに 新しく した 日" },
  ongoing: { ja: "開催中", en: "Now on", easy: "やっています" },
  until: { ja: "まで", en: "until ", easy: "まで" },
  free: { ja: "無料", en: "Free", easy: "0円" },
  noReserve: { ja: "予約不要", en: "No booking", easy: "よやく いらない" },
  needReserve: { ja: "要予約", en: "Booking required", easy: "よやくが いる" },
  event: { ja: "催し", en: "Event", easy: "イベント" },
  titleNote: { ja: "", en: "Event titles and details are shown in Japanese as published by each museum.", easy: "イベントの 名前は、 はくぶつかんが 書いた とおりに 出しています。" },
  // 詳細
  date: { ja: "日にち", en: "Date", easy: "日にち" },
  time: { ja: "時間", en: "Time", easy: "時間" },
  venue: { ja: "会場", en: "Venue", easy: "ばしょ" },
  kind: { ja: "種類", en: "Type", easy: "しゅるい" },
  target: { ja: "対象", en: "For", easy: "だれ むけ" },
  fee: { ja: "料金", en: "Fee", easy: "お金" },
  capacity: { ja: "定員", en: "Capacity", easy: "入れる 人数" },
  apply: { ja: "申込", en: "Booking", easy: "よやく" },
  deadline: { ja: "締切", en: "Deadline", easy: "しめきり" },
  bring: { ja: "持ち物", en: "What to bring", easy: "もって いく もの" },
  lecturer: { ja: "講師・出演", en: "Speaker / performer", easy: "先生・出る 人" },
  needed: { ja: "必要", en: "Required", easy: "いる" },
  notNeeded: { ja: "不要（当日そのまま参加できます）", en: "Not required (just come on the day)", easy: "いらない（ その日に 行けば 入れます）" },
  missingNote: { ja: "は、公式サイトに書かれていなかったか、読み取れませんでした。公式でご確認ください。", en: " — not found on the official website. Please check the official site.", easy: "は わかりませんでした。 はくぶつかんの サイトで 見てください。" },
  autoNote: { ja: "の公式サイトから自動で集め、事実の要点だけを載せています。中止・満員・日時の変更があるため、お出かけ前に必ず公式でご確認ください。", en: " — collected automatically from the official website. Events may be cancelled, full or changed, so please check before you go.", easy: "の サイトから あつめました。 なくなったり、 日にちが かわったり する ことが あります。 行く 前に たしかめてください。" },
  official: { ja: "公式で最終確認する", en: "Check the official page", easy: "はくぶつかんの サイトで たしかめる" },
  officialInstagram: { ja: "Instagramの元の投稿を見る", en: "See the original Instagram post", easy: "Instagramの 元の とうこうを 見る" },
  officialFacebook: { ja: "Facebookの元の投稿を見る", en: "See the original Facebook post", easy: "Facebookの 元の とうこうを 見る" },
  snsNote: { ja: "館のSNSの投稿から、催しの名前と日にちだけを読み取って載せています。内容や申込は元の投稿でご確認ください。", en: "We read only the event name and date from the museum's social media post. Please see the original post for details.", easy: "はくぶつかんの SNSから 名前と 日にちだけを 読んで のせています。 くわしくは 元の とうこうを 見て ください。" },
  museumSite: { ja: "館の公式サイトへ", en: "Museum website", easy: "はくぶつかんの サイトへ" },
  calendar: { ja: "カレンダーに追加", en: "Add to calendar", easy: "カレンダーに 入れる" },
  map: { ja: "地図で見る", en: "View map", easy: "地図で 見る" },
  line: { ja: "LINEで家族に送る", en: "Share on LINE", easy: "LINEで おくる" },
  share: { ja: "リンクを共有", en: "Share link", easy: "リンクを おくる" },
  copied: { ja: "リンクをコピーしました", en: "Link copied", easy: "コピー しました" },
  checkin: { ja: "行ったら、ミュージアムピックでチェックイン。家族のスタンプ帳に残せます。", en: "Check in with MuseumPick when you visit and collect stamps.", easy: "行ったら ミュージアムピックで チェックイン。 スタンプが もらえます。" },
  fixNote: { ja: "内容の誤りに気づいたら訂正のご連絡をお願いします。", en: "Found a mistake? Please let us know.", easy: "まちがいを 見つけたら 知らせてください。" },
  sameMuseum: { ja: "のほかの催し", en: ": other events", easy: "の ほかの イベント" },
  museumPage: { ja: "館のページへ", en: "Museum page", easy: "はくぶつかんの ページへ" },
  nearby: { ja: "今週末、同じ県のほかの館では", en: "Other museums nearby this weekend", easy: "今週の 土日、 近くの ほかの はくぶつかん" },
  top: { ja: "トップ", en: "Home", easy: "はじめ" },
  // 一覧
  eventsOf: { ja: "の催し", en: " events", easy: "の イベント" },
  upcoming: { ja: "これから", en: "Upcoming", easy: "これから" },
  count: { ja: "件", en: " events", easy: "こ" },
  changeFilters: { ja: "条件を変える", en: "Change filters", easy: "えらび なおす" },
  where: { ja: "どこで", en: "Where", easy: "どこで" },
  conditions: { ja: "条件", en: "Conditions", easy: "ほかに" },
  any: { ja: "指定しない", en: "Any", easy: "えらばない" },
  search: { ja: "この条件でさがす", en: "Search", easy: "これで さがす" },
  springBreak: { ja: "春休み", en: "Spring break", easy: "春休み" },
  gw: { ja: "GW", en: "Golden Week", easy: "5月の 休み" },
  summerBreak: { ja: "夏休み", en: "Summer break", easy: "夏休み" },
  pickDate: { ja: "日付を指定", en: "Pick a date", easy: "日にちを えらぶ" },
  prev: { ja: "前へ", en: "Previous", easy: "前へ" },
  next: { ja: "次へ", en: "Next", easy: "つぎへ" },
  notFound: { ja: "条件に合う催しは見つかりませんでした。", en: "No events found.", easy: "イベントが 見つかりませんでした。" },
  // だれと（やさしい日本語は2つだけ）
  family: { ja: "家族で行きたい", en: "With family", easy: "かぞくで 行きたい" },
  friends: { ja: "友だちと", en: "With friends", easy: "友だちと" },
  // 館・ジャンル
  officialSite: { ja: "公式サイト", en: "Official website", easy: "はくぶつかんの サイト" },
  programs: { ja: "参加できる催し", en: "Workshops, talks and more", easy: "さんか できる イベント" },
  shows: { ja: "展覧会", en: "Exhibitions", easy: "てんじ" },
  fromAll: { ja: "全国から", en: "across Japan", easy: "日本中から" },
  // 親御さんの声
  voices: { ja: "親御さんの声", en: "Voices from parents", easy: "親の 声" },
  voicesLead: { ja: "「こんなイベントがあったらいいな」を集めています。いただいた声は、運営が目を通してから掲載し、全国の博物館にお届けします。", en: "Tell us what kind of events you'd like for your kids. We read every message before posting it here, and share them with museums across Japan.", easy: "「こんな イベントが あったら いいな」を おしえて ください。 よんでから ここに のせます。" },
  voicesEmpty: { ja: "まだ掲載している声はありません。最初のひとことをお寄せください。", en: "No messages yet. Be the first to share.", easy: "まだ ありません。 さいしょの 声を おしえて ください。" },
  voicesMore: { ja: "声をもっと見る・声をとどける", en: "See more / share yours", easy: "もっと 見る・声を おくる" },
  voiceForm: { ja: "声をとどける", en: "Share your idea", easy: "声を おくる" },
  voiceBody: { ja: "こんなイベントがあったらいいな", en: "What event would you like?", easy: "あったら いいな と 思う イベント" },
  voiceBodyHint: { ja: "例：雨の日に未就学の子と行ける工作の会が近くにほしい（5〜300字）", en: "e.g. A rainy-day craft session for preschoolers nearby (5–300 characters)", easy: "れい：雨の 日に 小さい 子と 行ける 工作が ほしい" },
  voicePref: { ja: "お住まいの都道府県（任意）", en: "Prefecture (optional)", easy: "すんで いる ところ（なくても いい）" },
  voiceNick: { ja: "ニックネーム（任意・20字まで）", en: "Nickname (optional)", easy: "なまえ（なくても いい）" },
  voiceAgeNone: { ja: "答えない", en: "Prefer not to say", easy: "こたえない" },
  voiceNote: { ja: "お名前・連絡先・お子さんの名前など、個人が分かることは書かないでください。内容を確認してから掲載します（掲載しない場合もあります）。", en: "Please don't include names or contact details. We review every message before posting, and may not post all of them.", easy: "なまえや 電話ばんごうは 書かないで ください。 よんでから のせます。" },
  voiceSend: { ja: "送る", en: "Send", easy: "おくる" },
  voiceThanks: { ja: "ありがとうございます。確認してから掲載します。", en: "Thank you! We'll review it before posting.", easy: "ありがとう。 よんでから のせます。" },
  voiceError: { ja: "送れませんでした。時間をおいてもう一度お試しください。", en: "Couldn't send. Please try again later.", easy: "おくれませんでした。 あとで もう 一ど おくって ください。" },
  voiceClosed: { ja: "ただいま準備中です。", en: "Coming soon.", easy: "いま じゅんびちゅう です。" },
  voiceAnon: { ja: "匿名", en: "Anonymous", easy: "なまえ なし" },
  // トップの入口（どこで → いつ → 何歳）
  pickWhere: { ja: "どこで？", en: "Where?", easy: "どこで？" },
  geoPick: { ja: "現在地から選ぶ", en: "Use my location", easy: "いま いる ところで えらぶ" },
  geoAbout: { ja: "「現在地から選ぶ」を押したときだけ位置情報を使い、都道府県を決めるために国土地理院へ緯度・経度を送ります。位置情報は保存しません。", en: "Your location is used only when you tap \"Use my location\". We send the coordinates to the Geospatial Information Authority of Japan to find your prefecture, and we do not store them.", easy: "「いま いる ところで えらぶ」を おした ときだけ ばしょを つかいます。 ばしょは のこしません。" },
  geoBusy: { ja: "現在地を調べています…", en: "Finding your location…", easy: "いま いる ところを しらべています…" },
  geoFail: { ja: "現在地が分かりませんでした。一覧から選んでください。", en: "Couldn't get your location. Please choose from the list.", easy: "わかりませんでした。 リストから えらんで ください。" },
  geoOutside: { ja: "日本の外にいるようです。一覧から選んでください。", en: "You seem to be outside Japan. Please choose from the list.", easy: "日本の 外に いるようです。 リストから えらんで ください。" },
  pickWhen: { ja: "いつ？", en: "When?", easy: "いつ？" },
  pickAge: { ja: "何歳？（選ばなくてもOK）", en: "Age? (optional)", easy: "何さい？（えらばなくても いい）" },
  regionHokkaidoTohoku: { ja: "北海道・東北", en: "Hokkaido / Tohoku", easy: "北海道・とうほく" },
  regionKanto: { ja: "関東", en: "Kanto", easy: "かんとう" },
  regionChubu: { ja: "中部", en: "Chubu", easy: "ちゅうぶ" },
  regionKinki: { ja: "近畿", en: "Kansai", easy: "きんき" },
  regionChugokuShikoku: { ja: "中国・四国", en: "Chugoku / Shikoku", easy: "中国・四国" },
  regionKyushu: { ja: "九州・沖縄", en: "Kyushu / Okinawa", easy: "きゅうしゅう・おきなわ" },
});

export type UIKey = keyof typeof UI;
// 長いお休みの名前（季節で入れ替わるボタン用）
export const BREAK_KEY = { 春休み: "springBreak", GW: "gw", 夏休み: "summerBreak", 冬休み: "winter" } as const satisfies Record<string, UIKey>;
export const t = (lang: Lang, key: UIKey): string => UI[key][lang];

const KIND: Record<Kind, L3> = {
  ワークショップ: { ja: "ワークショップ", en: "Workshop", easy: "ものを 作る" },
  "講座・公演・音楽イベント": { ja: "講座・公演・音楽イベント", en: "Talk / performance", easy: "話を 聞く・音楽" },
  ギャラリートーク: { ja: "ギャラリートーク", en: "Gallery talk", easy: "せつめいを 聞く" },
  "観察会・野外": { ja: "観察会・野外", en: "Nature walk / outdoor", easy: "外で しらべる" },
  "特別展・企画展": { ja: "特別展・企画展", en: "Special exhibition", easy: "とくべつな てんじ" },
  常設展: { ja: "常設展", en: "Permanent exhibition", easy: "いつもの てんじ" },
};
export const kindLabel = (k: Kind | null, lang: Lang) => (k ? KIND[k][lang] : UI.event[lang]);

const AUD: Record<Audience, L3> = {
  未就学: { ja: "未就学", en: "Preschool", easy: "小学生より 小さい 子" },
  小学生低学年: { ja: "小学1〜3年", en: "Grades 1–3", easy: "小学1〜3年" },
  小学生高学年: { ja: "小学4〜6年", en: "Grades 4–6", easy: "小学4〜6年" },
  中高生: { ja: "中高生", en: "Teens", easy: "中学生・高校生" },
  大人: { ja: "大人", en: "Adults", easy: "大人" },
  親子: { ja: "親子", en: "Families", easy: "親子" },
};
export const audLabel = (a: Audience, lang: Lang) => AUD[a][lang];

const WANT: Record<Want, L3 & { lead: L3 }> = {
  つくる: { ja: "つくる", en: "Make", easy: "作る", lead: { ja: "工作・ものづくり", en: "Crafts", easy: "ものを 作る" } },
  "観察・体験する": { ja: "しらべる・実験", en: "Explore", easy: "しらべる", lead: { ja: "観察会・実験", en: "Nature and experiments", easy: "かんさつ・じっけん" } },
  聞いて学ぶ: { ja: "見て聞いて学ぶ", en: "Shows and stories", easy: "見て 聞いて 学ぶ", lead: { ja: "おはなし会・ショー・解説", en: "Story time and shows", easy: "おはなし・ショー" } },
  見て味わう: { ja: "展示を見る", en: "Exhibitions", easy: "てんじを 見る", lead: { ja: "恐竜・いきもの・アート", en: "Dinosaurs, animals and art", easy: "きょうりゅう・いきもの" } },
  外で体を動かす: { ja: "外であそぶ", en: "Play outside", easy: "外で あそぶ", lead: { ja: "自然・野外の体験", en: "Nature and outdoors", easy: "外で あそぶ" } },
};
export const wantLabel = (w: Want, lang: Lang) => WANT[w][lang];
export const wantLead = (w: Want, lang: Lang) => WANT[w].lead[lang];

const GENRE: Record<string, L3> = {
  history: { ja: "歴史博物館", en: "History museum", easy: "れきしの はくぶつかん" },
  art: { ja: "美術博物館", en: "Art museum", easy: "びじゅつかん" },
  general: { ja: "総合博物館", en: "General museum", easy: "いろいろな はくぶつかん" },
  science: { ja: "科学博物館", en: "Science museum", easy: "かがくかん" },
  "open-air": { ja: "野外博物館", en: "Open-air museum", easy: "外の はくぶつかん" },
  aquarium: { ja: "水族館", en: "Aquarium", easy: "すいぞくかん" },
  zoo: { ja: "動物園", en: "Zoo", easy: "どうぶつえん" },
  botanical: { ja: "植物園", en: "Botanical garden", easy: "しょくぶつえん" },
  "zoo-botanical": { ja: "動植物園", en: "Zoo & garden", easy: "どうしょくぶつえん" },
};
export const genreLabel = (slug: string, fallback: string, lang: Lang) => GENRE[slug]?.[lang] ?? fallback;

const PREF_EN = ["Hokkaido", "Aomori", "Iwate", "Miyagi", "Akita", "Yamagata", "Fukushima", "Ibaraki", "Tochigi", "Gunma", "Saitama", "Chiba", "Tokyo", "Kanagawa", "Niigata", "Toyama", "Ishikawa", "Fukui", "Yamanashi", "Nagano", "Gifu", "Shizuoka", "Aichi", "Mie", "Shiga", "Kyoto", "Osaka", "Hyogo", "Nara", "Wakayama", "Tottori", "Shimane", "Okayama", "Hiroshima", "Yamaguchi", "Tokushima", "Kagawa", "Ehime", "Kochi", "Fukuoka", "Saga", "Nagasaki", "Kumamoto", "Oita", "Miyazaki", "Kagoshima", "Okinawa"];
const PREF_EASY = ["ほっかいどう", "あおもりけん", "いわてけん", "みやぎけん", "あきたけん", "やまがたけん", "ふくしまけん", "いばらきけん", "とちぎけん", "ぐんまけん", "さいたまけん", "ちばけん", "とうきょうと", "かながわけん", "にいがたけん", "とやまけん", "いしかわけん", "ふくいけん", "やまなしけん", "ながのけん", "ぎふけん", "しずおかけん", "あいちけん", "みえけん", "しがけん", "きょうとふ", "おおさかふ", "ひょうごけん", "ならけん", "わかやまけん", "とっとりけん", "しまねけん", "おかやまけん", "ひろしまけん", "やまぐちけん", "とくしまけん", "かがわけん", "えひめけん", "こうちけん", "ふくおかけん", "さがけん", "ながさきけん", "くまもとけん", "おおいたけん", "みやざきけん", "かごしまけん", "おきなわけん"];
const PREF_JA = ["北海道", "青森県", "岩手県", "宮城県", "秋田県", "山形県", "福島県", "茨城県", "栃木県", "群馬県", "埼玉県", "千葉県", "東京都", "神奈川県", "新潟県", "富山県", "石川県", "福井県", "山梨県", "長野県", "岐阜県", "静岡県", "愛知県", "三重県", "滋賀県", "京都府", "大阪府", "兵庫県", "奈良県", "和歌山県", "鳥取県", "島根県", "岡山県", "広島県", "山口県", "徳島県", "香川県", "愛媛県", "高知県", "福岡県", "佐賀県", "長崎県", "熊本県", "大分県", "宮崎県", "鹿児島県", "沖縄県"];
export function prefLabel(pref: string, lang: Lang): string {
  const i = PREF_JA.indexOf(pref);
  if (i < 0 || lang === "ja") return pref;
  return (lang === "en" ? PREF_EN[i] : PREF_EASY[i]) ?? pref;
}

const WD: Record<Lang, string[]> = {
  ja: ["日", "月", "火", "水", "木", "金", "土"],
  easy: ["日", "月", "火", "水", "木", "金", "土"],
  en: ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"],
};
const MON = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
export const weekdayOf = (iso: string, lang: Lang) => {
  const w = WD[lang][new Date(`${iso}T00:00:00Z`).getUTCDay()] ?? "";
  return isHoliday(iso) ? (lang === "en" ? `${w}, holiday` : `${w}・祝`) : w;
};
export function fmtDate(iso: string, lang: Lang): string {
  const [, m, d] = iso.split("-").map(Number);
  return lang === "en" ? `${MON[(m ?? 1) - 1]} ${d} (${weekdayOf(iso, lang)})` : `${m}月${d}日（${weekdayOf(iso, lang)}）`;
}
export function fmtRange(start: string, end: string | null, lang: Lang): string {
  return !end || end === start ? fmtDate(start, lang) : `${fmtDate(start, lang)}${lang === "en" ? " – " : "〜"}${fmtDate(end, lang)}`;
}
export const feeLabel = (fee: string, lang: Lang) => (fee === "無料" ? UI.free[lang] : fee);
