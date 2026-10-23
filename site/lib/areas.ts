import { WANTS, type Want } from "./types";

// 県×したいことのページの URL（英字の短い名前）
export const WANT_SLUGS: Record<Want, string> = {
  つくる: "make",
  "観察・体験する": "observe",
  聞いて学ぶ: "learn",
  見て味わう: "exhibition",
  外で体を動かす: "outdoor",
};

export function wantBySlug(slug: string): Want | undefined {
  return (Object.keys(WANTS) as Want[]).find((w) => WANT_SLUGS[w] === slug);
}
