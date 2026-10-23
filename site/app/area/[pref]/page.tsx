import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getEvents } from "@/lib/data";
import { PREFS } from "@/lib/types";
import { pageMeta } from "@/lib/seo";
import { AreaPage } from "@/components/AreaPage";
import { getLang } from "@/lib/i18n";

export const revalidate = 600;

type Props = { params: Promise<{ pref: string }> };

const decode = (s: string) => { try { return decodeURIComponent(s); } catch { return s; } };

export function generateStaticParams() {
  return PREFS.map((pref) => ({ pref }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const pref = decode((await params).pref);
  const n = (await getEvents()).filter((e) => e.pref === pref).length;
  return pageMeta({
    title: `${pref}の博物館イベント・ワークショップ（今週末・子ども向け）`,
    description: `${pref}の博物館・美術館・科学館のワークショップ、講座、展覧会を${n}件掲載。今週末の催し、子ども向け、無料の体験を、したいことから探せます。`,
    path: `/area/${encodeURIComponent(pref)}`,
    indexable: n > 0, // 該当ゼロのページは検索に出さない
  });
}

export default async function Page({ params }: Props) {
  const pref = decode((await params).pref);
  if (!(PREFS as readonly string[]).includes(pref)) notFound();
  return <AreaPage pref={pref} events={await getEvents()} lang={await getLang()} />;
}
