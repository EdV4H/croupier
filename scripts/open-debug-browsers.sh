#!/bin/bash
# Trust Bank デバッグ用: 複数のシークレットウィンドウを開く
# 各ウィンドウは独立したセッション（Cookie/LocalStorage別）

PORT="${1:-9614}"
BASE_URL="http://localhost:${PORT}"
PLAYERS="${2:-4}"

echo "Opening ${PLAYERS} browser windows for ${BASE_URL}..."

for i in $(seq 1 "$PLAYERS"); do
  # Chrome: 各ウィンドウに個別のuser-data-dirを使い完全に独立させる
  TMPDIR=$(mktemp -d)
  open -na "Google Chrome" --args \
    --incognito \
    --user-data-dir="$TMPDIR" \
    --window-size=800,600 \
    --window-position=$((200 + (i-1) * 100)),$((100 + (i-1) * 50)) \
    "$BASE_URL"
  echo "  Player $i: opened (tmpdir: $TMPDIR)"
done

echo "Done! Each window has its own session."
echo "Tip: Set different player names in each window."
