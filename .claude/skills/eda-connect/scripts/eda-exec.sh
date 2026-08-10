#!/usr/bin/env bash
# EasyEDA ブリッジに JS ファイルを投げて結果を表示する。
#
# なぜファイル渡しか: ブリッジの POST /execute は `code` に JS 文字列を取るが、
# シェルの -d '...' で直接書くとクォートが壊れやすく、1 行に潰す必要があった。
# JSON 組み立てを python3 に任せることで **改行もコメントもそのまま通る**。
#
# 使い方:
#   eda-exec.sh <file.js>            ファイルを実行
#   echo 'return 1+1' | eda-exec.sh -  標準入力から実行
#   EDA_WINDOW_ID=<id> eda-exec.sh f.js   対象ウィンドウを明示
#
# 終了コード: 0 成功 / 2 ブリッジ未起動 / 3 EDA 未接続 / 4 実行エラー

set -euo pipefail

FILE="${1:-}"
if [[ -z "$FILE" ]]; then
	sed -n '2,17p' "$0"
	exit 64
fi

find_port() {
	for p in $(seq 49620 49629); do
		if curl -s -m 1 "http://127.0.0.1:${p}/health" 2>/dev/null | grep -q '"easyeda-bridge"'; then
			echo "$p"
			return 0
		fi
	done
	return 1
}

PORT=$(find_port) || {
	cat >&2 <<'MSG'
エラー: ブリッジが 49620-49629 で見つかりません。起動してください (Node 22 以上が必須):
  cd ~/.claude/skills/easyeda-api && ~/.nvm/versions/node/v22.23.2/bin/node scripts/bridge-server.mjs
MSG
	exit 2
}

HEALTH=$(curl -s -m 2 "http://127.0.0.1:${PORT}/health")
if ! grep -q '"edaConnected": *true' <<<"$HEALTH"; then
	cat >&2 <<MSG
エラー: ブリッジ (port ${PORT}) は動いていますが EasyEDA Pro が繋がっていません。
  1. EasyEDA Pro を起動してログイン
  2. 拡張 run-api-gateway を導入し、設定で「外部交互を許可」を ON
  3. curl -s http://127.0.0.1:${PORT}/health で edaConnected: true を確認
MSG
	exit 3
fi

PAYLOAD=$(mktemp)
trap 'rm -f "$PAYLOAD"' EXIT

python3 - "$FILE" "${EDA_WINDOW_ID:-}" >"$PAYLOAD" <<'PY'
import json, sys
path, window = sys.argv[1], sys.argv[2]
src = sys.stdin.read() if path == '-' else open(path, encoding='utf-8').read()
payload = {'code': src}
if window:
    payload['windowId'] = window
json.dump(payload, sys.stdout, ensure_ascii=False)
PY

curl -s -X POST "http://127.0.0.1:${PORT}/execute" \
	-H 'Content-Type: application/json' --data-binary @"$PAYLOAD" |
	python3 -c '
import json, sys
raw = sys.stdin.read()
try:
    d = json.loads(raw)
except Exception:
    print(raw)
    sys.exit(4)
if d.get("success"):
    print(json.dumps(d.get("result"), ensure_ascii=False, indent=2))
else:
    print("実行エラー: " + str(d.get("error")), file=sys.stderr)
    sys.exit(4)
'
