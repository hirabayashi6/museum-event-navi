import Link from "next/link";
import { getLang } from "@/lib/i18n";

const TEXT = {
  ja: { h: "ページが見つかりませんでした", p: "催しが終わったか、内容が変わった可能性があります。", b: "今週末の催しを見る" },
  en: { h: "Page not found", p: "The event may have ended or changed.", b: "See events this weekend" },
  easy: { h: "ページが 見つかりません", p: "イベントが おわったか、 かわった かもしれません。", b: "今週の 土日の イベントを 見る" },
};

export default async function NotFound() {
  const c = TEXT[await getLang()];
  return (
    <div className="prose" style={{ padding: "40px 0" }}>
      <h1 className="page-title">{c.h}</h1>
      <p>{c.p}</p>
      <p><Link className="btn" href="/events?when=this-weekend">{c.b}</Link></p>
    </div>
  );
}
