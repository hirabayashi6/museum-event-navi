export const KINDS = ["ワークショップ", "講座・公演・音楽イベント", "ギャラリートーク", "観察会・野外", "特別展・企画展", "常設展"] as const;
export const AUDIENCES = ["未就学", "小学生低学年", "小学生高学年", "中高生", "大人", "親子"] as const;
export type Kind = (typeof KINDS)[number];
export type Audience = (typeof AUDIENCES)[number];

export type NaviEvent = {
  id: string;
  no: string;
  museum: string;
  pref: string;
  city: string;
  title: string;
  kind: Kind | null;
  start_date: string;
  end_date: string | null;
  time: string | null;
  audience: Audience[];
  fee: string | null;
  reservation: "必要" | "不要" | "不明";
  place: string | null;
  capacity?: string | null;
  deadline?: string | null;
  apply?: string | null;
  bring?: string | null;
  lecturer?: string | null;
  category?: string;
  // 館の設備（授乳室・多目的トイレ・おむつ替え・ベビーカー貸出）
  amen?: { nursing: boolean; toilet: boolean; diaper: boolean; stroller: boolean };
  source_url: string;
  method: string;
  confidence: number;
};

export type Museum = { no: string; name: string; pref: string; city: string; category: string; url: string; instagram: string | null; closed?: string; amen?: { nursing: boolean; toilet: boolean; diaper: boolean; stroller: boolean } };

// 「何をしたいか」と種類の対応
export const WANTS = {
  つくる: ["ワークショップ"],
  "観察・体験する": ["観察会・野外", "ワークショップ"],
  聞いて学ぶ: ["講座・公演・音楽イベント", "ギャラリートーク"],
  見て味わう: ["特別展・企画展", "常設展"],
  外で体を動かす: ["観察会・野外"],
} as const satisfies Record<string, readonly Kind[]>;
export type Want = keyof typeof WANTS;

// 家族向けの初期値：常設展は「いつでも行ける」ので一覧からは外す
export const DEFAULT_KINDS: Kind[] = ["ワークショップ", "講座・公演・音楽イベント", "ギャラリートーク", "観察会・野外", "特別展・企画展"];

export const PREFS = [
  "北海道", "青森県", "岩手県", "宮城県", "秋田県", "山形県", "福島県", "茨城県", "栃木県", "群馬県", "埼玉県", "千葉県", "東京都", "神奈川県",
  "新潟県", "富山県", "石川県", "福井県", "山梨県", "長野県", "岐阜県", "静岡県", "愛知県", "三重県", "滋賀県", "京都府", "大阪府", "兵庫県",
  "奈良県", "和歌山県", "鳥取県", "島根県", "岡山県", "広島県", "山口県", "徳島県", "香川県", "愛媛県", "高知県", "福岡県", "佐賀県", "長崎県",
  "熊本県", "大分県", "宮崎県", "鹿児島県", "沖縄県",
] as const;
