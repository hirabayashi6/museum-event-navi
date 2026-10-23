// 題名・本文の言葉から、種類・対象・料金・申込を決まりで判定する（LLMを使わない）

export const KINDS = ["ワークショップ", "講座・公演・音楽イベント", "ギャラリートーク", "観察会・野外", "特別展・企画展", "常設展"] as const;
export const AUDIENCES = ["未就学", "小学生低学年", "小学生高学年", "中高生", "大人", "親子"] as const;
export type Kind = (typeof KINDS)[number];
export type Audience = (typeof AUDIENCES)[number];

export function kindOf(title: string, body = ""): Kind | null {
  const t = title;
  if (/ギャラリートーク|学芸員による解説|展示解説|ギャラリーツアー|対話型鑑賞/.test(t)) return "ギャラリートーク";
  if (/観察会|探検|自然散策|野外|フィールド|まち歩き|街歩き|ウォーク|ハイキング|虫さがし|虫をさがし|星空|バードウォッチング/.test(t)) return "観察会・野外";
  if (/ワークショップ|工作|体験|教室|作ろう|つくろう|作り|づくり|染め|描こう|やってみよう|チャレンジ|実験|サイエンス|手作り/.test(t)) return "ワークショップ";
  if (/講座|講演|講話|シンポジウム|フォーラム|公演|コンサート|演奏|音楽|ライブ|上映|朗読|読み聞かせ|よみきかせ|おはなし会|ショー|落語|講談|セミナー|お話/.test(t)) return "講座・公演・音楽イベント";
  if (/常設展/.test(t)) return "常設展";
  if (/展|展示|コレクション/.test(t)) return "特別展・企画展";
  if (body) return kindOf(body.slice(0, 300));
  return null;
}

export function audienceOf(text: string): Audience[] {
  const out = new Set<Audience>();
  if (/未就学|幼児|園児|[3-6３-６]歳/.test(text)) out.add("未就学");
  if (/小学生以上|小学校\s*1\s*年生?以上/.test(text)) ["小学生低学年", "小学生高学年", "中高生", "大人"].forEach((a) => out.add(a as Audience));
  else if (/低学年|小学\s*[1-3１-３]\s*[～~-]\s*[3３]年/.test(text)) out.add("小学生低学年");
  else if (/高学年|小学\s*[4-6４-６]\s*[～~-]\s*[6６]年/.test(text)) out.add("小学生高学年");
  else if (/小学生|小学校|児童/.test(text)) { out.add("小学生低学年"); out.add("小学生高学年"); }
  if (/中学|高校|中高生|高校生/.test(text)) out.add("中高生");
  if (/一般|大人|成人|どなたでも|どなたも|どなた様でも|年齢不問/.test(text)) out.add("大人");
  if (/親子|保護者同伴|保護者の同伴|ご家族|家族|どなたでも/.test(text)) out.add("親子");
  return AUDIENCES.filter((a) => out.has(a));
}

export function feeOf(text: string): string | null {
  const yen = text.match(/[\d,０-９，]+\s*円(?:\s*[（(][^）)]{0,20}[）)])?/);
  if (/無料/.test(text) && !yen) return "無料";
  if (yen) return yen[0].replace(/\s+/g, "");
  return null;
}

export function reservationOf(text: string): "必要" | "不要" | "不明" {
  if (/申し?込み?不要|申込み不要|予約不要|自由参加|当日自由|当日受付|直接会場/.test(text)) return "不要";
  if (/要申込|要予約|事前申し?込|申込制|予約制|申し?込み?方法|申込締切|抽選|先着|予約受付|申込受付|お申し?込み/.test(text)) return "必要";
  return "不明";
}

// 催しではない行（開館日・募集・報告など）
export const NOT_EVENT = /ありません|閉室|工事|受付時間|窓口|営業時間|譲渡会|開館日|休館|休園|開館時間|募集|結果発表|審査結果|ご報告|報告|終了しました|中止|延期|お詫び|求人|入札|メンテナンス|更新しました|アーカイブ/;

// 題名として意味をなさない見出し
export const GENERIC_TITLE = /^(HOME|ホーム|お知らせ|新着情報|イベント|イベント情報|イベント案内|講座案内|行事案内|展示案内|トピックス|ニュース|.*年譜|.*カレンダー?|.*スケジュール|企画展示室|常設展示室|展示室.*|エントランス|回廊.*|ホール|ギャラリー|ロビー|.*階)$/;
