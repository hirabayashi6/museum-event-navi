// SEO の共通設定。社内確認中は SEO_INDEX が未設定なので、全ページを検索エンジンから除外する
import type { Metadata } from "next";

export const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://navi.museumpick.com";
export const SITE_NAME = "博物館イベントナビ";
export const INDEXABLE = process.env.SEO_INDEX === "1";

export function robotsFor(indexable = true): Metadata["robots"] {
  return INDEXABLE && indexable ? { index: true, follow: true } : { index: false, follow: INDEXABLE };
}

export function pageMeta(opts: { title: string; description: string; path: string; image?: string; indexable?: boolean }): Metadata {
  const image = opts.image ?? "/images/hist-ws-01.webp";
  return {
    title: opts.title,
    description: opts.description,
    alternates: { canonical: opts.path },
    robots: robotsFor(opts.indexable ?? true),
    openGraph: { title: opts.title, description: opts.description, url: opts.path, siteName: SITE_NAME, locale: "ja_JP", type: "website", images: [{ url: image, width: 1200, height: 800 }] },
    twitter: { card: "summary_large_image", title: opts.title, description: opts.description, images: [image] },
  };
}

// パンくずの構造化データ
export function breadcrumbLd(items: { name: string; path: string }[]) {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map((it, i) => ({ "@type": "ListItem", position: i + 1, name: it.name, item: `${SITE_URL}${it.path}` })),
  };
}

export function JsonLd({ data }: { data: unknown }) {
  return <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(data).replace(/</g, "\\u003c") }} />;
}

// 外部リンクは http(s) だけを通す（巡回で集めたURLに javascript: などが紛れても実行させない）
export function safeUrl(u: string | null | undefined): string | null {
  if (!u) return null;
  try {
    const url = new URL(u);
    return url.protocol === "http:" || url.protocol === "https:" ? url.href : null;
  } catch {
    return null;
  }
}
