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

### 前提の確認手順 (毎回)

```bash
# 1. ブリッジ稼働とEDA接続を確認 (ポートは 49620-49629 を走査)
curl -s http://localhost:49620/health          # edaConnected: true を確認
curl -s http://localhost:49620/eda-windows     # ウィンドウを特定
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

1. EasyEDA Pro 上で `isolation-sphere-power` を複製し、名前を `power-2S-02` 等に変更
2. **流用するブロック**: `connector` (構成は変更)、`PMIC` (方式変更 → [`docs/06`](06-power-switch.md))、枠・NET_PORT・注釈の書式
3. **差し替えるブロック**:
   - `CHARGE`: TP4056 (1S リニア) → **IP2326 (2S 昇圧充電)**
   - `DCDC`: TPS61088 (昇圧) → **MP1584 (降圧、固定 5V)**
4. NET_PORT のネット名を 2S 系に更新 (`VBAT` → `P+` 等、[`docs/01`](01-legacy-analysis.md) §3 のネット表に合わせる)
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

- `easyeda-api` skill: `~/.claude/skills/easyeda-api/references/classes/SCH_*.md`
- ドキュメントソース形式: 同 skill `format/schematic/`
- 2P 版プロジェクト: CLAUDE.md §7 のリンク
