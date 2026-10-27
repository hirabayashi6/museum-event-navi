// 公開の関門：題名として成り立ち、種類が分かる催しだけをサイトに出す。落ちたものは要確認に回す
import type { NaviEvent } from "../structure.js";
import { rawReason } from "./raw-checks.js";

const BAD_TITLE = /小雨決行|雨天決行|^各日|\d+名(様)?$|^毎週.{1,4}曜日$|イベントカレンダーに戻る|始めます|量り売り|数量限定|入荷|販売開始|新商品|\s\.\.\.\s|開場時間|営業時間|周年を迎え|迎えます|チラシ|ポスター|PDF|詳細|こちら|もっと見る|一覧|ページ|販売|定休日|休館|参加しました|行いました|ました。?$|されます。?$|ください。?$|募集|受付期間|申込期限|必着|開館時間|入館料|観覧料|料金|アクセス|駐車場/;
// リンクの文字・注意書き・施設名だけの行
const NOT_TITLE = /Read More|見る$|案内$|紹介$|ご利用|展示替え|作品保護|^[＊*※(（]|(公民館|自然の家|資料館|史料館|博物館|美術館|記念館|文学館|センター|会館|ホール|公園)$|^\d{4}|検定$|メニュ|概要$|展示室\s*\d|終了|^\d+【|^.{0,2}【?展示室/i;
const TIME_ONLY = /^[\d０-９:：～〜\-ー\s時分午前後正AMPMam pm.,、]+$/;
// 日付・曜日・時刻だけの行（「01.23 Sat 14:00」）
const DATE_ONLY = /^[\d０-９.\/:：～〜\-ー\s()（）]*((Sun|Mon|Tue|Wed|Thu|Fri|Sat)(day)?\.?|[月火水木金土日祝])?[\d０-９.\/:：～〜\-ー\s()（）]*((Sun|Mon|Tue|Wed|Thu|Fri|Sat)(day)?\.?)?[\d０-９.\/:：～〜\-ー\s()（）]*$/;
// 種類の見出しに月表示が付いただけ（「スポーツ月」「グルメ月」「月別すべてのイベント月」）。正月・満月などは除く
const CATEGORY_MONTH = /^[^0-9０-９]{2,14}月$/;
const REAL_MONTH = /(正|満|新|三日|五|皐|睦|如|弥|卯|水無|文|葉|長|神無|霜|師)月$/;
// 状態の言葉だけ（「現在開催中」「開催予定」）
const STATUS_ONLY = /^(現在|ただいま)?(開催中|開催予定|近日開催|会期中|終了|予告)(の(展覧会|展示|企画展|特別展|イベント))?$/;

// 掃除は2回かける（かっこを消すと先頭に助詞が出てくることがあるため）
// 閉じかっこが欠けていれば補う（「特集展示『赤穂緞通」→「特集展示『赤穂緞通』」）
function closeBrackets(t: string): string {
  let out = t;
  for (const [o, c] of [["「", "」"], ["『", "』"], ["（", "）"]] as const) {
    if (out.split(o).length > out.split(c).length) out += c;
  }
  return out;
}

export function cleanPublicTitle(t: string): string {
  return closeBrackets(cleanOnce(cleanOnce(t)))
    .replace(/(開催)?の(お知らせ|ご案内)[!！]?$/, "")
    .replace(/^(の|中の)(?=[^ぁ-ん])/, "")
    .replace(/^[^】「」]{0,24}】/, "") // 「【大山歴史民俗資料館】」「の展覧会】」のような先頭の見出しの残り
    .trim();
}

function cleanOnce(t: string): string {
  return t
    // 日付を抜いた跡（「（まで）」「からまで」）と、先頭に残った助詞を消す
    .replace(/[（(]\s*(まで|から|より|～|〜)\s*[)）]/g, "")
    .replace(/(から|より)?まで(の|に|は)?(?=[^ぁ-ん]|$)/g, (m, _a, _b, off: number, str: string) => (off === 0 || /[\s（(「]/.test(str[off - 1] ?? "") ? "" : m))
    .replace(/^(に|は|を|が|と|で|の|へ|も|や|から|まで|より)(?=[^ぁ-ん])/, "")
    // 日付を抜いたあとに残った空のかっこ（「（）」「()」「【】」「［］」）を消す
    .replace(/[（(［\[【]\s*[・、,～〜\-\s]*\s*[)）］\]】]/g, "")
    .replace(/\s{2,}/g, " ")
    .replace(/^(更新|中|NEW|new|\d{1,2}\.\d{2}イベント情報|\d{1,2})\s*】?\s*(?=\S)/, "")
    .replace(/^【?(開催予定|開催中|受付中)】\s*/, "")
    // 「イベント＆新着情報 > ○○」「…/イベント情報 ○○」のような見出しの付いた題名は、最後の部分だけ使う
    .replace(/^.*[>＞›»]\s*(?=\S)/, "")
    .replace(/^.{0,40}(イベント情報|新着情報)\s*[\/／,、]\s*(?=\S)/, "")
    // パンくず（「HOME » ○○」「トップ > 展覧会 > ○○」）は最後の部分だけ使う
    .replace(/^(HOME|Home|TOP|Top|ホーム|トップ)\s*[»›>＞]\s*(.*[»›>＞]\s*)?/, "")
    // 「開催中の企画展 ○○」「現在開催中の展覧会：○○」の前置き
    .replace(/^(現在)?(開催中|開催予定|次回|今後)の?(企画展|特別展|展覧会|展示|イベント)\s*[:：]?\s*(?=\S)/, "")
    // 末尾に残った時刻（「9:00 17:00」「10:00～11:00」）、「を開催します！」「の開催」、閉じていない注記（「＜要事前申込」）
    .replace(/\s*\d{1,2}:\d{2}\s*[～〜~\-ー\s]\s*\d{1,2}:\d{2}\s*$/, "")
    .replace(/\s*(を|の)?(開催|実施)(します|いたします|中)?[!！。]*$/, "")
    .replace(/\s*[＜<][^＞>]*$/, "")
    // 末尾に残った会期（「9.18-12.13」「（R8.9.12～11.29）」）と、先頭に残った日付の切れ端（「-30 」）
    .replace(/\s*[（(]?\s*(R|令和)?\d{1,2}\.\d{1,2}(\.\d{1,2})?\s*[-～〜~]\s*\d{1,2}\.\d{1,2}(\.\d{1,2})?\s*[)）]?\s*$/, "")
    .replace(/^[-–~～]\s*\d{1,2}\s+/, "")
    .replace(/^[】\])）、。,:：・\s※]+/, "").replace(/[【\[（(]+$/, "").replace(/^(開催|日時|日 時|会期|期間)\s*】?\s*[:：]?\s*/, "").trim();
}

// 一覧ページの見出し（催しの題名ではない）
const HEADING = /^(開催中|開催予定|まもなく開催|今後|これから|過去|終了した|注目|おすすめ|今月|来月|\d{1,2}月|春|夏|秋|冬)?の?(イベント|催し|行事|展示|講座)(情報|一覧|案内|予定|カレンダー)?$|のイベント情報$/;

const EN_NAV = /^(home|top|press|news|access|menu|events?|information|info|contact|about( us)?|shop|online shop|read more|more|english|faq|exhibitions?|gallery|collections?|map|sitemap|privacy policy|page top|back)$/i;

export function rejectReason(e: NaviEvent): string | null {
  if (HEADING.test(e.title.trim()) || HEADING.test(cleanPublicTitle(e.title))) return "一覧の見出し";
  // 館名＋「企画展・イベント」のように、分類の言葉だけでできた行も見出し
  const words = cleanPublicTitle(e.title).replace(/^#/, "").split(/[・、,／/\s【】]+/).filter((w) => w && !/(館|園|ミュージアム|センター)$/.test(w));
  if (words.length && words.every((w) => /^(春の|夏の|秋の|冬の|今月の|今週の)?(体験|定例|展覧会|展示会?|企画展|特別展|常設展|講座|講演会?|イベント|ワークショップ|関連|情報|一覧|案内|催し物?|行事|教室|お知らせ|ニュース|トピックス|新着|予定|スケジュール)+$/.test(w))) return "一覧の見出し";
  const t = cleanPublicTitle(e.title);
  if (!e.kind) return "種類が判定できない";
  if (t.length < 5) return "題名が短い";
  if (t.length > 70) return "題名が長すぎる（文章の切れ端）";
  if (TIME_ONLY.test(t)) return "時刻だけ";
  if (DATE_ONLY.test(t)) return "日付・曜日だけ";
  if (STATUS_ONLY.test(t)) return "状態の言葉だけ";
  if (CATEGORY_MONTH.test(t) && !REAL_MONTH.test(t)) return "種類の見出し（月表示）";
  if (/^.{1,10}のイベント$/.test(t)) return "種類の見出し";
  // 市のサイトなどの共通の見出し（「今治市 イベント情報」）。題名の作り直しの対象（見出し）にする
  if (/(イベント|催し|行事)(情報|一覧|カレンダー)$|新着情報$/.test(t)) return "ページの見出し";
  if (BAD_TITLE.test(t)) return "催しではない語を含む";
  // 文章・お知らせ・報告は催しの題名ではない
  if (/。/.test(t)) return "文章（句点）";
  if (/(ました|ています|ておりま|でした|となります|いたします|致します)[!！]?$|ました[!！。]?/.test(t)) return "お知らせ・報告の文";
  if (/(認定|受賞|選定|採択|刊行|発行|登録され|掲載され)/.test(t)) return "お知らせの語";
  if (/(はまで|からまで|^まで|（まで|\(まで|日から$)/.test(t)) return "日付の抜けた跡";
  if (/^(中|開催中|期間中)の/.test(t) || /^(健康|福祉|子育て|くらし|観光|産業|ビジネス)[・、]/.test(t)) return "見出しの切れ端";
  if (NOT_TITLE.test(t)) return "リンク文字・注意書き・施設名";
  if (e.museum.includes(t) || t === e.museum) return "館名だけ";
  // 英語だけの題名は、2語以上で、メニューの言葉でなければ通す（「COSMIC SALON」など）
  if (!/[぀-ヿ一-鿿]/.test(t) && ((t.match(/[A-Za-z]{2,}/g) ?? []).length < 2 || EN_NAV.test(t.trim()))) return "日本語の題名がない";
  // 元の文章と照らし合わせて、古い催し・別の館の催し・名前と日付の組み違いを落とす
  return rawReason(e);
}
