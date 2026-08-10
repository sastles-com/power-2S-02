# 07 — EasyEDA Pro での回路図作成ルールと API 制約

<subproject>
- name: easyeda-schematic-rules
- parent: power-2s-02
- status: stable (2P 版実測に基づく確定規約)
- depends_on: []
</subproject>

## Scope

EasyEDA Pro で回路図を作図する際の**スタイル規約**と、`easyeda-api` skill (WebSocket ブリッジ) 経由で
Claude が作図する際の**API 制約**。

本ファイルの数値・シンボル UUID は **2026-08-10 に 2P 版 (isolation-sphere-power) をブリッジ経由で実測**して得たもの。
推測値は含まない。未確認の項目は §6 に分離してある。

## Out of scope

- 回路そのもの (どのネットをどう繋ぐか) → [`docs/01`](01-legacy-analysis.md)
- レイアウト・PCB → [`docs/04`](04-layout-thermal.md)
- 発注 → [`docs/05`](05-jlcpcb-fab.md)

---

## 1. スタイル規約 (最重要 — ユーザー指定)

<schematic_rules>
1. **モジュールごとに四角でくくる** — 機能ブロック (CHARGE / DCDC / PMIC / connector など) を矩形 + タイトル文字で明示的に囲う。
2. **モジュール内はグローバルラベルを極力使わず、ワイヤで直接配線する** — ブロック内の結線が図面上で追えることを優先。
3. **モジュール間の接続はグローバルラベル (= NET_PORT) 経由のみ** — ブロック境界をまたぐワイヤを引かない。
   NET_PORT の一覧がそのままシステムのバス定義になる。
4. **GND は例外** — NET_PORT を使わず、ワイヤに `GND` ネット名を付けて各ブロック内で完結させる (2P 版実測: GND はワイヤ 29 本、NET_PORT 0 個)。
</schematic_rules>

### 2P 版での実装実績 (実測値)

| 要素 | 実測 |
| --- | --- |
| モジュール枠 | `SCH_PrimitiveRectangle` × **4** |
| 枠タイトル | `SCH_PrimitiveText`、**fontSize 19.685** (= 0.2 inch)。内容: `PMIC` / `CHARGE` / `DCDC` / `connector` |
| モジュール間接続 | **NET_PORT コンポーネント × 27**。ネットは `VBAT`×8 / `V5V`×8 / `VIN_B`×5 / `VBUS`×4 / `FB_N`×2 |
| GND | ワイヤに `GND` ネット名 (29 本)。NET_PORT は使わない |
| ワイヤ総数 | 76 (ネット 24 種) |
| 部品 | 45 (`part`) + シート 1 |
| 注釈文字 | fontSize 10 (太字) でブロック仕様を記載。例: `[5] Boost 5V/3A - TPS61088 (L=1uH, ILIM 11.9A)` |
| `getAll()` の部品総数 | **73** = part 45 + NET_PORT 27 + タイトルブロックシンボル 1 |

**主要 IC の実測 (BOM を `sch_ManufactureData.getBomFile()` で吐かせて確認、2026-08-10)。**
CLAUDE.md §7 の対比表が正しいことをここで裏取り済み — **project description は信用しない**
(2P 版の description には IP2326 / MP1584EN / HY2120 と書かれているが、実装されていない):

| Des | 実部品 | LCSC | 2S 版での扱い |
| --- | --- | --- | --- |
| U1 | MAX16054AZT+T | C79401 | **廃止** (ディスクリートラッチへ、[`docs/06`](06-power-switch.md)) |
| U2 | TP4056 (1S リニア充電) | C9900002169 | **差し替え** → IP2326 |
| U3 | TPS61088RHLR (昇圧) | C87357 | **差し替え** → MP1584 (降圧) |
| Q1, Q2 | SSM6J808R,LF (P-FET) | C20247098 | 直列 FET 方式廃止に伴い見直し |
| D1 | SS34 | C8678 | 流用可 |
| L1 | SWPA8040S1R0NT 1 µH | C96968 | MP1584 用の値を再計算 |

枠とタイトルの実測座標 (単位 0.01 inch):

| ブロック | 矩形 (topLeftX, topLeftY, w, h) | タイトル文字 (x, y) |
| --- | --- | --- |
| PMIC | (35, **−785**), 665 × 210 | (35, **+785**) |
| CHARGE | (35, **−545**), 445 × 175 | (50, **+545**) |
| DCDC | (520, **−545**), 535 × 345 | (530, **+545**) |
| connector | (795, **−760**), 250 × 140 | (790, **+755**) |

---

## 2. 座標系と単位 (最大の落とし穴)

| ドメイン | 単位 | 換算 |
| --- | --- | --- |
| **回路図** | **0.01 inch (= 10 mil)** | 1 mm ≈ 3.937 units |
| PCB | 1 mil | 1 mm ≈ 39.37 units |

- **回路図と PCB で単位が 10 倍違う**。混同すると配置が 10 倍ずれる。
- シートサイズ A4 = **1170 × 825 units** (= 11.7 × 8.25 inch、横向き)。全要素をこの範囲に収める。
- **Y 符号の非対称**: 同一位置でも `SCH_PrimitiveRectangle` の `topLeftY` は**負値**、`SCH_PrimitiveText` の `y` は**正値**で返る (上表で実測確認)。
  **作図前に必ず `getAll()` で既存要素の値を読み、符号を合わせること。** 推測で符号を決めない。

---

## 3. API 実行の制約 (ブリッジ経由)

### 作業 PC の前提

- **EasyEDA Pro** がインストール・ログイン済み
- **`easyeda-api` skill** がその PC に導入済み (API リファレンス + ブリッジサーバを含む)
- EasyEDA Pro 側に **`run-api-gateway.eext` 拡張**が導入済み (<https://jlc-ext.com/item/oshwhub/run-api-gateway>)

**この 3 つが揃っていない PC では作図できない。** 別 PC で作業を始める前に確認すること。

構成は次のとおり。**ブリッジは EDA が外向きに WebSocket 接続してくる**方式なので、
EasyEDA Pro より先にブリッジサーバを起動しておく。

```text
Claude ──HTTP──> bridge-server.mjs ──WebSocket──> run-api-gateway 拡張 ──> eda.* API
              (49620-49629 を走査)   (拡張が /health で相手を確認して接続)
```

- ブリッジ本体: `easyeda-api` skill の `scripts/bridge-server.mjs`
- **Node.js 22 LTS 以上が必須** (skill 側の依存。20 系では動かない)
- 接続の実装は `eda.sys_WebSocket.register()`。よって拡張の**外部交互権限が必須**

### 環境構築 (Linux / 2026-08-10 実施)

```bash
# 1. skill を導入 (Claude Code の場合は workdir を ~/.claude にする)
npx clawhub@latest install easyeda-api --workdir "$HOME/.claude" --dir skills
cd "$HOME/.claude/skills/easyeda-api" && npm install --omit=dev

# 2. ブリッジ起動 (Node 22 以上で実行すること)
node scripts/bridge-server.mjs        # => http://localhost:49620

# 3. EasyEDA Pro (Linux 版) — 公式 zip をユーザー領域へ展開して使う
#    zip: https://easyeda.com/page/download の easyeda-pro-linux-x64-<ver>.zip
#    同梱の install.sh は /opt/apps へ入れるため sudo と再起動を要求する

# 4. 拡張を導入 (GUI 操作)
#    run-api-gateway_v1.0.5_global.eext を取得 (global 版。中国版 .eext とは別物):
#      https://github.com/easyeda/eext-run-api-gateway/releases
#    Advanced (高级) → 扩展管理器 → インポート → 拡張設定で以下を ON:
#      「外部交互を許可 / Allow external interaction」← 必須
#      「トップメニューに表示 / Display in top menu」

# 5. Online モードで使う (GUI 操作) — 半離線だとクラウドプロジェクトが 0 件になる。下記「落とし穴」②
```

`git clone` 直後は skill のスクリプトに実行権限が付いていないことがある:

```bash
chmod +x .claude/skills/*/scripts/*.sh
```

**注意: デスクトップクライアントはオンライン版より古い。** 型定義 (`@jlceda/pro-api-types`) は
オンライン版 (v3.2.167 / v4 系) まで含むため、`ADD since EDA vX` 付きの API はクライアントに無い。
実機バージョンは `await eda.sys_Environment.getEditorCurrentVersion()` で確認する。

**設計データはクラウド共有なので、同じアカウントで web 版 (pro.easyeda.com) からも閲覧・編集できる。**
ただしクライアントを離線/半離線モードで使うとローカル保存になり同期しない
(`eda.sys_Environment.isOfflineMode()` / `isHalfOfflineMode()` で確認可能)。

#### 起動順とモードの落とし穴 (2026-08-10 実測)

**① 起動順は必ず「ブリッジ → EasyEDA Pro」。** 拡張 (`run-api-gateway` v1.0.5) の実装値:

```js
PORT_START = 49620; PORT_END = 49629;
RETRY_DELAY_MS = 3000; MAX_RETRIES = 5;          // → 約 15 秒で打ち切り、以後再試行しない
activationEvents: { onStartupFinished: true }    // 起動時に 1 回だけ自動接続
```

EDA を先に起動するとブリッジが立つ前に 15 秒で諦め、`edaConnected: false` のまま放置される。
**復旧はトップメニュー `API Gateway` → `Reconnect`** (GUI 操作。API からは叩けない)。
`Toggle Auto-Connect Status` は ON (`Auto-Connect enabled`) にしておく。

**② 半離線モードではクラウドプロジェクトが 1 件も見えない。** 作図前に **Online モード**であることを確認する。
半離線のままだと `getUserInfo()` が**ローカル用の別識別子**を返す (customerCode が空、uuid も異なる) ため、
「ログインできているのにプロジェクトが 0 件」という状態になり原因を見誤りやすい。

| モード | `isOnlineMode` | プロジェクト一覧 | `getUserInfo().customerCode` |
| --- | --- | --- | --- |
| 半離線 (NG) | `false` | **0 件** | 空 |
| Online (OK) | `true` | クラウドの全件 | 実アカウントの値 |

**③ プロジェクト照会には `teamUuid` が必須。** 引数なしだと 0 件が返り、②と区別できない。

```javascript
// NG: 引数なしは 0 件を返す (エラーにならないので気づけない)
await eda.dmt_Project.getAllProjectsUuid();

// OK: teamUuid を渡す。getCurrentTeamInfo() は uuid:"" を返すので使えない
const team = (await eda.dmt_Team.getAllTeamsInfo())[0].uuid;
const uuids = await eda.dmt_Project.getAllProjectsUuid(team);
const info  = await eda.dmt_Project.getProjectInfo(uuids[0]);
// 名前は info.friendlyName。info.name は存在せず undefined になる
```

- `getAllInvolvedTeamInfo()` は v3.2.149 クライアントで例外を投げる (`Cannot read properties of undefined (reading 'map')`)。使わない。
- 本アカウントの Personal team uuid = **`65ba7c60a1884bee825c356aebdc2ef7`** (ユーザー uuid と同値)。
- 複製元 2P 版 `isolation-sphere-power` の project uuid = **`9ead87f316b44e3b8a20dddd6de44752`** (§7 のリンク `id=` と一致)。

**④ document uuid はプロジェクト間で一意ではない。** GUI の「名前を付けて保存」で複製すると、
回路図ページ / PCB の uuid が**複製元と同一のまま**新プロジェクトにコピーされる (2026-08-10 実測):

| | project uuid | 回路図 P1 | PCB1 |
| --- | --- | --- | --- |
| 複製元 `isolation-sphere-power` | `9ead87f316b44e3b8a20dddd6de44752` | `1c498cb2e140475c` | `864de495483a0562` |
| 複製先 `power-2S-02` | `12e4820a5a9c49509b15e944859df944` | **`1c498cb2e140475c`** | **`864de495483a0562`** |

一意なのは tabId (`<documentUuid>@<projectUuid>`) だけ。
**`dmt_EditorControl.openDocument(documentUuid)` の直後に `dmt_Project.getCurrentProjectInfo()` で
project uuid を照合し、期待したプロジェクトであることを確認してから書き込み系 API を呼ぶこと。**
照合を省くと 2P 版 (複製元) を破壊する事故が起きる。

**⑤ プロジェクトの description を変更する API は無い** (`dmt_Project` は create / get / move / open のみ。
`dmt_Folder.modifyFolderDescription` はフォルダ専用)。GUI のプロジェクトプロパティで直す。

> **繰り返す操作は skill にする** — 以下の定型手順は毎回書き直さず、CLAUDE.md §6.1 の方針に従って
> `.claude/skills/` に skill 化する。特に座標単位・Y 符号・シンボル UUID を埋め込んだ skill を作れば、
> 本ファイルの制約を人間/AI が読み落としても事故らない。

### 前提の確認手順 (毎回)

```bash
# 1. ブリッジ稼働とEDA接続を確認 (ポートは 49620-49629 を走査)
curl -s http://localhost:49620/health          # edaConnected: true を確認
curl -s http://localhost:49620/eda-windows     # ウィンドウを特定
```

複数ウィンドウが繋がっている場合は対象を明示的に選ぶ (誤ったプロジェクトへの作図を防ぐ):

```bash
curl -s -X POST http://localhost:49620/eda-windows/select \
  -H "Content-Type: application/json" -d '{"windowId": "<id>"}'
```

コード実行前に**必ずドキュメント状態を確認**する:

```javascript
const p = await eda.dmt_Project.getCurrentProjectInfo();
const doc = await eda.dmt_SelectControl.getCurrentDocumentInfo();
// doc.documentType === 1 が回路図ページ (SCHEMATIC_PAGE)
```

対象ドキュメントが開かれていない / 種別が違う状態で `sch_*` API を呼ぶと null かエラーになる。

### コード記述ルール

- **`await` 必須** — ほぼ全ての API が `Promise` を返す。付け忘れると Promise オブジェクトが返る。
- **`return` 必須** — `console.log` は捕捉されない。
- **コメント禁止** — コードは 1 行に潰して送るため、`//` 以降が全部消える。
- **enum は列挙メンバで指定** — 数値を直接書かない (`ESCH_PrimitiveFillStyle` 等)。
- **シグネチャは必ず `references/classes/` で確認**してから呼ぶ。引数順・単位・省略可否を推測しない。
- 変更系は **async パターン** (`get()` → `toAsync()` → `setState_*()` → `done()`)。

### 使用する主な API (シグネチャ確認済み)

```javascript
// モジュール枠
await eda.sch_PrimitiveRectangle.create(topLeftX, topLeftY, width, height,
                                        cornerRadius, rotation, color, fillColor,
                                        lineWidth, lineType, fillStyle);
// 枠タイトル・注釈
await eda.sch_PrimitiveText.getAll();   // getState_Content / _X / _Y / _FontSize / _Bold
// 部品配置 (component は {libraryUuid, uuid} オブジェクト。文字列ではない)
await eda.sch_PrimitiveComponent.create({libraryUuid, uuid}, x, y, subPartName,
                                        rotation, mirror, addIntoBom, addIntoPcb);
// 読み取り系
await eda.sch_PrimitiveWire.getAll();        // getState_Net でネット名
await eda.sch_PrimitiveComponent.getAll();   // getState_ComponentType: "part"|"netport"|"sheet"
```

### NET_PORT (グローバルラベル) の作り方

NET_PORT は**専用 API ではなくコンポーネント配置**で作る。2P 版で使われているシンボル (実測):

| 項目 | 値 |
| --- | --- |
| name | `Netport-IN` |
| uuid | `3cc4e61ffdb82d18` |
| libraryUuid | `0819f05c4eef4c71ace90d822a990e87` |

2P 版は 27 個すべてこの 1 種類 (`Netport-IN`) で統一されている。**同じシンボルを使うこと。**
複製プロジェクトには既に NET_PORT が存在するので、`getState_Component()` で UUID を再取得すれば
シンボル検索は不要。

⚠️ `sch_PrimitiveAttribute.createNetLabel(x, y, net)` は **NET_LABEL** (別物) を作る API で、しかも BETA。
モジュール間接続には使わない。

---

## 4. 部品属性の規約

BOM/発注に直結するため、部品配置時に以下を埋める (2P 版で実績のある運用):

| 属性 | 取得メソッド | 例 |
| --- | --- | --- |
| Designator | `getState_Designator()` | `U3`, `C9` |
| Value | `getState_Name()` | `22µF`, `100k` |
| Manufacturer Part | `getState_ManufacturerId()` | `TPS61088RHLR` |
| **LCSC 番号** | `getState_SupplierId()` | `C87357` |
| Footprint | `getState_Footprint()` | `VQFN-20_L4.6-W3.6-P0.50-BL` |

**LCSC 番号 (Supplier ID) が入っていない部品を残さない** — JLCPCB 発注時に実装できない。

---

## 5. 作図手順 (2P 版複製ベース)

本プロジェクトは **2P 版プロジェクトを複製して 2S 版に改造**する方針 (2026-08-10 決定)。

1. ~~EasyEDA Pro 上で `isolation-sphere-power` を複製し、名前を `power-2S-02` 等に変更~~
   → **2026-08-10 完了**。GUI の「名前を付けて保存」で複製した (API に複製手段は無い。
   `sys_FileManager.getProjectFileByProjectUuid` + `importProjectByProjectFile` は beta かつ
   インポート経路でライブラリ参照が張り替わる恐れがあるため採用しなかった)。

   | | 値 |
   | --- | --- |
   | プロジェクト名 | **`power-2S-02`** |
   | project uuid | **`12e4820a5a9c49509b15e944859df944`** |
   | 回路図ページ P1 | `1c498cb2e140475c` (複製元と同一 uuid — §3 落とし穴 ④) |
   | PCB1 | `864de495483a0562` (同上) |
   | 複製直後の内容 | 部品 73 / 配線 76 / 矩形 4 (= §1 の枠 4 個と一致) |

   **複製元 `isolation-sphere-power` は無傷であることを確認済み** (Save As がリネームとして働いていない)。
   なお複製で引き継がれた project description は 2P 版由来で実態と合っていない
   (IP2326 / MP1584EN / HY2120 と書かれているが、実装は TP4056 / TPS61088 / MAX16054)。
   GUI で書き換える (§3 落とし穴 ⑤)。
2. **流用するブロック**: `connector` (構成は変更)、`PMIC` (方式変更 → [`docs/06`](06-power-switch.md))、枠・NET_PORT・注釈の書式
3. **差し替えるブロック**:
   - `CHARGE`: TP4056 (1S リニア) → **IP2326 (2S 昇圧充電)**
   - `DCDC`: TPS61088 (昇圧) → **MP1584 (降圧、固定 5V)**
4. NET_PORT のネット名を 2S 系に更新 — **[`docs/01`](01-legacy-analysis.md) §3.1 の ASCII ネット名表に従う**
   (例: `VBAT` → `PACK_P`)。legacy 表記の `B−` `P−` に含まれるマイナスは Unicode U+2212 なので、
   **ネット名にそのまま使わない**。`V5V` は 2P 版と同名なのでそのまま流用できる
5. 不要になった 2P 版の部品・ネットを削除 (残留物チェック: `getAll()` で全部品を列挙して照合)
6. 作図後に **ERC** を実行

**⚠️ 2P 版の CHARGE / DCDC 回路をそのまま残してはいけない** (CLAUDE.md §7 の対比表参照)。

---

## 6. 未確認事項 / 注意点

- **権限による失敗**: API はすべて EDA の権限制御下にある。ドキュメント通りの呼び出しで一貫して失敗する場合はコードのバグではなく権限の可能性がある。
- `sch_PrimitiveRectangle.get()` / `modify()` は **BETA** 表記。production 用途では `create` + `delete` の組合せを優先。
- NET_PORT の向き (`rotation`) の使い分け規約は 2P 版では全て `0`。IN/OUT の方向表現を使うかは未定。
- 2P 版の `SCH_PrimitiveAttribute` は 2217 個存在する (部品属性を含む総数)。個別のネットラベル用途と区別する方法は未調査。

## References

- `easyeda-api` skill (作業 PC の skill ディレクトリ内): `references/classes/SCH_*.md` に全 API シグネチャ
- ドキュメントソース形式: 同 skill の `format/schematic/`
- 2P 版プロジェクト: CLAUDE.md §7 のリンク
- 本プロジェクト用 skill の作成方針: CLAUDE.md §6.1
