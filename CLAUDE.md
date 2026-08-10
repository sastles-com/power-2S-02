# power-2s-02 — 2S 電源基板 (IP2326 + MP1584 オンボード化) Project Guide

このファイルは Claude が本プロジェクトで作業する際に**最初に読むべき前提知識**です。
作業状態・次のアクションは [`HANDOFF.md`](HANDOFF.md) を参照すること。

- 親プロジェクト: **Isolation Sphere V2** — リポジトリ `sastles-com/FPC-isolation-sphere` の `CLAUDE.md`
  - 本基板は親プロジェクトの「充電 IC は別プロジェクト管轄」に当たる電源サブシステム。
  - 親 CLAUDE.md の規約 (commit 運用、質問優先の原則) は本プロジェクトにも適用される。
- **リポジトリ二重管理**: 本フォルダはモノレポ (`FPC-isolation-sphere/kiban/resized/power-2s-02/`) と
  単独リポジトリ **`https://github.com/sastles-com/power-2S-02.git`** の両方にある。同期手順は §5 参照。

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
  3. **電源 ON/OFF 回路** — **ディスクリートラッチ + 降圧 IC の EN 制御** ([`docs/06`](docs/06-power-switch.md))。MAX16054 は使わない
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
| 充電回路 | IP2326 で 2S (8.4 V) へ昇圧充電、~15 W 級 |
| 5V 出力 | MP1584 降圧、**固定 5V / 設計最大 3 A**。親方針「全白禁止 + 輝度上限運用」が前提 ([§9](#9-known-constraints--既知の制約)) |
| 電源 ON/OFF | **ディスクリートラッチ + EN 制御**。付帯要件: **電源状態 LED** のみ。強制オフ (CLR) 端子は設けない。**ESP32 ソフト電源断は一旦ペンディング** (2026-08-10、将来追加できるようパッドのみ予約) |
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
- **NEVER** BM (セル中点) ラインを省略しない。IP2326 のバランス端子は **BMS を経由せずセル中点へ直結** (legacy 踏襲)。
- **NEVER** MP1584 の出力電圧調整に半固定抵抗 (トリマ) を使わない。固定抵抗分圧で 5V 固定。
- **NEVER** データシート未確認のピン配置・定数で回路図を確定しない。IP2326 / MP1584EN のデータシートを取得・照合してから作図する。
- **NEVER** 2P 版 (isolation-sphere-power) の充電段 (TP4056) / 昇圧段 (TPS61088) 回路を流用しない ([§7](#7-references--参考資料) の対比表)。
- **NEVER** 5V 出力に MAX16054 + 直列 P-FET 方式を復活させない (オフ時消費と導通損失のため EN 制御へ移行決定)。
- **ALWAYS** 大電流パス (充電昇圧 / 5V 降圧、いずれも 2〜3 A 級) は銅箔幅・ビア数を計算で裏取りする。
- **ALWAYS** 全実装部品に **LCSC 番号 (Supplier ID)** を設定する。空欄の部品を残さない。
- **ALWAYS** 回路図は [`docs/07`](docs/07-easyeda-schematic-rules.md) の作図規約に従う (モジュールを四角でくくる / モジュール内は直接配線 / モジュール間は NET_PORT / GND は例外)。
- **ALWAYS** 未確定事項は勝手に決めず質問する (親プロジェクト共通ルール)。
- **ALWAYS** ドキュメントに**絶対パスを書かない** (作業機が変わる前提。リポジトリルート相対で書く)。
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
| 06 | [`docs/06-power-switch.md`](docs/06-power-switch.md) | 電源 ON/OFF 回路 (ディスクリートラッチ + EN 制御) の設計 |
| 07 | [`docs/07-easyeda-schematic-rules.md`](docs/07-easyeda-schematic-rules.md) | **EasyEDA 作図規約 + API 制約** (モジュール枠 / NET_PORT / 座標単位) |

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

### 単独リポジトリへの同期 (モノレポ側で作業した場合)

```bash
# <monorepo> = FPC-isolation-sphere のクローン先
cd <monorepo>
git subtree split --prefix=kiban/resized/power-2s-02 -b power-2s-02-export
git push https://github.com/sastles-com/power-2S-02.git power-2s-02-export:main
git branch -D power-2s-02-export
```

⚠️ **両方で編集すると履歴が分岐する。** どちらか一方を作業機ごとの正本と決めて運用すること
(モノレポ側で編集 → 上記で同期、または単独リポジトリ側で編集 → モノレポへ `git subtree pull`)。

## 6. Workflow / 開発ワークフロー

1. **準備**: EasyEDA Pro を起動 → `easyeda-api` skill でブリッジ接続を確認 ([`docs/07`](docs/07-easyeda-schematic-rules.md) §3)
2. **回路図**: 2P 版を複製 → CHARGE / DCDC / PMIC ブロックを 2S 版へ差し替え ([`docs/07`](docs/07-easyeda-schematic-rules.md) §5)
   - データシート取得 → 標準アプリケーション回路の確認 → 定数計算 → 作図、の順を守る
3. **部品選定**: LCSC 在庫確認 → 全部品に LCSC 番号を設定 ([`docs/05`](docs/05-jlcpcb-fab.md))
4. **レイアウト**: [`docs/04`](docs/04-layout-thermal.md) のゾーニング・ルールに従う
5. **検証**: ERC / DRC クリーン + 電流容量計算 + 3D で干渉確認
6. **発注**: EasyEDA から JLCPCB へ直発注 ([`docs/05`](docs/05-jlcpcb-fab.md))
7. **コミット**: 仕様書の更新は作業単位ごとに commit & push、単独リポジトリへも同期 (§5)

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

- IP2326 のパッケージ/ピン配置・ISET 等の外付け定数、**LCSC 入手性** → [`docs/02`](docs/02-ip2326-module.md)
- MP1584 の固定 5V 分圧定数・EN ピン仕様・周波数設定 → [`docs/03`](docs/03-mp1584-module.md)
- ディスクリートラッチの具体回路と定数、オフ時電流目標 → [`docs/06`](docs/06-power-switch.md)
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

- 3 A は全白の約 7%、**LED 1 個あたり平均 3.75 mA** (白で約 6% デューティ相当) に相当。
- 点灯ゼロでも静止電流だけで予算の 2〜3 割を消費する。
- バッテリ 14.8 Wh に対し 15 W 連続で約 1 時間、平均 5 W なら約 3 時間。
- 赤道ポゴピン側は 5V 20 ピン × 1.5 A = 30 A 相当あり、**律速は MP1584 単体**。
- ファーム側の輝度上限運用は、この 3 A を前提に設計する必要がある (親プロジェクトへ申し送り)。
</constraints>
