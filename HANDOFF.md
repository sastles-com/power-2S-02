# HANDOFF — power-2s-02 作業引き継ぎ

最終更新: 2026-08-10
前提知識は [`CLAUDE.md`](CLAUDE.md) を先に読むこと。

## 現在のフェーズ

**充電段 (IP2326) は設計値まで確定。残るは降圧段 (MP1584EN) のデータシート照合 → 作図着手。**
EasyEDA Pro 上の設計データは未作成 (2P 版の複製から始める)。

**作図環境は 2026-08-10 に Linux 機で疎通確認済み** (ブリッジ ↔ EDA 接続 / Online モード / クラウド 5 プロジェクト可視)。
確認は `.claude/skills/eda-connect/scripts/eda-exec.sh .claude/skills/eda-connect/scripts/connect-check.js` 一発で済む。
warnings が「回路図ページではありません」だけなら正常。

## 完了していること

- [x] legacy `power-2S` (50×40, KiCad 10) の完全解析 — 全ネット・ブロック構成・コネクタ表を [`docs/01`](docs/01-legacy-analysis.md) に文書化
- [x] 2P 版 (EasyEDA `isolation-sphere-power`) をブリッジ経由で実測 — BOM・LCSC 番号・作図スタイル (枠 4 個 / NET_PORT 27 個 / GND 例外) を [`docs/07`](docs/07-easyeda-schematic-rules.md) に記録
- [x] 主要仕様の決定 (下表)
- [x] 仕様書一式 (`docs/01`〜`07`) 作成
- [x] Linux 作業機での作図環境の疎通確認 (2026-08-10) — 落とし穴は [`docs/07`](docs/07-easyeda-schematic-rules.md) §3 に記録
  - EasyEDA Pro 3.2.149.88089769 (2026-06-03 ビルド) / EasyEDA Pro global 版 / Online モード
  - アカウント `tajmahal.jp` (customerCode `2653466A`)、Personal team uuid `65ba7c60a1884bee825c356aebdc2ef7`
  - 複製元 2P 版 `isolation-sphere-power` = project uuid `9ead87f316b44e3b8a20dddd6de44752`
  - 同アカウントの他プロジェクト: `Isolation-sphere-BMS` / `isolation-sphere-core40` / `WS2812-square` / `WS2813-square`
- [x] **EasyEDA プロジェクト `power-2S-02` を作成** (2026-08-10) — 2P 版を GUI「名前を付けて保存」で複製
  - project uuid **`12e4820a5a9c49509b15e944859df944`** / 回路図 P1 `1c498cb2e140475c` / PCB1 `864de495483a0562`
  - 複製直後の内容: 部品 73 / 配線 76 / 枠 4 — [`docs/07`](docs/07-easyeda-schematic-rules.md) §1 の実測記録と一致
  - 複製元 `isolation-sphere-power` は無傷。**中身の改変はまだ一切していない** (TP4056/TPS61088/MAX16054 が残存)
- [x] **IP2326 の入手性確認 + データシート照合が完了** (2026-08-10) — [`docs/02`](docs/02-ip2326-module.md) を全面改訂
  - **入手可**: LCSC **C2832094** 在庫 23,110 / VQFN-24-EP(4×4) / EOL なし / **JLCPCB Extended で SMT 実装可**
    → **代替 IC の検討は不要。律速項目クリア**
  - ⚠️ **`IP2326_NPD` (C5441281) は充電電流 700 mA 未満品** — 型番が似ているので発注時に取り違え注意
  - データシート (ChipSourceTek 版 V1.2, 19p 英語) から **24 ピンの配置・全設定抵抗・標準回路 BOM** を確定
  - **充電電流 1.0 A (RISET 90 kΩ) を推奨値に** — IC 上限 1.5 A ではなく **AWG26 の ~2 A が律速** (入力 1.83 A)
  - **充電中 LED は実現可能** — IP2326 に LED 専用ピン (pin 6) があり充電中点灯/満充電消灯/異常点滅を自動でやる
    → [`docs/06`](docs/06-power-switch.md) Q4 のブロッカー解消

## 次のアクション (優先順)

1. ~~**IP2326 の LCSC 入手性確認**~~ **(完了 2026-08-10 — 入手可、[`docs/02`](docs/02-ip2326-module.md) §0)**
2. **データシート取得と定数計算**
   - [x] IP2326: パッケージ・ピン配置・標準回路・セル数/ISET 設定 → [`docs/02`](docs/02-ip2326-module.md) §2/§3 に反映済み
   - [ ] **MP1584EN: ピン配置・FB 基準電圧 (→ 固定 5V 分圧)・EN ピン仕様・FREQ/COMP/BST** → [`docs/03`](docs/03-mp1584-module.md) §2
     **← 次はこれ。** 3 の前提になる
   - [ ] インダクタ選定 (充電段: 2.2 µH / Isat ≥5 A / DCR <20 mΩ / CD43) の LCSC 品番
3. **ディスクリートラッチ回路の確定** — リファレンス回路の選定と定数設計 ([`docs/06`](docs/06-power-switch.md) Q2)。EN 仕様の確認が前提
4. ~~EasyEDA で 2P 版を複製~~ **(完了)** → **CHARGE / DCDC / PMIC ブロックを差し替え** ([`docs/07`](docs/07-easyeda-schematic-rules.md) §5 の手順 2 以降)
   - 作図規約 (モジュール枠 / NET_PORT / GND 例外 / 座標単位 0.01 inch) は [`docs/07`](docs/07-easyeda-schematic-rules.md) を厳守
   - **書き込み系 API を呼ぶ前に `getCurrentProjectInfo().uuid === "12e4820a…"` を必ず照合する。**
     回路図/PCB の document uuid が複製元と同一なので、照合を省くと 2P 版を壊す ([`docs/07`](docs/07-easyeda-schematic-rules.md) §3 落とし穴 ④)
   - [ ] project description を 2S 版の内容に書き換える (GUI。変更 API が無い)
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
| **リポジトリ** | **単独リポジトリ `sastles-com/power-2S-02` が正本**。モノレポとの二重管理は廃止 (CLAUDE.md §5) |
| 作業環境 (Linux) | EasyEDA Pro 3.2.149 + `easyeda-api` skill v1.1.3 + `run-api-gateway` v1.0.5 + **Node 22 必須** ([`docs/07`](docs/07-easyeda-schematic-rules.md) §3) |
| **EDA の使用モード** | **Online モード必須**。半離線ではクラウドプロジェクトが 0 件になり作図できない ([`docs/07`](docs/07-easyeda-schematic-rules.md) §3) |
| 起動順 | **ブリッジ → EasyEDA Pro**。逆順だと拡張が 15 秒で接続を諦める → `API Gateway → Reconnect` で復旧 |
| skill 運用 | 繰り返す操作は積極的に skill 化する (特に EasyEDA 操作、CLAUDE.md §6.1) |
| **充電入力** | **コネクタのみ** (磁気端子経由)。Type-C レセプタクルは載せない |
| コネクタ | 最小構成 4〜5 個に削減。デバッグ口はテストポイントで代用 |
| **回路定数の根拠** | **データシート標準回路 + 自前計算**。既製モジュール実物の実測は行わない |
| **充電 IC の品種** | **IP2326 標準品 = LCSC `C2832094`**。`IP2326_NPD` (700 mA 未満品) と `IP2326_8V8` (CV +0.4 V) は不採用 |
| **セル数設定** | **CON_SEL (pin 10) を未接続 (floating)** で 2S。3S は 1 kΩ to GND。*既製モジュール基板の「180 kΩ で 2S」表記は基板固有で IC 仕様ではない* |
| **充電電流** | **1.0 A (RISET = 90 kΩ 1%)**。律速は IC (1.5 A) ではなく AWG26 の許容電流 |
| **CV 充電電圧** | **8.4 V (VSET = NC)** — 4.20 V/cell |
| 保護 | XR-2S-30A オフボード継続。IP2326 保護は不使用 |
| 発注 | JLCPCB (EasyEDA から直発注)。Fabrication Toolkit フローは廃止 |

## ユーザーに確認が必要なこと (残ブロッカー)

**充電段について新たに 3 件** (2026-08-10、データシート照合で判明 — [`docs/02`](docs/02-ip2326-module.md) §5):

- **バランスラインに RCB 100 Ω を直列挿入してよいか** — データシート標準回路は必須としている。
  Hard Rule「BM をセル中点へ直結」は *BMS を迂回する* 意味と解釈して RCB は残す方針だが、
  文言に関わるので確認 ([`docs/02`](docs/02-ip2326-module.md) §3.2 / Q1)
- **DM / DP (pin 1,2) の未使用処理** — Type-C を載せないので急速充電交渉は使わないが、
  データシートに未使用時の処理の記載がない (floating で可と推測、未検証) ([`docs/02`](docs/02-ip2326-module.md) Q2)
- **NTC を使うか** — 推奨は未使用 (51 kΩ プルダウン)。球体内の密閉パックにサーミスタ配線がなく、
  電池の熱保護は XR-2S-30A の管轄 ([`docs/02`](docs/02-ip2326-module.md) Q3)

既存の残ブロッカー:

- **オフ時消費電流の目標値** — 仮に ≤10 µA と置いている ([`docs/06`](docs/06-power-switch.md) Q1)
- **電源オン LED の電流** — 常時点灯なので消費に直結 (1〜2 mA に絞るか)。
  ※ *充電中* LED の方は IP2326 の LED ピンで解決済み ([`docs/02`](docs/02-ip2326-module.md) §3.5)
- **CN5 / CN6 (6p 2.54mm) のピン割り当て** — legacy J7/J8 と 2P 版で内容が異なるため 2S 版として要確定 ([`docs/01`](docs/01-legacy-analysis.md) Q3)
- **コネクタ型番** (セル/BMS 系。JST PH 系か、多極 1 個に統合するか) ([`docs/01`](docs/01-legacy-analysis.md) Q1)
- ~~**充電電流の設定値**~~ → **1.0 A (RISET 90 kΩ) を確定案に** (入力 1.83 A で AWG26 の ~2 A 内)。
  親プロジェクトとの整合のみ残る ([`docs/02`](docs/02-ip2326-module.md) §3.1)
- **レジスト色・表面処理・発注数量** ([`docs/05`](docs/05-jlcpcb-fab.md) Q2/Q3)
- 四隅 M2 穴の正確な位置と球体コア側の受け構造 ([`docs/04`](docs/04-layout-thermal.md) Q4)

## 親プロジェクトへの申し送り

1. **5V 3 A 制約**: 設計上限 3 A のうち **0.6〜0.8 A は WS2812 の静止電流**（消灯でも消費）で、
   **発光に使えるのは約 2.2 A = LED 1 個あたり平均 2.75 mA**（全白の約 5%）。
   ファーム側の輝度上限運用はこの 2.75 mA を前提に設計する必要がある (CLAUDE.md §9)。
   ※ 以前«3.75 mA» と申し送っていたが、これは静止電流を二重計上した誤り
2. **充電電流と AWG26 の整合 — 回答が出た** (2026-08-10): 親 `docs/03-power-charging.md` Q41 の
   「AWG26 安全電流 ~2 A」に合わせ、**充電電流を 1.0 A に設定** (RISET 90 kΩ)。
   このとき 5 V 入力電流は **~1.83 A** で 2 A 上限内。IC 上限の 1.5 A を使うと入力 2.74 A になり超過する。
   満充電まで約 2.5〜3 時間 (2000 mAh に対し 0.5 C)。
   ※ モジュールの謳う「15 W」は PD/QC で 9 V を引ける場合の値。本設計は Type-C を載せないので
   5 V 入力固定 = **実効 ~8.4 W** ([`docs/02`](docs/02-ip2326-module.md) §3.3)

(バッテリ構成については 2026-08-10 にユーザー確認済み。親 doc の記述変更は不要)
