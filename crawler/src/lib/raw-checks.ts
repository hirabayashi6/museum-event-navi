// 元の前後の文章（raw）と日付を照らし合わせて、古い催し・別の館の催し・名前と日付の組み違いを落とす
// 抜き取り（10/27・作り直した題名100件）で約半分が誤りだったため。理由の言葉は repair-titles の対象にならないものにする
import type { NaviEvent } from "../structure.js";

const WEEK = "日月火水木金土";
// 終わった催しの報告
const PAST_WORD = /開催しました|行いました|終了しました|〔終了|【終了|実施しました|出展しました|ご参加いただき/;
// 他館の催しを集めたページ。文章に館名がなければ、その館の催しではない
const AGGREGATOR = /okayama-kanko\.jp|culture\.nagano\.jp|town\.toyako/;
// 日付の行から日付・時刻・決まり文句を除いた残り（これが長ければ、日付の行に別の催しの話が書いてある）
const DATE_NOISE = /(20\d{2}|令和\s*\d{1,2}|R\d{1,2})\s*(年度?|[.\/])?|\d{1,2}\s*[:：時]\s*\d{0,2}\s*分?|\d{1,2}\s*[月\/.]\s*\d{1,2}\s*日?|[(（][^)）]{0,40}[)）]|[\[［][^\]］]{0,6}[\]］]|\S{0,12}にて|開催|予定|開始|会期|期間|日時|開催日|開催期間|日程|時間|場所|会場|から|まで|より|午前|午後|正午|開場|開演|毎日|各日|土日祝|曜日|\d+\s*日?|(sun|mon|tue|wed|thu|fri|sat)[a-z]*\.?|[～〜~\-ー–、,・:：()（）◆■●□※【】\[\]\s]/gi;

const norm = (s: string) => s.normalize("NFKC");
const core = (s: string) => norm(s).replace(/[「」『』【】()（）\s・:：]/g, "");

function dateRe(iso: string): RegExp {
  const m = Number(iso.slice(5, 7));
  const d = Number(iso.slice(8, 10));
  return new RegExp(`(?<!\\d)0?${m}\\s*[月/.]\\s*0?${d}(?!\\d)\\s*日?`);
}

// 文章に書かれた年（年度は翌年の3月まで続くので+1）がすべて催しの年より前なら、年を読み違えている
function yearTooLate(e: NaviEvent, raw: string): boolean {
  const ys = [...raw.matchAll(/(20\d{2})\s*(年度|年|[\/.])|令和\s*(\d{1,2})\s*(年度|年)/g)].map((m) => {
    const y = m[1] ? Number(m[1]) : 2018 + Number(m[3]);
    return (m[2] ?? m[4]) === "年度" ? y + 1 : y;
  });
  return ys.length > 0 && Math.max(...ys) < Number(e.start_date.slice(0, 4));
}

// 開始日・終了日に添えられた曜日が、その年の曜日と合わない（年が書いてあればサイトの書き間違いとみなして通す）
// かっこなしの曜日は「16日日曜日」（日の後ろに曜）と「2/22土に」（後ろがひらがな・区切り。「10/31日」は日付の日なので除く）だけを曜日とみなす
function weekdayOff(iso: string, raw: string): "合う" | "合わない" | "なし" {
  const m = Number(iso.slice(5, 7));
  const d = Number(iso.slice(8, 10));
  const day = `(?<!\\d)0?${m}\\s*`;
  const hit =
    raw.match(new RegExp(`${dateRe(iso).source}\\s*[(（]\\s*([日月火水木金土])`)) ??
    raw.match(new RegExp(`${day}月\\s*0?${d}\\s*日\\s*([日月火水木金土])(?=曜)`)) ??
    raw.match(new RegExp(`${day}\\/\\s*0?${d}([月火水木金土])(?=[ぁ-ん曜\\s、,)）]|$)`));
  if (!hit) return "なし";
  if (new RegExp(`${iso.slice(0, 4)}\\s*[年/.]\\s*${dateRe(iso).source}`).test(raw)) return "合う";
  return WEEK[new Date(`${iso}T00:00:00Z`).getUTCDay()] === hit[1] ? "合う" : "合わない";
}
// 開始日の曜日が合っていれば、終了日の曜日の食い違いはサイトの書き間違いとみなす
function weekdayMismatch(e: NaviEvent, raw: string): boolean {
  const start = weekdayOff(e.start_date, raw);
  if (start !== "なし") return start === "合わない";
  return !!e.end_date && weekdayOff(e.end_date, raw) === "合わない";
}

// 題名に入った年（「文化祭2023」）がすべて催しの年の2年以上前。「コレクション2026」は翌年の初めまで続くので1年前は通す
// 「1967-2024」のような活動期間の終わりの年は数えない
function titleYearOld(e: NaviEvent): boolean {
  const ys = [...norm(e.title).matchAll(/(?<!(19|20)\d{2}\s*[-–～〜]\s*)(20\d{2})(?!\d)/g)].map((m) => Number(m[2]));
  return ys.length > 0 && Math.max(...ys) < Number(e.start_date.slice(0, 4)) - 1;
}

// 「期間：」「日時」などの説明の見出しで始まる行（日付の行でも、隣の題名の説明）
const LABEL = /^[◆■●・\s]*(日\s*時|期\s*間|会\s*期|開催日|開催期間|日\s*程|場\s*所|会\s*場|対\s*象|定\s*員|料\s*金|参加費|講\s*師|内\s*容|時\s*間|申\s*込|主\s*催)/;

// 名前のように見える行か（日付だけ・注意書き・パンくず・展示室の見出し・説明の行は除く）
function nameLike(seg: string): boolean {
  if (LABEL.test(seg) || /^[※*＊]|[>»›]|展示室\s*\d|円引|入館料|観覧料|^[^ぁ-んァ-ヶ一-鿿]*$/.test(seg)) return false;
  return seg.replace(DATE_NOISE, "").length >= 4;
}

// 題名と同じ言葉（4字以上）が行にあれば、同じ催しの行とみなす。館名は除いて比べる
function sharesWords(seg: string, t: string): boolean {
  const c = core(seg);
  for (let i = 0; i + 4 <= t.length; i++) if (c.includes(t.slice(i, i + 4))) return true;
  return false;
}

// 分類の言葉（「コレクション展示」など）だけが同じでも、同じ催しとはいえない
const GENERIC = /コレクション展示?|企画展示?|特別展示?|常設展示?|テーマ展示?|展覧会|ギャラリートーク|ワークショップ|講演会|講座|イベント|展示/g;
const sharesName = (seg: string, t: string) => sharesWords(core(seg).replace(GENERIC, ""), t.replace(GENERIC, ""));
// チラシ・PDFのリンクの文字（その下の日付と説明は、別の展示のことがある）
const LINK_LABEL = /^(チラシ|ポスター|リーフレット)|PDF|ダウンロード/i;

// 日付の行が、題名とは別の催しのものか
function otherEventLine(seg: string, t: string): boolean {
  const s = seg.replace(/※.*$/, "");
  if (LABEL.test(s) || sharesWords(s, t)) return false;
  // 日付の飾りを消したあとに残った曜日の字も消す。「〜の体験内容」のような、その日付の説明は同じ催し
  const rest = s.replace(DATE_NOISE, "").replace(/[日月火水木金土祝]/g, "");
  if (rest.startsWith("の")) return false;
  // 「1月29日(金)～3月15日(月) 御所人形」のような一覧の行：日付のあとに別の名前がある
  if (/^[【\[(（◆■●▪・\s]*((\d{4}|令和\s*\d{1,2})\s*[年.\/]\s*)?\d{1,2}\s*[月\/.]\s*\d{1,2}/.test(s)) return rest.length >= 2;
  // 日付を含む長い文章や、別の「」の名前がある行で、題名と同じ言葉がなければ、別の催しの話
  return rest.length >= 25 || /[「『][^」』]{2,}[」』]/.test(s);
}

// 開始日の行が題名とは別の催しのものなら、組み違いとみなす
function pairBroken(e: NaviEvent): boolean {
  // 正規化すると「／」は「/」になって日付の「1/29」と見分けられないので、正規化の前に行に分ける
  const segs = (e.raw ?? "").split(/\s+／\s+/).map(norm);
  if (segs.length < 2) return false;
  const re = dateRe(e.start_date);
  const t = core(e.title).replace(core(e.museum), "");
  // 同じ日付の行がいくつかあれば、題名のある行を正とする
  if (t.length < 4 || segs.some((s) => re.test(s) && sharesWords(s, t))) return false;
  const di = segs.findIndex((s) => re.test(s));
  if (di < 0) return false;
  const dateSeg = segs[di] ?? "";
  // 題名の行は、分類の言葉を除いても同じ言葉がある行を先に探す
  const found = segs.findIndex((s, i) => i !== di && sharesName(s, t));
  const ti = found >= 0 ? found : segs.findIndex((s, i) => i !== di && sharesWords(s, t));
  if (ti < 0) return false;
  if (otherEventLine(dateSeg, t)) return true;
  // 「チラシ【○○展】 ／ 日付 ／ 別の展示の説明」：題名がリンクの文字で、日付の後ろの説明に題名の言葉がない
  const after = segs[di + 1];
  if (ti === di - 1 && LINK_LABEL.test(segs[ti] ?? "") && after !== undefined && nameLike(after) && !sharesWords(after, t)) return true;
  // 題名が日付のすぐ後ろにあり、日付の前の行にも別の名前があれば、日付がどちらのものか分からない
  const before = segs[di - 1];
  return ti === di + 1 && before !== undefined && before.length < 40 && !/[。！!]/.test(before) && nameLike(before) && !t.includes(core(before)) && !sharesName(before, t);
}

// 年・曜日・まとめサイト・締切日の決まり（題名によらない）。当たるものは題名を作り直しても載らない
export function staleReason(e: NaviEvent): string | null {
  const url = e.source_url ?? "";
  if (AGGREGATOR.test(url) && !norm(e.raw ?? "").includes(norm(e.museum).replace(/[（(].*$/, ""))) return "まとめサイトの他館の催し";
  if (!e.raw) return null;
  const raw = norm(e.raw);
  // Instagramは投稿が新しく、作家の経歴の年や「次回は〜開催します」を含むため、年と報告の決まりは当てない
  const ig = /instagram\.com/.test(url);
  if (!ig && PAST_WORD.test(raw)) return "終わった催しの報告";
  if (!ig && yearTooLate(e, raw)) return "書かれた年より後の年に置いている";
  if (weekdayMismatch(e, raw)) return "曜日が合わない（年の読み違い）";
  if (titleYearOld(e)) return "名前に古い年が入っている";
  if (new RegExp(`${dateRe(e.start_date).source}[^/]{0,8}(必着|締切|締め切り|申込締)`).test(raw)) return "申込の締切日を開催日にしている";
  return null;
}

export function rawReason(e: NaviEvent): string | null {
  const stale = staleReason(e);
  if (stale) return stale;
  // Instagramの投稿は「＼…／」の飾りがあり、行の並びで判断できないので当てない
  if (e.raw && !/instagram\.com/.test(e.source_url ?? "") && pairBroken(e)) return "名前と日付の組み違い";
  return null;
}
