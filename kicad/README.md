# kicad/ — 回路図の KiCad バックアップ (自動生成)

**このディレクトリのファイルは自動生成物。手で編集しない。**
正本は EasyEDA Pro のクラウド上にある `power-2S-02` (CLAUDE.md §5)。
ここは**版管理・レビュー・保険**のためのスナップショット。

## 生成と検証

```bash
# 1) EasyEDA からダンプ (ブリッジ稼働 + 回路図ページを開いた状態で)
.claude/skills/eda-connect/scripts/eda-exec.sh tools/eda-dump-full.js > tools/schematic-dump.json

# 2) KiCad 10 形式へ変換
python3 tools/eda2kicad.py tools/schematic-dump.json kicad/power-2S-02.kicad_sch

# 3) ネットリストが一致するか検証 (KiCad を起動せずに確認できる)
python3 tools/verify_kicad.py tools/schematic-dump.json kicad/power-2S-02.kicad_sch
```

`3)` が **✅ ネットリスト完全一致** を出すことを毎回確認する。

## 変換の仕組み (要点)

| 項目 | 内容 |
| --- | --- |
| 形式 | **KiCad 10** (`version 20260306`)。`legacy/power-2S.kicad_sch` を構文リファレンスにした |
| 座標 | EasyEDA 回路図 1 unit = 0.01 inch = **0.254 mm ちょうど**。ピンピッチ 10 units = 2.54 mm、配線 5 units = 1.27 mm で KiCad の標準グリッドに完全一致 (端数なし) |
| Y 軸 | シートは下向き正 / シンボル内部は上向き正。**実測で `sheet_y = instance_y − symbol_local_y` を確認**して実装 |
| シンボル | **EasyEDA と同じピンオフセットを持つシンボルを自前生成**する。KiCad 標準の抵抗はピンが ±3.81 mm で EasyEDA (±5.08 mm) と違い、そのまま使うと配線が届かない。`(lcsc, 回転, ミラー)` ごとに 1 個生成し、インスタンスは常に angle 0 で置く → 回転方向の解釈差に影響されない |
| GND | EasyEDA の netflag → `gen:GND` 電源シンボル (`#PWRxxx`) |
| ブロック間ネット | EasyEDA の NET_PORT → KiCad の `global_label` |
| ブロック内ネット | ワイヤ属性のネット名 → KiCad の `label` を 1 個ずつ配置 (KiCad はラベルからしかネット名を取れないため) |
| ジャンクション | **KiCad は T 字接続に `junction` が必須** (EasyEDA は自動)。端点が他の線分上に乗る点を検出して生成する。取りこぼすと断線するので多めに打つ側へ倒している |
| 注釈・枠 | `text` と破線 `rectangle` をそのまま移送 |
| UUID | 決定論的 (uuid5)。**同じ入力なら同じ出力**になるので git の差分が安定する |

## ⚠️ 限界 (バックアップ目的なので未対応)

1. **フットプリントは空** — LCSC 番号は `LCSC` フィールドに保持しているが、
   KiCad の実フットプリント (`Package_TO_SOT_SMD:SOT-23` 等) への割り当ては未実施。
   **このままでは PCB を作れない**
2. **ERC は通らない** — 電源フラグ (`PWR_FLAG`) が無いため「電源が駆動されていない」
   エラーが出る。`PACK_P` / `V5V` / `CHG_IN` に付ける必要がある
3. **シンボルの見た目は KiCad の作図規約と異なる** — ピン位置整合を優先し、
   すべて矩形ボディで描いている (抵抗がジグザグにならない等)
4. **単一シート** — ブロックは破線の枠で区切っている。用紙は A2 相当 (448 × 304 mm)

## 内容 (2026-08-11 時点)

部品 57 / GND 記号 38 / グローバルラベル 26 / ローカルラベル 33 /
配線 125 線分 / ジャンクション 22 / 枠 5 / 注釈 40 行 / シンボル定義 43 種

検証結果: **部品ピン 154、ネット 48 が EasyEDA と完全一致**
