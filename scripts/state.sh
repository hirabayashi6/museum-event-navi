#!/bin/bash
# 巡回の状態（名簿・前回のページ・抽出結果・キャッシュ）を暗号化して保存／復元する
#   pack   … data/ の必要な部分を固めて暗号化し state.enc を作る
#   unpack … state.enc を復号して data/ に戻す
# 合言葉は環境変数 STATE_PASSPHRASE（GitHub では Secrets、手元では crawler/.env）
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
OUT="${STATE_FILE:-$ROOT/state.enc}"
[ -n "${STATE_PASSPHRASE:-}" ] || { [ -f "$ROOT/crawler/.env" ] && STATE_PASSPHRASE="$(grep '^STATE_PASSPHRASE=' "$ROOT/crawler/.env" | cut -d= -f2-)"; }
[ -n "${STATE_PASSPHRASE:-}" ] || { echo "STATE_PASSPHRASE がありません"; exit 1; }
export STATE_PASSPHRASE
ENC=(openssl enc -aes-256-cbc -pbkdf2 -iter 200000 -salt -pass env:STATE_PASSPHRASE)
cd "$ROOT"
case "${1:-}" in
  pack)
    # 変更の記録（crawl/changes）は最新だけ、バックアップは入れない
    latest="$(ls data/crawl/changes 2>/dev/null | sort | tail -1)"
    tar -czf - --exclude='data/*backup*' --exclude='data/amenities_v1_*' --exclude='data/logs' --exclude='data/crawl/changes' \
      data/master data/crawl/state.json data/crawl/snapshots data/events data/sns data/discovery \
      data/kind_cache.json data/title_cache.json data/amenities.json data/verify.json data/review data/closed.json data/opendata \
      ${latest:+data/crawl/changes/$latest} 2>/dev/null | "${ENC[@]}" > "$OUT"
    echo "暗号化して保存：$(du -h "$OUT" | cut -f1)" ;;
  unpack)
    "${ENC[@]}" -d < "$OUT" | tar -xzf -
    echo "復元しました" ;;
  *) echo "使い方: state.sh pack|unpack"; exit 1 ;;
esac
