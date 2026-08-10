# 05 — JLCPCB 発注フロー (EasyEDA 直発注)・BOM・LCSC 部品選定ルール

<subproject>
- name: jlcpcb-fab
- parent: power-2s-02
- status: draft
- depends_on: [02-ip2326-module, 03-mp1584-module, 07-easyeda-schematic-rules]
</subproject>

## Scope

JLCPCB への基板 + PCBA (実装) 発注に必要な手順・部品選定ルール・チェックリスト。

**EasyEDA Pro は JLCPCB と同一系列**のため、Gerber をエクスポートせず**エディタから直接発注**できる。
(KiCad + Fabrication Toolkit の旧フローは廃止 — EDA 移行により不要)

## 1. 発注フロー

1. **ERC / DRC をクリアさせる** (EasyEDA の設計ルールは JLCPCB 4 層の製造能力に準拠)
2. **全部品に LCSC 番号 (Supplier ID) が入っていることを確認** — §2 のルール
3. PCB エディタから「**JLCPCB へ発注**」を実行 → 基板仕様 (層数/板厚/色/表面処理) を指定
4. **PCBA を付ける場合**は BOM / 部品配置の照合画面で以下を目視確認:
   - 部品の**向き** (極性部品: ダイオード、タンタル、IC)
   - **未マッチ部品**の有無 (LCSC 番号が無い / 在庫切れ)
   - 手実装にする部品 (コネクタ等) の除外指定
5. 発注後、Gerber / BOM / 座標ファイルは記録用にエクスポートしておく (リポジトリには置かない — 設計本体はクラウド)

## 2. LCSC 部品選定ルール

1. **Basic Parts 優先** — 段取り費が掛からない。抵抗・コンデンサ・汎用トランジスタはほぼ Basic で揃う
2. Basic に無い場合は **Preferred → Extended** の順。Extended は在庫数を確認
3. **在庫 ≥ 発注数 × 10** を目安に選ぶ (再発注リスク回避)
4. **代替不可の IC を最初に在庫確認** — ここが律速:
   - **IP2326** — 在庫が無ければ代替 IC 検討が必要 ([`docs/02`](02-ip2326-module.md) Q2、**ユーザー承認必須**)
   - **MP1584EN** — 在庫豊富なはず
   - ディスクリートラッチ用の小信号 MOSFET ([`docs/06`](06-power-switch.md))
5. **2P 版で実績のある LCSC 番号を初期値として使える** (2026-08-10 実測):

| 部品 | MPN | LCSC |
| --- | --- | --- |
| ショットキー SS34 (SMA) | SS34 | C8678 |
| 抵抗 0603 1% シリーズ | 0603WAF____T5E | C21189 (0R) / C21190 (1k) / C25804 (10k) / C25803 (100k) 等 |
| セラコン 0603 | CL10 シリーズ | C15849 (1µF) / C1591 (100nF) 等 |
| セラコン 0805 10µF | CL21A106KAYNNNE | C2980800 |
| セラコン 1206 22µF | CL31A226KAHNNNE | C12891 |
| LED 0603 赤 | KT-0603R | C2286 |
| 小信号 P-MOS (デュアル) | SSM6J808R,LF | C20247098 |
| JST PH 2p (TH) | — | C20504437 |
| テストポイント | — | C9900007422 |

## 3. 基板仕様 (発注パラメータ)

| 項目 | 指定 |
| --- | --- |
| 層数 | **4 層** (stackup は JLC 標準で可、[`docs/04`](04-layout-thermal.md)) |
| サイズ | 40 × 40 mm |
| 板厚 | 1.6 mm |
| 銅箔 | 外層 1 oz ([`docs/04`](04-layout-thermal.md) Q1 の計算次第で 2 oz) |
| 実装 | **片面実装 (Top のみ)** — Economic PCBA が使える可能性が高い |
| レジスト色 | 未確定 (§5 Q2) |
| 表面処理 | 未確定 (§5 Q2) |

## 4. 発注前チェックリスト

- [ ] ERC クリーン (未接続ピン・重複 Designator・NET_PORT の孤立が無いこと)
- [ ] DRC クリーン (JLCPCB 4 層のルール。min trace/space は余裕をもって 0.15/0.15 mm 以上)
- [ ] 全実装部品に LCSC 番号あり、在庫確認済み
- [ ] 極性部品の向きを 3D / 実装プレビューで目視確認
- [ ] **2P 版からの残留部品が無いこと** ([`docs/07`](07-easyeda-schematic-rules.md) §5 手順 5)
- [ ] 四隅 M2 穴 (Φ2.2) の位置と、球体コア側との干渉確認
- [ ] フィデューシャル (PCBA 用) の要否確認

## 5. Open questions

- Q1: IP2326 の LCSC 在庫 (**最優先**)
- Q2: レジスト色・表面処理
- Q3: 発注数量と実装範囲 (PCBA 何枚 + 基板のみ何枚)
