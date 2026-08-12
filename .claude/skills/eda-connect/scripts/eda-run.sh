#!/usr/bin/env bash
# 回路図が開いているウィンドウを自動選択して JS を実行する。
# ブリッジ再接続で windowId が変わるため、固定 ID を持たないこと。
set -u
here="$(cd "$(dirname "$0")" && pwd)"
probe="$(mktemp /tmp/eda-probe.XXXXXX.js)"
cat > "$probe" <<'JS'
const c = await eda.sch_PrimitiveComponent.getAll();
return {ok: Array.isArray(c), n: c.length};
JS
for w in $(curl -s http://localhost:49620/eda-windows | python3 -c 'import sys,json;print(" ".join(x["windowId"] for x in json.load(sys.stdin)["windows"] if x["connected"]))'); do
  if EDA_WINDOW_ID="$w" "$here/eda-exec.sh" "$probe" >/dev/null 2>&1; then
    rm -f "$probe"
    exec env EDA_WINDOW_ID="$w" "$here/eda-exec.sh" "$@"
  fi
done
rm -f "$probe"
echo "回路図が開いているウィンドウが見つかりません" >&2; exit 3
