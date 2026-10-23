# 博物館イベントナビ

子どもと行ける博物館・水族館・動物園のイベントを、全国の館の公式サイトとSNSから集めて紹介するサイトです。
運営：株式会社ミュージアムピック（https://museumpick.com）

- サイト：`site/`（Next.js）
- 巡回：`crawler/`（公式サイトの巡回、Instagram の Business Discovery、決まりベースの構造化、無料LLMによる題名の整え）
- 定期実行：`.github/workflows/navi.yml`

## 方針
- robots.txt を守り、同じサイトへは間隔をあけて取得します（UA: MuseumEventNaviBot）
- 載せるのは日にち・場所・対象・料金などの事実と、元のページへのリンクだけです。紹介文・写真・投稿の本文は転載しません
- 訂正・掲載停止のご依頼：info@museumpick.com

巡回の状態（館の名簿を含む）は暗号化して保存しており、このリポジトリには含めていません。
