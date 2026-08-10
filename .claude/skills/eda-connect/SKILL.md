---
name: eda-connect
description: EasyEDA Pro ブリッジへの接続確認と JS 実行の共通基盤。ブリッジ稼働・EDA 接続・対象ウィンドウ・現在のドキュメント種別を 1 コマンドで確認し、任意の JS ファイルを EDA 上で実行する。EasyEDA の API を呼ぶ作業の入口として毎回最初に使う。
---

# eda-connect — ブリッジ接続と JS 実行

EasyEDA Pro の `eda.*` API を叩くための土台。**他の eda-* skill はすべてこの `eda-exec.sh` を経由する。**

## 構成

```text
Claude ──HTTP──> bridge-server.mjs ──WebSocket──> run-api-gateway 拡張 ──> eda.* API
                (49620-49629 を走査)   (EDA 側から外向きに接続してくる)
```

前提は [`docs/07`](../../../docs/07-easyeda-schematic-rules.md) §3 を参照。**ブリッジを先に起動**しておくこと。

## 使い方

```bash
# 1. 接続確認 (作図系 API を呼ぶ前に必ず実行)
.claude/skills/eda-connect/scripts/eda-exec.sh .claude/skills/eda-connect/scripts/connect-check.js

# 2. 任意の JS を実行
.claude/skills/eda-connect/scripts/eda-exec.sh path/to/code.js
echo 'return await eda.sch_PrimitiveWire.getAll();' | .claude/skills/eda-connect/scripts/eda-exec.sh -

# 3. 複数ウィンドウがある場合は対象を明示
curl -s http://localhost:49620/eda-windows
EDA_WINDOW_ID=<id> .claude/skills/eda-connect/scripts/eda-exec.sh path/to/code.js
```

`scripts/*.sh` は clone 直後は実行権限が無いことがある (`chmod +x .claude/skills/*/scripts/*.sh`)。
ブリッジ本体は **Node 22 以上**で起動する (20 系では動かない)。

### 終了コードと復旧手順

| コード | 意味 | 復旧 |
| --- | --- | --- |
| `0` | 成功 | — |
| `2` | ブリッジ未起動 | `cd ~/.claude/skills/easyeda-api && <node22> scripts/bridge-server.mjs` |
| `3` | EDA 未接続 | 下記「`3` が出たとき」 |
| `4` | 実行エラー | コード側の問題 (JS 例外・シグネチャ違い) |

**`3` が出たとき。** まず起動順を疑う。拡張の自動接続は `3 秒 × 5 回 = 約 15 秒`で打ち切られ、
以後は再試行しない (`activationEvents` は `onStartupFinished` のみ)。EDA を先に起動していたら必ずこうなる。

1. **トップメニュー `API Gateway` → `Reconnect`** ← 大半はこれで直る (GUI 操作。API からは叩けない)
2. `API Gateway` → `Toggle Auto-Connect Status` を `Auto-Connect enabled` 側にしておく
3. それでも駄目なら拡張設定の**「外部交互を許可」が OFF**

以後は **ブリッジ → EasyEDA Pro** の順で起動する。

### Online モードであること (作図前の必須確認)

半離線モードだと**クラウドプロジェクトが 1 件も見えない**。ログインはできているので原因を見誤りやすい
(`getUserInfo()` がローカル用の別 uuid / 空の `customerCode` を返す)。
`connect-check.js` は `isOnlineMode !== true` とプロジェクト 0 件を warning に出すので、
**warnings が空になるまで作図を始めない** (回路図未オープンの warning は除く)。

## コードを書くときの規則 (事故が多い順)

1. **`return` 必須** — `console.log` はブリッジに捕捉されない。値は必ず return する。
2. **`await` 必須** — ほぼ全ての API が Promise を返す。付け忘れると Promise オブジェクトが返る。
3. **座標単位を間違えない** — 回路図は **0.01 inch (10 mil)**、PCB は **1 mil**。同じ 1 mm が
   回路図では約 3.937、PCB では 39.37。**10 倍ずれるのはこれが原因。**
4. **Y 符号を推測しない** — `getAll()` の戻り値では矩形の `topLeftY` が負、テキストの `y` が正になる
   ([`docs/07`](../../../docs/07-easyeda-schematic-rules.md) §2)。ただしそれは**読み取り値**であって
   `create()` が同じ符号を取るとは限らない。新規ページでは
   [`eda-schematic-init`](../eda-schematic-init/SKILL.md) の probe で実測してから本番作図する。
5. **enum は列挙メンバで指定** — 数値を直接書かない (`ESCH_PrimitiveFillStyle` 等)。
6. **シグネチャを推測しない** — `~/.claude/skills/easyeda-api/references/classes/<Class>.md` で確認する。
   特に「空を返すが例外は出ない」API に注意:
   - `dmt_Project.getAllProjectsUuid()` は**引数なしだと 0 件**。`teamUuid` を渡す
     (`(await eda.dmt_Team.getAllTeamsInfo())[0].uuid`。`getCurrentTeamInfo()` は `uuid:""` を返すので使えない)
   - `dmt_Project.getProjectInfo()` の名前は **`friendlyName`** (`name` は存在せず undefined)
   - `dmt_Team.getAllInvolvedTeamInfo()` は v3.2.149 クライアントで例外を投げる。使わない
7. **コメントと改行は使ってよい** — `eda-exec.sh` が JSON 組み立てを python3 に任せているため、
   1 行に潰す必要はない (旧ブリッジ運用の「コメント禁止」制約は解消済み)。

## 制約

- **実行タイムアウトは 30 秒固定** (`REQUEST_TIMEOUT_MS`)。ペイロードに `timeout` を入れても無視される。
  重い処理は分割して投げる。
- ブリッジは `127.0.0.1` のみで listen する。
- API は EDA の権限制御下にある。**ドキュメント通りの呼び出しで一貫して失敗する場合はコードのバグではなく
  権限**の可能性がある (拡張設定の「外部交互を許可」を確認)。

## バージョン注意

デスクトップクライアントはオンライン版より古い。型定義に `ADD since EDA vX` が付いた API は
クライアントに存在しない (例: `sch_PrimitiveAttribute.createNetLabel` は v4 以降)。
`connect-check.js` が返す `env.version` と突き合わせること。
