# 巡回（crawler）

| 段階 | コマンド | 入力 → 出力 |
| --- | --- | --- |
| 1 探索 | `npm run discover -- [--pref 宮崎県]` | 館マスタの確認URL → `data/discovery/discovered.json`、マスタのイベントページURL・SNS列 |
| 2 巡回 | `npm run crawl -- [--pref 宮崎県]` | イベントページ → `data/crawl/snapshots/`、増えた行を `data/crawl/changes/*.json` |
| 3 構造化 | `npm run extract` | 最新の changes → `data/events/{No}.json`、要確認は `data/review/queue.json` |
| 4 Instagram | （作成予定） | Business Discovery → changes と同じ形で構造化へ |

- アクセスは UA `MuseumEventNaviBot`、robots.txt 準拠、同一ホスト2秒間隔
- 人が確認した値（情報の確度＝「人が確認」）は機械で上書きしない
- キーは `crawler/.env` のみ（`LLM_API_KEY`、任意で `LLM_BASE_URL` `LLM_MODEL`）。コードに書かない
- The Events Calendar（WordPress）のサイトは公開APIから予定を取る
