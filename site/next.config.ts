import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // ローカルの公開用データ（data/*.json）を本番の関数にも同梱する
  outputFileTracingIncludes: { "/**": ["./data/*.json", "./public/images/manifest.json"] },
  poweredByHeader: false,
  // ブラウザ向けの防御：他サイトへの埋め込み禁止・種類のなりすまし防止・参照元の最小化・不要な機能の停止
  async headers() {
    return [{
      source: "/:path*",
      headers: [
        { key: "X-Frame-Options", value: "DENY" },
        { key: "X-Content-Type-Options", value: "nosniff" },
        { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
        { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), payment=()" },
        { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains" },
        { key: "Content-Security-Policy", value: "frame-ancestors 'none'; base-uri 'self'; object-src 'none'; form-action 'self'" },
      ],
    }];
  },
};

export default nextConfig;
