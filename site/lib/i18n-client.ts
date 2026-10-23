// クライアント部品でも使える言語の定義（cookies を読まない）
export type Lang = "ja" | "en" | "easy";
export const LANGS: { code: Lang; label: string }[] = [
  { code: "ja", label: "日本語" },
  { code: "en", label: "English" },
  { code: "easy", label: "やさしい にほんご" },
];
