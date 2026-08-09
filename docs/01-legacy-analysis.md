# 01 — legacy power-2S 基板の完全解析

<subproject>
- name: legacy-analysis
- parent: power-2s-02
- status: stable (解析完了、参照専用)
- source: `legacy/power-2S.kicad_sch` / `legacy/power-2S.kicad_pcb` (KiCad 10.0)
</subproject>

## Scope

旧版 power-2S (50×40 mm, 2 層) の回路・ネット構成の記録。**新基板 (power-2s-02) の回路リファレンス (正)** として使う。
解析は 2026-08-10 に `kicad-cli sch export netlist` の出力から行った。

## 1. システム全体像

```text
USB充電器 ──> J14 "CHARGE" ──POWER──> D1(ショットキー) ──CHARGE──> [U3 IP2326モジュール VIN]
                                                                        │ B+ ── P+ ネット
                                                                        │ BM ── BM ネット (セル中点直結)
                                                                        │ B− ── PGND
2S LiPo セル ──> J5/J6 ──B+/BM/B−──> [U2 XR-2S-30A BMS ※オフボード] ──P+/P−──> P+ / PGND
P+ ──FB1──> VIN ──> [U5 MP1584モジュール] ──> VOUT (5V)
VOUT ──> [Q2 DMG3415 P-FET] ──> VOUT_SWITCHED ──> J9 "OUTPUT"
              ↑ GATE
        [U1 MAX16054 プッシュボタンON/OFFラッチ]  (電源検出は POWER ネット)
```

ポイント:
- **充放電電流は必ず BMS (U2) の FET を通る** (U3 の B+/B− は保護後の P+/PGND に接続)
- **BM (バランス端子) だけは BMS を経由せずセル中点へ直結** — 新基板でも必ず踏襲
- U2 はフットプリント無し (基板非実装、ワイヤ接続)。回路図に結線記録として残す方式も踏襲する

## 2. 主要部品 (legacy BOM)

| Ref | Value | Footprint | 役割 |
| --- | --- | --- | --- |
| U1 | MAX16054 | TSOT-23-6 | プッシュボタン ON/OFF ラッチコントローラ |
| U2 | 2S-BMS (XR-2S-30A) | **無し (オフボード)** | 2S 保護 (過充放電・過電流) |
| U3 | IP2326 | neon:TS2326 (モジュール搭載穴) | Type-C 15W 2-3S 昇圧充電モジュール → **新基板でディスクリート化** |
| U5 | MP1584EN | neon:MP1584EN (モジュール搭載穴) | 降圧 5V モジュール → **新基板でディスクリート化** |
| Q2 | DMG3415 | SOT-23 | P-ch FET、5V 出力スイッチ |
| D1 | ショットキー (SS34 系) | Vishay SMPA | 充電入力の逆流防止 |
| FB1 | フェライトビーズ | 0603 | P+ → MP1584 入力のノイズフィルタ |
| C1, C7 | 100 µF タンタル | EIA-3528-12 | MP1584 入出力バルク |
| C3, C5, C6 | 22 µF | 0805 | 入出力セラミック |
| C2, C4, C8 | 0.1 µF | 0603 | パスコン |
| R5 | 47 kΩ | 0603 | POWER 検出プルダウン |
| R6 | 10 kΩ | 0603 | CLR プルダウン |

## 3. 全ネット表 (netlist から抽出 — これが新基板回路の正)

| ネット | 接続 (Ref.Pin) | 意味 |
| --- | --- | --- |
| **B+** | J5.2, U2.1(B+) | セル上端 (保護前) |
| **BM** | J5.1, J6.2, J1.2, J2.2, J8.5, U2.2(BM), U3.2(BM) | **セル中点。IP2326 バランス端子直結** |
| **B−** | J6.1, U2.3(B−) | セル下端 (保護前) |
| **P+** | U2.4(P+), U3.1(B+), FB1.1, J1.3, J2.3, J8.6 | 保護後パック + (充放電共通) |
| **PGND** | U2.5(P−), U3.3(B−), U3.5(GND), U5.1(IN−), U5.4(OUT−), C1-C8 の GND 側, R5.2, R6.1, U1.2, J1.1, J2.1, J3.1, J4.1, J7.1, J7.6, J8.1, J8.4, J9.1, J14.1 | 保護後 GND (基板のベタ GND) |
| **POWER** | J14.2, J8.2, J8.3, D1.2(A), C8.1, R5.1, U1.1(IN) | 充電入力 (5V, ダイオード前) |
| **CHARGE** | D1.1(K), U3.4(VIN) | 充電入力 (ダイオード後) → IP2326 VIN |
| **VIN** | FB1.2, C1.1, C2.1, C3.1, J3.2, U5.2(IN+) | MP1584 入力 (= フィルタ後 P+) |
| **VOUT** | U5.3(OUT+), C4.1, C5.1, C6.1, C7.1, J4.2, J7.4, J7.5, Q2.2(S), U1.6(VCC) | 5V (スイッチ前) |
| **VOUT_SWITCHED** | Q2.3(D), J9.2, J7.2, J7.3 | 5V (スイッチ後、負荷へ) |
| **GATE** | U1.4(OUT#), Q2.1(G) | FET ゲート駆動 |
| **OUT** | U1.5(OUT), J11.1 | ラッチ状態モニタ |
| **CLR** | U1.3(CLR), R6.2, J12.1 | 強制オフ入力 |

補足: U1 MAX16054 のプッシュボタン入力ピン結線は新基板作図時に legacy 回路図で再確認すること (netlist 抽出時の対象外)。

## 4. コネクタ一覧と新基板での要否 (要ユーザー確認)

| Ref | 名称 | ピン | 接続 | 新基板での扱い (案) |
| --- | --- | --- | --- | --- |
| J5 | LiPo1 | 2p 2.0mm | B+ / BM | 要 (セル1) |
| J6 | LiPo2 | 2p 2.0mm | BM / B− | 要 (セル2) |
| J1, J2 | BATTERY | 3p 2.0mm | PGND / BM / P+ | **2 個は冗長?** BMS 配線用に 1 個で足りるか確認 |
| J3 | BATTERY | 2p 2.0mm | PGND / VIN | 用途確認 (VIN 直タップ) |
| J4 | DIRECT | 2p 2.0mm | PGND / VOUT | FET 迂回の 5V 直出し。要否確認 |
| J7 | VOUT | 6p 2.54mm | GND×2 / VOUT_SW×2 / VOUT×2 | 負荷側ハーネス |
| J8 | VIN | 6p 2.54mm | GND×2 / POWER×2 / BM / P+ | 充電・パック側ハーネス |
| J9 | OUTPUT | 2p 2.0mm | PGND / VOUT_SWITCHED | 要 |
| J11 | OUT | 1p | U1 ラッチ状態 | デバッグ用。削減候補 |
| J12 | CLR | 1p | 強制オフ | デバッグ用。削減候補 |
| J14 | CHARGE | 2p 2.0mm | PGND / POWER | 要 (充電入力)。**Type-C レセプタクルをオンボード化するか要判断** |

40×40 への縮小でコネクタ面積が支配的になるため、**着手時に必ずユーザーと棚卸しする**こと。

## 5. Open questions

- Q1: J1/J2 の重複、J3/J4/J11/J12 の要否 (§4)
- Q2: 充電入力を J14 ピンヘッダのままにするか、USB Type-C レセプタクルをオンボード化するか (IP2326 ディスクリート化なら Type-C 直載せが自然。CC 抵抗等の要件は docs/02 参照)
- Q3: MAX16054 のプッシュボタン結線の詳細 (legacy 回路図から転記)
