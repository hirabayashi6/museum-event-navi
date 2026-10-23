# 博物館イベントナビ（サイト）

Next.js 16（App Router）。開発: `npm run dev`（http://localhost:3220）

## データの流れ（随時反映）
1. GitHub Actions が週2回 `crawler` の `npm run update`（巡回→構造化→書き出し）を実行
2. 書き出しが Supabase の `events` `museums` に反映（`supabase/schema.sql`）
3. 最後に `/api/revalidate` を呼び、サイトのページを作り直す（ページは10分ごとにも自動更新）
4. Supabase 未設定のときは、同梱の `data/*.json` を読む（ローカル確認用）

## 環境変数（Vercel）
`.env.example` を参照。`BASIC_AUTH_USER` / `BASIC_AUTH_PASSWORD` を入れている間は社内限定（Basic認証）。
