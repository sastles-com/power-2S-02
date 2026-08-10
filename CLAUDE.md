# power-2s-02 — 2S 電源基板 (IP2326 + MP1584 オンボード化) Project Guide

このファイルは Claude (Opus) が本プロジェクトで作業する際に**最初に読むべき前提知識**です。
作業状態・次のアクションは [`HANDOFF.md`](HANDOFF.md) を参照すること。

- 親プロジェクト: Isolation Sphere V2 (`/Users/katano/work/FPC-isolation-sphere/CLAUDE.md`)
  - 本基板は親プロジェクトの「充電 IC は別プロジェクト管轄」に当たる電源サブシステム。
  - 親 CLAUDE.md の規約 (uv 環境、commit 運用、質問優先の原則) は本プロジェクトにも適用される。

---

## 1. Project Goal / プロジェクトの目的

<project>
- **What**: これまで既製モジュール 2 枚をスタックしていた 2S 電源を、**モジュールの回路をディスクリートで取り込み、40×40 mm・4 層基板 1 枚に集約**する。
  1. **IP2326 充電回路** — 既製品「Type-C 15W 2-3S Lithium Battery Charging boost Module」の回路をオンボード化 (2S 構成)
  2. **MP1584 降圧回路** — 既製品 MP1584EN ミニ降圧モジュール (トリマ調整式) の回路をオンボード化。**出力は固定 5V** (トリマ廃止、固定抵抗分圧)
  3. **出力スイッチ回路** — モーメンタリボタンによるラッチ ON/OFF **機能**は踏襲するが、**MAX16054 方式は必須としない**。オフ時電流最小化のため MP1584 EN 制御を含む方式比較を [`docs/06-power-switch.md`](docs/06-power-switch.md) で実施中 (2026-08-10 方針)
- **Why**: モジュールスタックは Z 方向に嵩張り、球体コアに収まらない。1 枚化 + ベタ GND + 排熱設計で信頼性も上げる。
- **発注先: JLCPCB** (基板 + PCBA)。BOM は LCSC 部品番号で管理する。
- **保護 (BMS)**: IP2326 内蔵保護は所望動作に合わないため**使わない**。市販 **XR-2S-30A** (Lisolec 2S 6A/10A) を**基板外・ワイヤ接続**で使用 (回路図上はフットプリント無しシンボル `U2` として結線のみ記録)。
</project>

## 2. Confirmed Specs / 確定仕様

<confirmed>
| 項目 | 確定値 |
| --- | --- |
| 基板サイズ | **40 × 40 mm** (legacy は 50×40) |
| 層数 | **4 層** (内層: GND ベタ + 電源プレーン。詳細 [`docs/04-layout-thermal.md`](docs/04-layout-thermal.md)) |
| バッテリ構成 | **2S LiPo** (2000 mAh × 2、直列)。BM (中点) タップ必須 |
| 充電入力 | USB Type-C 5V 入力 → IP2326 で 2S (8.4 V) へ昇圧充電、~15 W 級 |
| 5V 出力 | MP1584 降圧、**固定 5V** (トリマ禁止)、負荷は球体 LED 系 (親プロジェクト) |
| 保護 | XR-2S-30A オフボード (B+/BM/B−/P+/P− の 5 線)。**IP2326 の保護機能に依存しない** |
| EDA | **KiCad 10** (EasyEDA は使わない — legacy 資産再利用・テキストファイル・git 管理・Fabrication Toolkit の実績を優先。2026-08-10 決定) |
| 発注 | JLCPCB。Gerber/BOM/CPL は **Fabrication Toolkit** プラグインで生成 ([`docs/05-jlcpcb-fab.md`](docs/05-jlcpcb-fab.md)) |
| 回路のリファレンス | legacy `legacy/power-2S.kicad_sch` の全ネット構成を踏襲 ([`docs/01-legacy-analysis.md`](docs/01-legacy-analysis.md)) |
</confirmed>

## 3. Hard Rules / 厳守事項

<hard_rules>
- **NEVER** IP2326 の内蔵保護機能を前提にした設計・提案をしない (過放電/過電流保護は XR-2S-30A の役割)。
- **NEVER** BM (セル中点) ラインを省略しない。IP2326 のバランス端子は **BMS を経由せずセル中点へ直結** (legacy 踏襲)。
- **NEVER** MP1584 の出力電圧調整に半固定抵抗 (トリマ) を使わない。固定抵抗分圧で 5V 固定。
- **NEVER** データシート未確認のピン配置・定数で回路図を確定しない。IP2326 / MP1584EN / MAX16054 のデータシートを取得・照合してから作図する ([`docs/02`](docs/02-ip2326-module.md)/[`docs/03`](docs/03-mp1584-module.md) の Open Questions 参照)。
- **ALWAYS** 大電流パス (充電昇圧 / 5V 降圧、いずれも 2〜3 A 級) は銅箔幅・ビア数を計算で裏取りする。
- **ALWAYS** BOM の部品は **LCSC 在庫 (できれば Basic/Preferred パーツ)** から選定し、LCSC 番号を KiCad の `LCSC` フィールドに記録する。
- **ALWAYS** 未確定事項は勝手に決めず質問する (親プロジェクト共通ルール)。
- **ALWAYS** 回路図は §3.5 の作図ルールに従う (モジュールを四角でくくる / モジュール内は直接配線 / モジュール間はグローバルラベル)。
</hard_rules>

## 3.5 Schematic Style Rules / 回路図作図ルール

<schematic_rules>
回路図は**機能モジュール単位のブロック構造**で描く:

1. **モジュールごとに四角 (graphic box) でくくる** — 充電 (IP2326)、降圧 (MP1584)、出力スイッチ (MAX16054+FET)、コネクタ群などの機能ブロックを、それぞれ枠線 + ブロック名ラベルで明示的に囲う。
2. **モジュール内はグローバルラベルを極力使わず、ワイヤで直接配線する** — ブロック内の結線が図面上で追えることを優先。
3. **モジュール間の接続はグローバルラベル経由のみ** — ブロックの境界をまたぐワイヤを引かない。ブロック間インターフェース (P+/PGND/BM/CHARGE/VIN/VOUT/VOUT_SWITCHED 等) がグローバルラベルの一覧 = システムのバス定義になる。

参考実装: ユーザー設計の isolation-sphere-power (EasyEDA, §7 参照) が同スタイル。
</schematic_rules>

## 4. Docs Index / ドキュメント索引

| # | Doc | 内容 |
| --- | --- | --- |
| — | [`HANDOFF.md`](HANDOFF.md) | **作業状態と次のアクション (毎セッション最初に読む)** |
| 01 | [`docs/01-legacy-analysis.md`](docs/01-legacy-analysis.md) | legacy power-2S 基板の完全解析 (ブロック構成・全ネット・コネクタ表) — 新基板の回路リファレンス |
| 02 | [`docs/02-ip2326-module.md`](docs/02-ip2326-module.md) | IP2326 既製モジュールの仕様・端子・リバースエンジニアリング手順 |
| 03 | [`docs/03-mp1584-module.md`](docs/03-mp1584-module.md) | MP1584 既製モジュールの仕様・固定 5V 化の設計指針 |
| 04 | [`docs/04-layout-thermal.md`](docs/04-layout-thermal.md) | 40×40 / 4 層のレイアウト方針・ベタ GND・排熱設計 |
| 05 | [`docs/05-jlcpcb-fab.md`](docs/05-jlcpcb-fab.md) | JLCPCB 発注フロー・BOM/CPL 仕様・LCSC 部品選定ルール |
| 06 | [`docs/06-power-switch.md`](docs/06-power-switch.md) | 電源 ON/OFF 回路の方式検討 (MAX16054 必須とせず、MP1584 EN 制御を含む比較) |

## 5. Repository Layout / フォルダ構成

```text
power-2s-02/
├── CLAUDE.md                  このファイル (前提知識・確定仕様・規約)
├── HANDOFF.md                 作業状態・次アクション (セッション跨ぎの引き継ぎ)
├── docs/                      設計仕様書 (上の索引参照)
├── legacy/                    旧版 power-2S (KiCad 10) — 参照専用、編集禁止
│   ├── power-2S.kicad_sch     回路リファレンス (全ネット構成の一次資料)
│   ├── power-2S.kicad_pcb     50×40 旧基板
│   └── fabrication-toolkit-options.json
├── power-2s-02.kicad_pro      (これから作成) 新基板プロジェクト
└── production/                (Fabrication Toolkit 出力 — gitignore)
```

## 6. Workflow / 開発ワークフロー

1. **回路図**: legacy のネット構成 ([`docs/01`](docs/01-legacy-analysis.md) の表が正) を出発点に、U3/U5 のモジュールシンボルをディスクリート回路へ展開する。
   - データシート取得 → 標準アプリケーション回路と既製モジュール実装の差分確認 → 作図、の順を守る。
2. **フットプリント**: 可能な限り KiCad 標準ライブラリ + JLCPCB 実装可能なもの。カスタムが必要な場合は `power-2s-02.pretty/` に作成。
3. **レイアウト**: [`docs/04`](docs/04-layout-thermal.md) のゾーニング・ルールに従う。DRC は JLCPCB 4 層のデザインルールで実行。
4. **検証**: ERC/DRC クリーン + 電流容量計算 (`uv run python` で計算スクリプト可) + 3D ビューで干渉確認。
5. **出力**: Fabrication Toolkit で `production/` に Gerber/BOM/CPL 生成 → JLCPCB へ。
6. **コミット**: 作業単位ごとに commit & push (親プロジェクト規約)。`production/` は gitignore。

## 7. References / 参考資料

- **ユーザー設計の 2P 版電源基板 "isolation-sphere-power" (EasyEDA Pro)**: [プロジェクトリンク](https://pro.easyeda.com/editor#id=9ead87f316b44e3b8a20dddd6de44752,tab=*1c498cb2e140475c@9ead87f316b44e3b8a20dddd6de44752|864de495483a0562@9ead87f316b44e3b8a20dddd6de44752)
  - エディタリンクのため要ログイン。Claude から中身を読む場合は EasyEDA Pro を起動した状態で `easyeda-api` skill (WebSocket ブリッジ) を使う (2026-08-10 に回路図読み取り実績あり)
  - **⚠️ これは 1S2P 版であり、本プロジェクト (2S) とはアーキテクチャが異なる。電源変換段をそのまま写してはいけない:**

  | | 2P 版 (参考設計) | 2S 版 (本プロジェクト) |
  | --- | --- | --- |
  | パック | 1S2P (3.7V 公称)、バランス不要 | 2S 直列 (7.4V 公称)、**BM バランス必須** |
  | 充電 | TP4056 (1S リニア) | **IP2326 (5V→8.4V 昇圧チャージャ)** |
  | 保護 | 1S 用 | **XR-2S-30A (2S BMS、オフボード)** |
  | 5V 生成 | TPS61088 で**昇圧** | **MP1584 で降圧** |

  - **流用してよいもの**: ラッチ電源ボタン回路の考え方 (MAX16054 + SSM6J808R。ただし方式再検討中 → [`docs/06`](docs/06-power-switch.md))、JST PH コネクタ / テストポイント / INA219 計測口という検証装備の流儀、受動部品・SS34 等の LCSC 実績番号
  - **流用してはいけないもの**: 充電段 (TP4056)・昇圧段 (TPS61088) の回路 — 2S 版の充電/降圧は既製モジュールのリバエン + データシート照合で設計する ([`docs/02`](docs/02-ip2326-module.md)/[`docs/03`](docs/03-mp1584-module.md))
- legacy 解析の一次資料: `legacy/power-2S.kicad_sch` / `.kicad_pcb`
- 親プロジェクト: `/Users/katano/work/FPC-isolation-sphere/CLAUDE.md` (§2.6 給電・§2.7 BOM・docs/03-power-charging.md)

## 8. Open Questions / 未確定事項

サブ doc 側の Open Questions に集約してある。着手前に必ず確認:

- IP2326 の正確な型番/パッケージ/ピン配置・外付け定数 → [`docs/02`](docs/02-ip2326-module.md)
- MP1584 固定 5V の分圧定数・スイッチング周波数設定 → [`docs/03`](docs/03-mp1584-module.md)
- コネクタ流用 or 変更 (J1〜J14 の要否整理) → [`docs/01`](docs/01-legacy-analysis.md)
- 40×40 内の実装密度・部品面/半田面の使い分け → [`docs/04`](docs/04-layout-thermal.md)
