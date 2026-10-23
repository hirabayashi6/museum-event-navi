import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getEvents } from "@/lib/data";
import { PREFS } from "@/lib/types";
import { applyFilters, parseFilters } from "@/lib/filters";
import { wantBySlug } from "@/lib/areas";
import { pageMeta } from "@/lib/seo";
import { AreaPage } from "@/components/AreaPage";
import { getLang } from "@/lib/i18n";

export const revalidate = 600;

type Props = { params: Promise<{ pref: string; want: string }> };

const decode = (s: string) => { try { return decodeURIComponent(s); } catch { return s; } };
const PHRASE: Record<string, string> = { つくる: "ワークショップ・工作体験", "観察・体験する": "観察会・体験", 聞いて学ぶ: "講座・講演・ギャラリートーク", 見て味わう: "展覧会・企画展", 外で体を動かす: "野外の観察会・まち歩き" };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const p = await params;
  const pref = decode(p.pref);
  const want = wantBySlug(p.want);
  if (!want) return {};
  const n = applyFilters((await getEvents()).filter((e) => e.pref === pref), parseFilters({ want })).length;
  return pageMeta({
    title: `${pref}の博物館の${PHRASE[want]}（今週末・子ども向け）`,
    description: `${pref}の博物館・美術館・科学館で開かれる${PHRASE[want]}を${n}件掲載。日にち・対象・料金・予約の要否が一目で分かります。`,
    path: `/area/${encodeURIComponent(pref)}/${p.want}`,
    indexable: n > 0,
  });
}

export default async function Page({ params }: Props) {
  const p = await params;
  const pref = decode(p.pref);
  const want = wantBySlug(p.want);
  if (!(PREFS as readonly string[]).includes(pref) || !want) notFound();
  return <AreaPage pref={pref} want={want} events={await getEvents()} lang={await getLang()} />;
}
