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

**2026-08-11 に `eda-schematic-dump` で再計測し、上表と完全一致することを確認した** (複製後も無改変)。
追加で判明した点:

- **テキストは 11 個** — 枠タイトル 4 種 + 注釈 1 (size 10 太字) + `GND` ラベル 4 (size 5) +
  **`connector` タイトルの重複 1**。`(790, 755)` と `(800, 760)` に同内容のテキストが 2 個ある
  (2P 版由来の重複)。2S 版では 1 個に整理する
- **LCSC 番号の欠落は 0 件** — 45 部品すべてに Supplier ID が入っている (2P 版の運用が正しい)
- NET_PORT のネット内訳: `VBAT` 8 / `V5V` 8 / `VIN_B` 5 / `VBUS` 4 / `FB_N` 2 (= 27)
- ワイヤは 76 本 / ネット 24 種

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

枠のスタイル (2026-08-11 実測、全 4 枠共通):
**破線** (`lineWidth 1` / `lineType 1 = DASHED`) / 色 `#AA00AA` / 塗りなし (`fillColor: null`, `fillStyle: null`) /
`cornerRadius 0` / `rotation 0`。
タイトル文字は `fontSize 19.68503937007874` / `bold・italic・color・fontName すべて null` /
**`alignMode 2 = LEFT_MIDDLE`** / `rotation 0`。**タイトルの y は枠の上辺と同値**にする。

#### 枠の座標 (2026-08-11 に PMIC / CHARGE を再配置した)

`create()` 換算 (= 上辺の Y。§2 のとおり `getAll()` の `topLeftY` は符号が逆になる):

| ブロック | X 範囲 | Y 範囲 (下..上) | `create(x, topY, w, h)` | 面積 | 収容部品数 |
| --- | --- | --- | --- | --- | --- |
| **PMIC** (ラッチ) | 35..510 | 430..785 | `create(35, 785, 475, 355)` | 168,625 | 21 |
| **CHARGE** (IP2326) | 35..510 | 30..400 | `create(35, 400, 475, 370)` | 175,750 | 18 |
| DCDC (MP1584) | 520..1055 | 200..545 | `create(520, 545, 535, 345)` | 184,575 | 17 |
| connector | 795..1045 | 620..760 | `create(795, 760, 250, 140)` | 35,000 | CN5/CN6 |

タイトル文字: `PMIC (35, 785)` / `CHARGE (50, 400)` / `DCDC (530, 545)` / `connector (800, 760)`。

**再配置の理由**: 2P 版の PMIC 枠 (665×210) では新ラッチ 21 部品に対して密度が高すぎ、
CHARGE 枠 (445×175 = 4 枠で最小) は IP2326 の 18 部品に対して**明確に足りなかった**。
シート上の空き領域は**左下 (X 35..480, Y 0..370) だけ**だったので、
**左側を上下 2 段の縦長ブロックに再分割**した。DCDC と connector は動かしていない。

⚠️ **下方向への単純な拡張はできない**: 旧 PMIC 枠 (下辺 575) と旧 CHARGE 枠 (上辺 545) の隙間は
**30 units しかなく**、さらに X 520 以降は DCDC 枠 (上辺 545) が塞いでいる。
**PMIC の幅を 510 までに絞る**ことで DCDC との干渉を避けている。

<details><summary>2P 版複製直後の枠座標 (参考・変更前)</summary>

| ブロック | 矩形 (topLeftX, **getAll の** topLeftY, w, h) | タイトル文字 (x, y) |
| --- | --- | --- |
| PMIC | (35, **−785**), 665 × 210 | (35, **+785**) |
| CHARGE | (35, **−545**), 445 × 175 | (50, **+545**) |
| DCDC | (520, **−545**), 535 × 345 | (530, **+545**) |
| connector | (795, **−760**), 250 × 140 | (790, **+755**) |

</details>

---

## 2. 座標系と単位 (最大の落とし穴)

| ドメイン | 単位 | 換算 |
| --- | --- | --- |
| **回路図** | **0.01 inch (= 10 mil)** | 1 mm ≈ 3.937 units |
| PCB | 1 mil | 1 mm ≈ 39.37 units |

- **回路図と PCB で単位が 10 倍違う**。混同すると配置が 10 倍ずれる。
- シートサイズ A4 = **1170 × 825 units** (= 11.7 × 8.25 inch、横向き)。全要素をこの範囲に収める。
- **Y 符号の非対称**: 同一位置でも `SCH_PrimitiveRectangle` の `topLeftY` は**負値**、`SCH_PrimitiveText` の `y` は**正値**で返る (§1 の表で実測確認)。

### ⚠️ `create()` に渡す Y と `getAll()` が返す Y は符号が逆 (2026-08-11 実測確定)

`eda-schematic-init` の probe で 2 回検証した結果:

| 操作 | 渡した値 | `getAll()` の読み値 | 結論 |
| --- | --- | --- | --- |
| `sch_PrimitiveRectangle.create(1000, **−100**, 40, 20)` | −100 | **+100** | 反転する |
| `sch_PrimitiveRectangle.create(1000, **+785**, 40, 20)` | +785 | **−785** | 反転する |
| `sch_PrimitiveText.create(1000, **+100**, …)` | +100 | **+100** | **そのまま** |

**規則: 矩形は `create() の Y = −(getAll() の topLeftY)`。テキストは round-trip する。**

→ **§1 の枠座標表 (`topLeftY` が負値) をそのまま `create()` に渡してはいけない。符号を反転する。**
例: PMIC 枠 (読み値 −785) を再現するには `create(35, **+785**, 665, 210)` と呼ぶ。
反転を忘れると図面が上下反転し、A4 シート (1170 × 825) の外へ出る。

**推測で符号を決めない。** 新しいページや別バージョンのクライアントで作図する前に
[`eda-schematic-init`](../.claude/skills/eda-schematic-init/SKILL.md) の probe を 1 回流して再確認する。

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

**⑥ ページ一覧 API は 0 件を返す。開き方には決まった手順がある** (2026-08-11 実測)。

`dmt_Schematic.getAllSchematicPagesInfo()` と `getAllSchematicsInfo()` は
**v3.2.149 クライアントで 0 件**を返す (BETA、例外は出ないので気づけない)。
ページ uuid は `dmt_Project.getProjectInfo(uuid)` の `data[].schematic.page[]` から取れるが、
**この API は呼び出しによって `data` を含まない浅いオブジェクトを返すことがある** (同一セッション内で再現)。

したがって**安定する手順はこれだけ**:

```javascript
const EXPECTED = '12e4820a5a9c49509b15e944859df944';
const PAGE = '1c498cb2e140475c';                      // docs/07 §5 に記録済み

await eda.dmt_Project.openProject(EXPECTED);          // これで対象プロジェクトが current になる
await eda.dmt_EditorControl.openDocument(PAGE);       // project を指定する引数は無い
const doc = await eda.dmt_SelectControl.getCurrentDocumentInfo();
if (doc.documentType !== 1 || doc.parentProjectUuid !== EXPECTED) throw new Error('別プロジェクトを開いた');
```

**`tabId` が最も確実なガード**: `<pageUuid>@<projectUuid>` 形式なので一目で判別できる。
正常時は `1c498cb2e140475c@12e4820a5a9c49509b15e944859df944`。
`…@9ead87f3…` になっていたら複製元 2P 版を開いている。

**⑦ `getState_Footprint()` は文字列でなくオブジェクト** (`{uuid: …}`) を返す。BOM 出力時に注意。

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
- ⚠️ **enum は実行時に存在しない。数値で渡すしかない** (2026-08-11 実測)。
  `eda.ESCH_*` も裸の `ESCH_*` も **undefined** (`Object.keys(eda)` に `E*` は 0 件)。
  型定義だけの存在なので、**値をハードコードし、コメントでメンバ名を書く**。
  必要な値は `references/enums/` で確認する:
  - `ESCH_PrimitiveLineType`: SOLID=0 / **DASHED=1** / DOTTED=2 / DOT_DASHED=3
  - `ESCH_PrimitiveTextAlignMode`: LEFT_TOP=1 / **LEFT_MIDDLE=2** / LEFT_BOTTOM=3 /
    CENTER_TOP=4 / CENTER=5 / CENTER_BOTTOM=6 / RIGHT_TOP=7 / RIGHT_MIDDLE=8 / RIGHT_BOTTOM=9
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

### 部品を LCSC 番号から配置する (2026-08-11 経路確立)

**`lib_Device.getByLcscIds()` の戻り値を `sch_PrimitiveComponent.create()` にそのまま渡せる。**
シンボルを名前で検索する必要はない。

```javascript
const devs = await eda.lib_Device.getByLcscIds(['C2832094', 'C15051']);   // 配列で一括取得
await eda.sch_PrimitiveComponent.create(devs[0], x, y);                   // そのまま渡す
```

`create()` の第 1 引数は `{libraryUuid, uuid} | ILIB_DeviceItem | ILIB_DeviceSearchItem` を受ける。
`{libraryUuid, uuid}` 形式で渡す場合の `uuid` は **device uuid** (シンボル uuid ではない)。

戻り値の主要フィールド (IP2326 = C2832094 の実測):

| フィールド | 値の例 | 備考 |
| --- | --- | --- |
| `uuid` | `c4518c8223b64b9dbaf64e3d55a9b3e1` | **device uuid**。`create()` に渡すのはこれ |
| `libraryUuid` | `0819f05c4eef4c71ace90d822a990e87` | システムライブラリ。2P 版の NET_PORT と同一ライブラリ |
| `footprintUuid` / `footprintName` | `VQFN-24_L4.0-W4.0-P0.50-BL-EP2.5` | データシートの記載と一致 ✓ |
| `manufacturerId` / `supplierId` | `IP2326` / `C2832094` | BOM にそのまま入る |
| `otherProperty` | `JLCPCB Part Class: Extended Part` / `Designator: U?` / `Datasheet` / パラメトリック情報 | **`eda-bom-check` に使える** |

⚠️ **`symbol` / `symbolUuid` は `undefined` で返る。** シンボル uuid が必要なら
`otherProperty.Symbol` を見る (IP2326 は `4b4b4ac0425a4267bcfef64d8979a413`)。
ただし `create()` は device を受け取るので通常は不要。

**主要部品の解決確認 (2026-08-11、8/8 成功)**:
`C2832094` (IP2326) / `C15051` (MP1584EN-LF-Z) / `C8545` (2N7002) / `C20526` (MMBT3904) /
`C85202` (BSS84-7-F) / `C123800` (SMF12A) / `C2286` (KT-0603R) / `C8678` (SS34)

### 書き込み系 API の実測 (2026-08-11、create/delete 往復を検証済み)

**1 部品で create → 読み戻し → delete を往復させ、部品数が 73/45 に戻ることを確認した。**

| 項目 | 実測結果 |
| --- | --- |
| `sch_PrimitiveComponent.create(dev, x, y)` | 成功。戻り値から `SupplierId` / `ManufacturerId` / `ComponentType='part'` が読める |
| ⚠️ **Designator** | **`Q?` のまま。自動採番されない** → `modify()` で明示的に設定する |
| `Name` | `={Manufacturer Part}` のまま (2P 版の既存部品と同じ書式) |
| `delete(primitiveId)` | `true` を返し、`getAll()` から消える |
| **部品の Y 座標** | **テキストと同じ正の座標系**。矩形だけが反転する (§2) |

#### Designator と値の設定は `modify()`

```javascript
const dev = (await eda.lib_Device.getByLcscIds(['C8545']))[0];
const q = await eda.sch_PrimitiveComponent.create(dev, x, y, undefined, rotation);
await eda.sch_PrimitiveComponent.modify(q.getState_PrimitiveId(), { designator: 'Q1' });
```

`modify(primitiveId, property)` の property は
`{x, y, rotation, mirror, addIntoBom, addIntoPcb, designator, name, uniqueId, manufacturer, manufacturerId, supplier, supplierId, otherProperty}`。

#### ピン座標は `getAllPinsByPrimitiveId()` で**絶対座標**が取れる

配線に必須。戻り値の各ピンから `getState_PinNumber / PinName / X / Y / Rotation / PinLength` が読める。

```javascript
const pins = await eda.sch_PrimitiveComponent.getAllPinsByPrimitiveId(primitiveId);
```

実測例 (2P 版 U1 = MAX16054、配置 (300,700)):
`IN (250,710) / GND (250,700) / CLEAR (250,690) / #OUT (350,690) / OUT (350,700) / VCC (350,710)`
— **シンボル幅 100 units、ピンピッチ 10 units**。左側ピンは `rotation 180`、右側は `0`。

2N7002 (SOT-23、配置 (1120,810)) は `G (1100,810) rot180 / D (1130,830) rot90 / S (1130,790) rot270`。

#### 配線は `sch_PrimitiveWire.create(line, net)`

`line` は座標の平坦な配列 (`[x1,y1,x2,y2,…]`) または点の配列。`net` でネット名を与える。
既存ワイヤの `getState_Line()` も同じ平坦配列で返る (例: `[71,435,80,435,95,435,80,435]`)。

### NET_PORT (グローバルラベル) の作り方

⚠️ **2026-08-11 訂正: 専用 API `createNetPort()` が存在する。**

```javascript
await eda.sch_PrimitiveComponent.createNetPort(direction, net, x, y, rotation?, mirror?);
// direction は 'IN' | 'OUT' | 'BI'
```

2P 版は 27 個すべて `Netport-IN` シンボルなので、**`direction: 'IN'` を使えば見た目が揃うと考えられる**
(未検証 — 最初の 1 個を作った時点で `getState_Component()` を読んで下表の uuid と一致するか確認する)。

一致しない場合は下記のコンポーネント配置方式にフォールバックする。2P 版で使われているシンボル (実測):

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
