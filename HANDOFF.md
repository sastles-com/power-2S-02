# HANDOFF — power-2s-02 作業引き継ぎ

最終更新: 2026-08-10
前提知識は [`CLAUDE.md`](CLAUDE.md) を先に読むこと。

## 現在のフェーズ

**仕様確定 → 回路図作成に着手可能。ただしデータシート照合と IP2326 入手性確認が先行タスク。**
EasyEDA Pro 上の設計データは未作成 (2P 版の複製から始める)。

## 完了していること

- [x] legacy `power-2S` (50×40, KiCad 10) の完全解析 — 全ネット・ブロック構成・コネクタ表を [`docs/01`](docs/01-legacy-analysis.md) に文書化
- [x] 2P 版 (EasyEDA `isolation-sphere-power`) をブリッジ経由で実測 — BOM・LCSC 番号・作図スタイル (枠 4 個 / NET_PORT 27 個 / GND 例外) を [`docs/07`](docs/07-easyeda-schematic-rules.md) に記録
- [x] 主要仕様の決定 (下表)
- [x] 仕様書一式 (`docs/01`〜`07`) 作成

## 次のアクション (優先順)

1. **IP2326 の LCSC 入手性確認** — **最優先の律速項目**。在庫が無ければ代替 IC 選定が必要でスケジュールが変わる ([`docs/02`](docs/02-ip2326-module.md) Q2)
2. **データシート取得と定数計算**
   - [ ] IP2326: パッケージ・ピン配置・標準回路・セル数/ISET 設定 → [`docs/02`](docs/02-ip2326-module.md) §2 の全項目
   - [ ] MP1584EN: ピン配置・FB 基準電圧 (→ 固定 5V 分圧)・**EN ピン仕様**・FREQ/COMP/BST → [`docs/03`](docs/03-mp1584-module.md) §2
3. **ディスクリートラッチ回路の確定** — リファレンス回路の選定と定数設計 ([`docs/06`](docs/06-power-switch.md) Q2)。EN 仕様の確認が前提
4. **EasyEDA で 2P 版を複製** → CHARGE / DCDC / PMIC ブロックを差し替え ([`docs/07`](docs/07-easyeda-schematic-rules.md) §5)
   - 作図規約 (モジュール枠 / NET_PORT / GND 例外 / 座標単位 0.01 inch) は [`docs/07`](docs/07-easyeda-schematic-rules.md) を厳守
5. **部品選定** — 全部品に LCSC 番号を設定 ([`docs/05`](docs/05-jlcpcb-fab.md) §2 の実績番号を初期値に使える)
6. **レイアウト** — 40×40 / 4 層 / 四隅 M2 / 片面実装 ([`docs/04`](docs/04-layout-thermal.md))
7. **ERC/DRC → JLCPCB 直発注** ([`docs/05`](docs/05-jlcpcb-fab.md))

## 判断済み事項 (再議論しない)

すべて 2026-08-10 決定。

| 論点 | 決定 |
| --- | --- |
| ドキュメント配置 | power-2s-02 直下に自己完結 (CLAUDE.md/HANDOFF.md/docs/) |
| **EDA** | **EasyEDA Pro に移行** (回路図 + PCB)。KiCad は legacy 参照専用に降格 |
| **作図の出発点** | **2P 版 (isolation-sphere-power) を複製して 2S 版に改造** |
| 作図規約 | モジュールを四角でくくる / モジュール内は直接配線 / モジュール間は NET_PORT / GND は例外 |
| 基板 | 40×40 mm / 4 層 / **四隅 M2 穴** / **片面実装 (Top のみ)** |
| **5V 出力** | **固定 5V / 設計最大 3 A (MP1584 維持)**。IC の引き上げは行わない |
| **電源 ON/OFF** | **ディスクリートラッチ + EN 制御**。MAX16054 と直列 P-FET は廃止 |
| 電源 SW 付帯機能 | 電源状態 LED ○ / **ESP32 ソフト電源断 = ペンディング (パッド予約のみ)** / 強制オフ端子 × / ESP32 への状態通知 × |
| **電源ヘッダ配置** | **CN5 (VOUT 6p) / CN6 (VIN 6p) を基板左右端・同一 Y・対向配置** (2P 版踏襲) |
| バッテリ | 2S LiPo 2000 mAh × 2 直列 — **ユーザー確認済みで正しい** (親 doc の表記変更は不要) |
| パス表記 | **絶対パス禁止**。別 PC で作業する前提でリポジトリルート相対で書く |
| skill 運用 | 繰り返す操作は積極的に skill 化する (特に EasyEDA 操作、CLAUDE.md §6.1) |
| **充電入力** | **コネクタのみ** (磁気端子経由)。Type-C レセプタクルは載せない |
| コネクタ | 最小構成 4〜5 個に削減。デバッグ口はテストポイントで代用 |
| **回路定数の根拠** | **データシート標準回路 + 自前計算**。既製モジュール実物の実測は行わない |
| 保護 | XR-2S-30A オフボード継続。IP2326 保護は不使用 |
| 発注 | JLCPCB (EasyEDA から直発注)。Fabrication Toolkit フローは廃止 |

## ユーザーに確認が必要なこと (残ブロッカー)

- **オフ時消費電流の目標値** — 仮に ≤10 µA と置いている ([`docs/06`](docs/06-power-switch.md) Q1)
- **LED の点灯条件** (オンのみか、充電中/満充電も区別するか) ([`docs/06`](docs/06-power-switch.md) Q4)
- **CN5 / CN6 (6p 2.54mm) のピン割り当て** — legacy J7/J8 と 2P 版で内容が異なるため 2S 版として要確定 ([`docs/01`](docs/01-legacy-analysis.md) Q3)
- **コネクタ型番** (セル/BMS 系。JST PH 系か、多極 1 個に統合するか) ([`docs/01`](docs/01-legacy-analysis.md) Q1)
- **充電電流の設定値** — 磁気端子と AWG26×2 の許容電流 (~2 A) が上限を決める。親プロジェクトと整合が必要 ([`docs/02`](docs/02-ip2326-module.md) Q4)
- **レジスト色・表面処理・発注数量** ([`docs/05`](docs/05-jlcpcb-fab.md) Q2/Q3)
- 四隅 M2 穴の正確な位置と球体コア側の受け構造 ([`docs/04`](docs/04-layout-thermal.md) Q4)

## 親プロジェクトへの申し送り

1. **5V 3 A 制約**: 全白の約 7%、LED 1 個あたり平均 3.75 mA が上限。ファーム側の輝度上限運用はこの数値を前提に設計する必要がある (CLAUDE.md §9)
2. **充電電流と AWG26 の整合**: 親 `docs/03-power-charging.md` Q41 の指摘 (AWG26 安全電流 ~2 A) と IP2326 の充電電流設定を突き合わせる必要がある

(バッテリ構成については 2026-08-10 にユーザー確認済み。親 doc の記述変更は不要)
