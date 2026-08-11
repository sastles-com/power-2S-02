# power-2s-02 — 2S 電源基板 (IP2326 + MP1584 オンボード化) Project Guide

このファイルは Claude が本プロジェクトで作業する際に**最初に読むべき前提知識**です。
作業状態・次のアクションは [`HANDOFF.md`](HANDOFF.md) を参照すること。

- 親プロジェクト: **Isolation Sphere V2** — リポジトリ `sastles-com/FPC-isolation-sphere` の `CLAUDE.md`
  - 本基板は親プロジェクトの「充電 IC は別プロジェクト管轄」に当たる電源サブシステム。
  - 親 CLAUDE.md の規約 (commit 運用、質問優先の原則) は本プロジェクトにも適用される。
- **リポジトリ: 単独リポジトリ `https://github.com/sastles-com/power-2S-02.git` が正本** (2026-08-10 決定)。
  モノレポ (`FPC-isolation-sphere/kiban/resized/power-2s-02/`) との二重管理は廃止した。詳細は §5 参照。

> **⚠️ パスについて**: 本ドキュメント群は**どの PC でも通用するよう絶対パスを書かない**方針。
> 作業機が変わる前提なので、パスは常に**リポジトリルートからの相対パス**で書くこと。
> 親リポジトリ内のファイルを参照する場合は「親リポジトリの `docs/...`」と明記する
> (単独リポジトリだけをクローンした環境では親リポジトリが存在しない場合がある)。

---

## 1. Project Goal / プロジェクトの目的

<project>
- **What**: これまで既製モジュール 2 枚をスタックしていた 2S 電源を、**モジュールの回路をディスクリートで取り込み、40×40 mm・4 層基板 1 枚に集約**する。
  1. **IP2326 充電回路** — Type-C 15W 2-3S 充電モジュールの回路をオンボード化 (2S 構成)
  2. **MP1584 降圧回路** — MP1584EN ミニ降圧モジュールの回路をオンボード化。**出力は固定 5V / 最大 3 A** (トリマ廃止、固定抵抗分圧)
  3. **電源 ON/OFF 回路** — **ホール素子 (北極) + 常時オン 3.3V LDO + D-FF + 降圧 IC の EN 直結** ([`docs/06`](docs/06-power-switch.md))。MAX16054 とディスクリートラッチは使わない
- **Why**: モジュールスタックは Z 方向に嵩張り、球体コアに収まらない。1 枚化 + ベタ GND + 排熱設計で信頼性も上げる。
- **発注先: JLCPCB** (EasyEDA Pro から直発注)。BOM は LCSC 部品番号で管理する。
- **保護 (BMS)**: IP2326 内蔵保護は所望動作に合わないため**使わない**。市販 **XR-2S-30A** (Lisolec 2S 6A/10A) を**基板外・ワイヤ接続**で使用。
</project>

## 2. Confirmed Specs / 確定仕様

<confirmed>
すべて 2026-08-10 決定。**再議論しない** (経緯は [`HANDOFF.md`](HANDOFF.md) の判断済み事項)。

| 項目 | 確定値 |
| --- | --- |
| 基板サイズ | **40 × 40 mm** (legacy は 50×40) |
| 層数 | **4 層** (内層: GND ベタ + 電源プレーン。[`docs/04`](docs/04-layout-thermal.md)) |
| 取付・実装 | **四隅 M2 穴 (Φ2.2) + 片面実装 (Top のみ)**。Bottom 全面をベタ GND 放熱面にする |
| バッテリ構成 | **2S LiPo** (2000 mAh × 2 直列 = 2000 mAh @ 7.4 V、~14.8 Wh)。BM (中点) タップ必須 |
| 充電入力 | **コネクタ入力のみ** (南極 磁気端子 → AWG26×2 → 本基板)。**Type-C レセプタクルは載せない** |
| 充電回路 | **IP2326** (LCSC **C2832094**, VQFN-24-EP 4×4) で 2S (8.4 V) へ昇圧充電。**充電電流 1.0 A (RISET 90 kΩ)** — IC 上限は 1.5 A だが AWG26 の許容電流が律速 ([`docs/02`](docs/02-ip2326-module.md) §3.1)。実効 ~8.4 W (モジュールの「15W」は PD で 9V を引ける場合の値で、本設計は 5V 入力固定) |
| 5V 出力 | **MP1584EN-LF-Z** (LCSC **C15051**, SOIC-8-EP) 降圧、**固定 5V (R1 105 k / R2 20 k) / 設計最大 3 A**、**fsw ≈ 485 kHz (RFREQ 200 k)**。**外付け BST ダイオード必須** ([`docs/03`](docs/03-mp1584-module.md) §3.4)。親方針「全白禁止 + 輝度上限運用」が前提 ([§9](#9-known-constraints--既知の制約)) |
| 電源 ON/OFF | **ホール素子 (北極) → Schmitt インバータ → D-FF (トグル) → MP1584 の EN 直結** (2026-08-11 全面改訂 → [`docs/06`](docs/06-power-switch.md) §4)。**UX: 磁石をかざす = トグル**。3.3V LDO (HT7333-1) を **PACK_P から常時オン**で動かし、電源 OFF 中もホール素子と D-FF が生きている。**電源投入時 OFF は D-FF の RD を RC でパワーオンリセットして保証**。⚠️ **ディスクリートラッチ (押下 130 ms / 長押し 1.5 s) は廃止** — docs/08 の「5V を待たずに状態確定」要件と論理的に両立しないため ([`docs/06`](docs/06-power-switch.md) §1)。**状態表示 LED は北極キャリア基板へ移設** ([`docs/08`](docs/08-north-status-window.md))。外殻ボタンは廃止し **基板上デバッグ SW 2 個 (強制 ON → SD / 強制 OFF → RD)** のみ。**ESP32 ソフト電源断はペンディング解除 → 実装** (core 基板の PCA9632 ch1 が `PWR_OFF` をシンクして D-FF の RD を引く。[`docs/08`](docs/08-north-status-window.md) §4.4b) |
| オフ時消費電流 | 目標 **≤50 µA**。⚠️ **typ 27〜29 µA で成立するが、ワーストケース積み上げは 51〜54 µA で超過する** ([`docs/06`](docs/06-power-switch.md) §5)。支配項は MP1584 20 + PCA9632 未通電リーク 10 + ホール 8 で、**いずれも docs/06 の管轄外**。目標を typ 基準に読み替えるかは [`docs/06`](docs/06-power-switch.md) §7 Q13 でユーザー判断待ち |
| 電源ヘッダの配置 | **CN5 (VOUT 6p) と CN6 (VIN 6p) は基板の左右端・同一 Y・対向配置** (2P 版踏襲、[`docs/04`](docs/04-layout-thermal.md) §3.1) |
| 保護 | XR-2S-30A オフボード (B+/BM/B−/P+/P− の 5 線)。**IP2326 の保護機能に依存しない** |
| コネクタ | **最小構成に削減** (充電入力 / セル×2 / BMS 戻り / 5V 出力 の 4〜5 個)。デバッグ口はテストポイントで代用 |
| 回路定数の根拠 | **データシート標準回路 + 自前計算**。既製モジュール実物の定数実測は行わない |
| EDA | **EasyEDA Pro** (回路図 + PCB)。`easyeda-api` skill (WebSocket ブリッジ) で Claude が直接作図。作図規約は [`docs/07`](docs/07-easyeda-schematic-rules.md) |
| 作図の出発点 | **2P 版プロジェクト (isolation-sphere-power) を複製して 2S 版に改造** ([`docs/07`](docs/07-easyeda-schematic-rules.md) §5) |
| 回路のリファレンス | legacy `legacy/power-2S.kicad_sch` のネット構成 ([`docs/01`](docs/01-legacy-analysis.md) §3)。**ただし出力スイッチ段は EN 制御化により `VOUT_SWITCHED`/`GATE` が廃止される** |

</confirmed>

## 3. Hard Rules / 厳守事項

<hard_rules>
- **NEVER** IP2326 の内蔵保護機能を前提にした設計・提案をしない (過放電/過電流保護は XR-2S-30A の役割)。
- **NEVER** BM (セル中点) ラインを省略しない。IP2326 のバランス端子は **BMS を経由せずセル中点へ**引く (legacy 踏襲)。
  ※「直結」は *BMS を迂回する* 意味 (2026-08-10 決着)。**均等化抵抗 RCB = 120 Ω / 1206 は直列に入れる**
  — データシート必須で、0 Ω にすると内蔵均等化 MOS がセルを短絡する ([`docs/02`](docs/02-ip2326-module.md) §3.2)。
- **NEVER** MP1584 の出力電圧調整に半固定抵抗 (トリマ) を使わない。固定抵抗分圧で 5V 固定。
- **NEVER** MP1584 の **EN ピンを 2S レール (6.0〜8.4 V) に接続しない** — **絶対最大 6 V**。
  EN は **D-FF の Q (3.3 V CMOS) を直結**して駆動する ([`docs/06`](docs/06-power-switch.md) §4.5)。
- **NEVER** ホール素子の出力を **D-FF の CLK に直結しない** — `74LVC1G74` の入力遷移レート規格は
  **≤10 ns/V (3.3 V で立上り 33 ns 以内)** で、RC やプルアップ経由の µs 級の遷移は**規格の 30 倍違反**になる。
  多重クロックでトグルが不定になるため、**必ず Schmitt バッファ (74LVC1G14 / 1G17) を挟む** ([`docs/06`](docs/06-power-switch.md) §4.3)。
- **NEVER** 機械接点 (基板上デバッグ SW) を **D-FF の CLK に入れない** — バウンスで多重トグルする。
  **SD / RD (非同期レベル入力) に入れる**ことでデバウンス回路を不要にしてある ([`docs/06`](docs/06-power-switch.md) §4.6)。
- **NEVER** 電源 ON/OFF を**ディスクリートラッチ方式 (押下 130 ms / 長押し 1.5 s) に戻さない** —
  状態記憶が 5V レール自身になるため、docs/08 の「かざした瞬間に状態確定」要件と両立しない ([`docs/06`](docs/06-power-switch.md) §1)。
- **NEVER** データシート未確認のピン配置・定数で回路図を確定しない。IP2326 / MP1584EN のデータシートを取得・照合してから作図する。
- **NEVER** 2P 版 (isolation-sphere-power) の充電段 (TP4056) / 昇圧段 (TPS61088) 回路を流用しない ([§7](#7-references--参考資料) の対比表)。
- **NEVER** 5V 出力に MAX16054 + 直列 P-FET 方式を復活させない (オフ時消費と導通損失のため EN 制御へ移行決定)。
- **ALWAYS** 大電流パス (充電昇圧 / 5V 降圧、いずれも 2〜3 A 級) は銅箔幅・ビア数を計算で裏取りする。
- **ALWAYS** 全実装部品に **LCSC 番号 (Supplier ID)** を設定する。空欄の部品を残さない。
- **ALWAYS** 回路図は [`docs/07`](docs/07-easyeda-schematic-rules.md) の作図規約に従う (モジュールを四角でくくる / モジュール内は直接配線 / モジュール間は NET_PORT / GND は例外)。
- **ALWAYS** 未確定事項は勝手に決めず質問する (親プロジェクト共通ルール)。
- **ALWAYS** ドキュメントに**絶対パスを書かない** (作業機が変わる前提。リポジトリルート相対で書く)。
- **NEVER** ネット名に非 ASCII 文字や `+` `−` を使わない。legacy 表記の `B−` `P−` のマイナスは
  Unicode U+2212 で事故要因。実ネット名は [`docs/01`](docs/01-legacy-analysis.md) §3.1 の ASCII 表に従う。
- **ALWAYS** 繰り返す操作は **skill 化する** — 特に EasyEDA 操作。詳細は [§6.1](#61-skill-の作成方針--proactively-build-skills)。
</hard_rules>

## 4. Docs Index / ドキュメント索引

| # | Doc | 内容 |
| --- | --- | --- |
| — | [`HANDOFF.md`](HANDOFF.md) | **作業状態と次のアクション (毎セッション最初に読む)** |
| 01 | [`docs/01-legacy-analysis.md`](docs/01-legacy-analysis.md) | legacy power-2S 基板の完全解析 (ブロック構成・全ネット・コネクタ表) — 回路リファレンス |
| 02 | [`docs/02-ip2326-module.md`](docs/02-ip2326-module.md) | IP2326 充電回路のオンボード化仕様 |
| 03 | [`docs/03-mp1584-module.md`](docs/03-mp1584-module.md) | MP1584 降圧回路のオンボード化仕様 (固定 5V / 3 A) |
| 04 | [`docs/04-layout-thermal.md`](docs/04-layout-thermal.md) | 40×40 / 4 層のレイアウト方針・ベタ GND・排熱設計 |
| 05 | [`docs/05-jlcpcb-fab.md`](docs/05-jlcpcb-fab.md) | JLCPCB 発注フロー (EasyEDA 直発注)・BOM 仕様・LCSC 部品選定ルール |
| 06 | [`docs/06-power-switch.md`](docs/06-power-switch.md) | 電源 ON/OFF 回路 (**ホール素子 + 常時オン LDO + D-FF + EN 直結**) の設計。旧ディスクリートラッチは §8 付録に廃止記録 |
| 07 | [`docs/07-easyeda-schematic-rules.md`](docs/07-easyeda-schematic-rules.md) | **EasyEDA 作図規約 + API 制約** (モジュール枠 / NET_PORT / 座標単位) |
| 08 | [`docs/08-north-status-window.md`](docs/08-north-status-window.md) | **北極ステータス窓の作業指示書 (handoff)** — ホール素子 + 状態表示 LED + 再生開始で消灯。**別セッションが単独で着手できる形で書いてある。着手前に §7 の判断 5 件を解消すること** |
| 09 | [`docs/09-system-structure.md`](docs/09-system-structure.md) | **システム構造とボード間インターフェース** — 基板 6 種の一覧・全体ブロック図・電源ドメイン・信号の取り合い・電源 ON/OFF の全体シーケンス。**§0.5 に mother-ring / core の実ネットリスト解析、§0.6 に確定した設計判断** |
| 10 | [`docs/10-ring-core-revision.md`](docs/10-ring-core-revision.md) | **mother-ring / core 基板の改版指示書** — 追加部品・ピン再定義・チェックリスト。**core は物理変更不要、ring は中規模改版** |

## 5. Repository Layout / フォルダ構成と同期

```text
power-2s-02/            ← 単独リポジトリではここがルート
├── CLAUDE.md                  このファイル (前提知識・確定仕様・規約)
├── HANDOFF.md                 作業状態・次アクション (セッション跨ぎの引き継ぎ)
├── .gitignore                 production/ 等の除外
├── .claude/
│   ├── settings.json          権限設定 (絶対パスを含めない)
│   └── skills/                プロジェクト固有 skill (§6.1)
├── docs/                      設計仕様書 (上の索引参照)
└── legacy/                    旧版 power-2S (KiCad 10) — **参照専用、編集禁止**
    ├── power-2S.kicad_sch     ネット構成の一次資料
    └── power-2S.kicad_pcb     50×40 旧基板
```

**設計データ本体は EasyEDA Pro のクラウド上にある** (本リポジトリには回路図/PCB ファイルを置かない)。
リポジトリは仕様書・skill・legacy 参照資料の管理に使う。
このため **PC が変わっても単独リポジトリをクローンすれば作業を継続できる**
(EasyEDA Pro と `easyeda-api` skill がその PC にインストールされていることが前提)。

### 別 PC で作業する場合

```bash
git clone https://github.com/sastles-com/power-2S-02.git
# → CLAUDE.md と HANDOFF.md を読んでから着手
```

親リポジトリ (`FPC-isolation-sphere`) が無い環境では、親 docs への参照は解決できない。
必要な親側の情報は本リポジトリ内に転記済み (CLAUDE.md §9 など)。

### 正本は単独リポジトリ (2026-08-10 決定)

**編集は常にこの単独リポジトリで行い、そのまま push する。** モノレポとの二重管理は廃止した。

```bash
git add -A && git commit -m "..."   # 作業単位ごと
git push origin main
```

⚠️ 旧運用 (モノレポを正本にして `git subtree split` で単独リポジトリへ push) は**廃止**。理由:

- 作業機を移した際にモノレポ側へ `kiban/` を持ち込まず、正本が実在しない状態になった
- 二重管理は履歴分岐の事故要因で、設計データがクラウドにある本プロジェクトでは実利がない

モノレポ側に取り込みたくなった場合のみ、単独リポジトリを正本として
モノレポ側で `git subtree add` / `pull` する (逆方向の push はしない)。

## 6. Workflow / 開発ワークフロー

1. **準備**: EasyEDA Pro を起動 → `easyeda-api` skill でブリッジ接続を確認 ([`docs/07`](docs/07-easyeda-schematic-rules.md) §3)
2. **回路図**: 2P 版を複製 → CHARGE / DCDC / PMIC ブロックを 2S 版へ差し替え ([`docs/07`](docs/07-easyeda-schematic-rules.md) §5)
   - データシート取得 → 標準アプリケーション回路の確認 → 定数計算 → 作図、の順を守る
3. **部品選定**: LCSC 在庫確認 → 全部品に LCSC 番号を設定 ([`docs/05`](docs/05-jlcpcb-fab.md))
4. **レイアウト**: [`docs/04`](docs/04-layout-thermal.md) のゾーニング・ルールに従う
5. **検証**: ERC / DRC クリーン + 電流容量計算 + 3D で干渉確認
6. **発注**: EasyEDA から JLCPCB へ直発注 ([`docs/05`](docs/05-jlcpcb-fab.md))
7. **コミット**: 仕様書の更新は作業単位ごとに commit & `git push origin main` (正本は単独リポジトリ、§5)

### 6.1 Skill の作成方針 / Proactively build skills

**同じ操作を 2 回以上繰り返しそうなら、その場で skill を作る** (`skill-creator` skill を使う)。
特に **EasyEDA 操作は積極的に skill 化する** — ブリッジ経由の API 呼び出しは定型コードが長く、
毎回書き直すと事故 (座標単位の間違い、`await` 忘れ、enum の取り違え) が起きやすい。

skill 化の候補 (着手時に必要になった順で作る):

| 候補 | 内容 |
| --- | --- |
| `eda-connect` | ブリッジ稼働確認 → ウィンドウ選択 → プロジェクト/ドキュメント状態の確認までを 1 コマンドで |
| `eda-schematic-dump` | 回路図の全部品・ネット・NET_PORT・枠を構造化して吐き出す (レビュー/差分確認用) |
| `eda-module-box` | モジュール枠 (矩形 + タイトル文字) を規約どおりの書式で作成 ([`docs/07`](docs/07-easyeda-schematic-rules.md) §1) |
| `eda-netport` | NET_PORT を規約のシンボルで配置 ([`docs/07`](docs/07-easyeda-schematic-rules.md) §3) |
| `eda-bom-check` | 全部品の LCSC 番号 (Supplier ID) 欠落チェック ([`docs/05`](docs/05-jlcpcb-fab.md) §2) |
| `eda-drc-report` | ERC/DRC を実行して結果を要約 |

- 置き場所: 本リポジトリの `.claude/skills/<name>/SKILL.md` (プロジェクト固有として commit する)
- **skill には座標単位・符号規約・シンボル UUID を埋め込む** ([`docs/07`](docs/07-easyeda-schematic-rules.md) の内容を実行可能な形にする)
- 汎用的すぎて他プロジェクトでも使えるものは、ユーザーに確認してから**ユーザーレベルの skill ディレクトリ**へ置く

## 7. References / 参考資料

- **2P 版電源基板 "isolation-sphere-power" (EasyEDA Pro、ユーザー設計)**: [プロジェクトリンク](https://pro.easyeda.com/editor#id=9ead87f316b44e3b8a20dddd6de44752,tab=*1c498cb2e140475c@9ead87f316b44e3b8a20dddd6de44752|864de495483a0562@9ead87f316b44e3b8a20dddd6de44752)
  - **本プロジェクトの複製元**。作図スタイルの実測結果は [`docs/07`](docs/07-easyeda-schematic-rules.md) §1 に記録
  - **⚠️ これは 1S2P 版であり、電源変換段のアーキテクチャが本プロジェクト (2S) と逆:**

  | | 2P 版 (複製元) | 2S 版 (本プロジェクト) |
  | --- | --- | --- |
  | パック | 1S2P (3.7V 公称)、バランス不要 | 2S 直列 (7.4V 公称)、**BM バランス必須** |
  | 充電 | TP4056 (1S リニア) | **IP2326 (5V→8.4V 昇圧チャージャ)** |
  | 保護 | 1S 用 | **XR-2S-30A (2S BMS、オフボード)** |
  | 5V 生成 | TPS61088 で**昇圧** | **MP1584 で降圧** |

  - **流用してよい**: 作図スタイル (枠・NET_PORT・注釈書式)、コネクタ/テストポイントの流儀、受動部品・SS34 等の LCSC 実績番号
  - **流用してはいけない**: 充電段 (TP4056)・昇圧段 (TPS61088)・MAX16054 直列 FET 方式
- legacy 解析の一次資料: `legacy/power-2S.kicad_sch` / `.kicad_pcb`
- 親プロジェクト: 親リポジトリの `CLAUDE.md` (§2.6 給電・§2.7 BOM) と `docs/03-power-charging.md`
- `easyeda-api` skill (API リファレンス + ブリッジ) — 作業 PC にインストール済みであること

## 8. Open Questions / 未確定事項

サブ doc 側の Open Questions に集約。着手前に確認:

- ~~IP2326 のパッケージ/ピン配置・ISET 等の外付け定数、LCSC 入手性~~ → **全て解決・充電段は確定**
  (2026-08-10、[`docs/02`](docs/02-ip2326-module.md))。残るのは L1 の LCSC 品番とセラコン耐圧のみ
- ~~MP1584 の固定 5V 分圧定数・EN ピン仕様・周波数設定~~ → **全て解決・降圧段は確定**
  (2026-08-10、[`docs/03`](docs/03-mp1584-module.md))。残るのは L1 / D2 / セラコンの LCSC 品番のみ
- ~~ディスクリートラッチの具体回路と定数、オフ時電流目標~~ → **方式を全面改訂して確定**
  (2026-08-11、[`docs/06`](docs/06-power-switch.md) §4)。残るのは **74LVC1G74 の LCSC 品番 (Nexperia 品を選ぶ)**、
  基板上デバッグ SW / 北極コネクタ / 1 kΩ の品番 → [`docs/06`](docs/06-power-switch.md) §7
- **北極ステータス窓** (ホール素子の型番・出力極性・Bop、透光キャップ、キャリア基板、veto 方式) → [`docs/08`](docs/08-north-status-window.md) §7。
  **`docs/06` §6 から docs/08 へ 4 件の要求を申し送り済み** (Schmitt 必須 / 出力極性の確定 / Bop は高め / オフ電流見込みの更新)
- コネクタの型番・ピン数の確定 (最小構成の具体化) → [`docs/01`](docs/01-legacy-analysis.md) §4
- 外層銅箔厚 (1 oz で足りるか) → [`docs/04`](docs/04-layout-thermal.md)
- JLCPCB の実装範囲 (PCBA するか基板のみか)・レジスト色 → [`docs/05`](docs/05-jlcpcb-fab.md)

## 9. Known Constraints / 既知の制約

<constraints>
**5V 3 A は LED 負荷に対して厳しい上限である。** 親プロジェクトの負荷は WS2812-2020 × 800 で:

| 状態 | 5V 電流 (概算) |
| --- | --- |
| 全白 100% | 38〜48 A — **論外** (親 CLAUDE.md で全白禁止) |
| 本基板の設計上限 | **3 A (15 W)** |
| 全消灯・データ待機のみ | 0.6〜0.8 A (IC 静止電流 ~1 mA × 800) |

- **発光に使える電流は 3 A ではない。** 静止電流 0.6〜0.8 A を先に引くこと:

  | 内訳 | 電流 |
  | --- | --- |
  | 設計上限 | 3.0 A |
  | − IC 静止電流 (~1 mA × 800、消灯でも常時) | −0.6〜0.8 A |
  | **= 発光に使える分** | **約 2.2 A** |

- したがって **LED 1 個あたり平均 2.75 mA** (= 2.2 A / 800) が実際の上限。
  総電流 3 A を単純に 800 で割った 3.75 mA は静止電流を二重計上した値なので使わない。
- 2.75 mA は全白 (LED 1 個 ~50-60 mA) の **約 5%** に相当する。
- バッテリ 14.8 Wh に対し 15 W 連続で約 1 時間 — ただし降圧効率 (~90%) と BMS/配線損失を
  引くと実際は 50 分程度。放電末期の電圧降下も効くため 1 時間は上限値として扱う。
- 赤道ポゴピン側は 5V 20 ピン × 1.5 A = 30 A 相当あり、**律速は MP1584 単体**。
- ファーム側の輝度上限運用は、この 3 A を前提に設計する必要がある (親プロジェクトへ申し送り)。
</constraints>
