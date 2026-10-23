import type { Metadata } from "next";
import Link from "next/link";
import { SideMenu } from "@/components/SideMenu";
import { cookies } from "next/headers";
import { SITE_URL, SITE_NAME, robotsFor, JsonLd } from "@/lib/seo";
import { PREFS } from "@/lib/types";
import { Suspense } from "react";
import { LangSwitch } from "@/components/LangSwitch";
import { getLang, t, prefLabel } from "@/lib/i18n";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: "博物館イベントナビ｜今週末、近くの博物館で", template: "%s｜博物館イベントナビ" },
  description: "全国の博物館・美術館・科学館のワークショップや講座、展覧会を、したいこと・場所・日にちで探せます。",
  metadataBase: new URL(SITE_URL),
  applicationName: SITE_NAME,
  // 社内確認中は検索エンジンに載せない（SEO_INDEX=1 で公開）
  robots: robotsFor(),
  openGraph: { siteName: SITE_NAME, locale: "ja_JP", type: "website", images: [{ url: "/images/hist-ws-01.webp", width: 1200, height: 800 }] },
  twitter: { card: "summary_large_image" },
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const lang = await getLang();
  return (
    <html lang={lang === "en" ? "en" : "ja"}>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link href="https://fonts.googleapis.com/css2?family=Zen+Maru+Gothic:wght@500;700;900&display=swap" rel="stylesheet" />
      </head>
      <body>
        <header className="head">
          {/* 運営のロゴ（ガイドラインの余白込みの画像。横長は80px以上で使う） */}
          <a className="head-brand" href="https://museumpick.com" target="_blank" rel="noopener noreferrer" aria-label="museumpick（運営）">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/brand/logo-h.png" alt="museumpick" width={150} height={36} />
          </a>
          <Link href="/" className="logo">
            <span className="logo-main">{t(lang, "siteName")}</span>
            <span className="logo-sub">{t(lang, "tagline")}</span>
          </Link>
          <div className="head-right">
            <Suspense fallback={null}><LangSwitch current={lang} /></Suspense>
            <form className="head-search" action="/events" role="search">
              <input type="search" name="q" placeholder={t(lang, "searchPh")} aria-label={t(lang, "searchPh")} />
            </form>
          </div>
        </header>
        {/* スマホでは左メニューの代わりに、よく使う入口を横に並べる */}
        <nav className="quicknav" aria-label="よく使う入口">
          <Link href="/events?when=this-weekend">{t(lang, "thisWeekend")}</Link>
          <Link href="/events?when=next-weekend">{t(lang, "nextWeekend")}</Link>
          {lang === "easy" ? (
            <>
              <Link href="/events?with=family">{t(lang, "family")}</Link>
              <Link href="/events?with=friends">{t(lang, "friends")}</Link>
            </>
          ) : (
            <>
              <Link href="/events?want=つくる">{lang === "en" ? "Make" : "つくる"}</Link>
              <Link href="/events?want=聞いて学ぶ">{lang === "en" ? "Talks" : "聞いて学ぶ"}</Link>
            </>
          )}
          <Link href="/events">{t(lang, "searchAll")}</Link>
        </nav>
        <div className="shell">
          <SideMenu lang={lang} pref={decodeURIComponent((await cookies()).get("navi_pref")?.value ?? "")} />
          <main className="content">{children}</main>
        </div>
        <JsonLd data={{ "@context": "https://schema.org", "@type": "WebSite", name: SITE_NAME, url: SITE_URL, inLanguage: "ja", publisher: { "@type": "Organization", name: "株式会社ミュージアムピック", url: "https://museumpick.com", logo: `${SITE_URL}/brand/symbol.png` }, potentialAction: { "@type": "SearchAction", target: `${SITE_URL}/events?q={search_term_string}`, "query-input": "required name=search_term_string" } }} />
        <footer className="foot">
          <nav className="foot-prefs" aria-label={t(lang, "prefNav")}>
            {PREFS.map((p) => <Link key={p} href={`/area/${encodeURIComponent(p)}`}>{prefLabel(p, lang)}</Link>)}
          </nav>
          <p className="foot-lead">{t(lang, "footLead")}</p>
          <p><Link href="/about">{t(lang, "about")}</Link><Link href="/about#fix">{t(lang, "fix")}</Link><a href="https://museumpick.com/legal/policy">{t(lang, "privacy")}</a></p>
          <p className="foot-small">{t(lang, "footSmall")}</p>
        </footer>
      </body>
    </html>
  );
}
