# 05 — JLCPCB 発注フロー・BOM/CPL 仕様・LCSC 部品選定ルール

<subproject>
- name: jlcpcb-fab
- parent: power-2s-02
- status: draft
- depends_on: [02-ip2326-module, 03-mp1584-module]
</subproject>

## Scope

JLCPCB への基板 + PCBA (実装) 発注に必要な出力物・部品選定ルール・発注手順。

## 1. 出力物 (production/ に生成、gitignore)

**KiCad プラグイン Fabrication Toolkit** を使用 (legacy でも使用実績あり。設定は `legacy/fabrication-toolkit-options.json` 参照)。

| ファイル | 内容 |
| --- | --- |
| `<name>.zip` | Gerber + ドリル一式 (JLCPCB 形式) |
| `bom.csv` | BOM — Comment / Designator / Footprint / **LCSC Part #** 列 |
| `positions.csv` (CPL) | 実装座標 — Designator / Mid X / Mid Y / Layer / Rotation |
| `netlist.ipc` | 参考 |

Fabrication Toolkit は KiCad の部品フィールド **`LCSC`** (例: `C25804`) を BOM に反映する。
**回路図の段階で全実装部品に `LCSC` フィールドを付与する**こと。

## 2. LCSC 部品選定ルール

1. **Basic Parts 優先** — 段取り費 ($3/リール) が掛からない。抵抗・コンデンサ・汎用トランジスタはほぼ Basic で揃う
2. Basic に無い場合は **Preferred → Extended** の順。Extended は在庫数と "Ordered qty" を確認
3. **在庫 ≥ 発注数 ×10** を目安に選ぶ (再発注リスク回避)
4. IC の代替不可部品 (IP2326, MP1584EN, MAX16054, DMG3415) は最初に在庫確認 — **ここが律速**
   - IP2326 が LCSC に無い場合: 代替 IC 検討 (docs/02 Q2、ユーザー承認必須)
   - MAX16054 は高価/在庫薄の可能性 → 代替 (ワンボタンラッチ回路) 検討余地あり、ただし legacy 実績を優先
5. 部品検索: jlcpcb.com/parts (JLC 実装可能部品) で検索し、LCSC 番号を記録
6. 手実装前提の部品 (コネクタ類など JLC に無いもの) は BOM 上 DNP にせず **`JLC_DNP` 運用ではなく Fabrication Toolkit の除外指定**を使う (オプション `EXCLUDE DNP` との整合に注意)

## 3. 基板仕様 (発注パラメータ)

| 項目 | 指定 |
| --- | --- |
| 層数 | 4 層 (stackup は JLC04161H-7628 標準で可、docs/04) |
| サイズ | 40×40 mm |
| 板厚 | 1.6 mm |
| 銅箔 | 外層 1 oz (docs/04 Q1 の計算結果次第で 2 oz) |
| レジスト | 黒 or 緑 (未確定、意匠はユーザー判断) |
| 表面処理 | HASL (with lead-free) / ENIG は Type-C 等ファインピッチ次第 |
| 実装 | PCBA (Economic / Standard は部品側の制約で決まる — 4 層 + 両面実装なら Standard) |

## 4. 発注チェックリスト

- [ ] ERC / DRC クリーン (JLCPCB 4 層デザインルール: min trace/space 0.09/0.09 mm だが余裕をもって 0.15/0.15 以上)
- [ ] 全実装部品に `LCSC` フィールドあり、在庫確認済み
- [ ] CPL の回転補正確認 (JLC のパーツ向きと KiCad フットプリントの 0° がずれる部品がある — 発注プレビューの 3D で必ず目視)
- [ ] 極性部品 (D1, タンタル C1/C7, IC) の向きをプレビューで確認
- [ ] フィデューシャル 2〜3 点 (PCBA 用) + パネル化要否の確認
- [ ] 出力一式を commit (zip は容量注意 — 親プロジェクト規約: 重いファイルは push 前確認)

## 5. Open questions

- Q1: IP2326 / MAX16054 の LCSC 在庫 (最優先で確認)
- Q2: レジスト色・表面処理
- Q3: 発注数量 (5 枚 or 10 枚; PCBA は 2 枚実装 + 3 枚基板のみ、等)
