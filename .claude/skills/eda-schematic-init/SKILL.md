---
name: eda-schematic-init
description: EasyEDA Pro で本番作図を始める前に座標系を実測して確定させる。create() に渡す Y 座標の符号が getAll() の読み取り値と一致するかをプローブで検証し、符号変換が必要かを判定する。モジュール枠や部品を配置する前に 1 回だけ実行する。
---

# eda-schematic-init — 作図前の座標系実測

**本番作図の前に必ず 1 回実行する。** [`eda-connect`](../eda-connect/SKILL.md) の `eda-exec.sh` を経由する。

## なぜ必要か

[`docs/07`](../../../docs/07-easyeda-schematic-rules.md) §2 に
「`getAll()` では矩形の `topLeftY` が負、テキストの `y` が正で返る」と実測記録がある。
しかしそれは **読み取り値**であって、**`create()` が同じ符号を取るとは限らない**。
推測で符号を決めると全要素が上下反転した位置に置かれる。

同じ理由で**単位**も間違えやすい: 回路図は **0.01 inch (10 mil)**、PCB は **1 mil**。
1 mm が回路図では約 3.937、PCB では 39.37 — **10 倍ずれるのはこれが原因**。

## 使い方

```bash
.claude/skills/eda-connect/scripts/eda-exec.sh .claude/skills/eda-schematic-init/scripts/01-probe-coords.js
```

回路図ページ (documentType 1) を開いた状態で実行する。
既知の座標にプローブ (矩形 + テキスト) を作り、`getAll()` で読み戻して、**削除してから**結果を返す。
プローブは残らない。

## 判定

| 戻り値 | 意味 |
| --- | --- |
| `rectYRoundTrips: true` かつ `textYRoundTrips: true` | **渡した値がそのまま返る = 符号変換は不要。** [`docs/07`](../../../docs/07-easyeda-schematic-rules.md) §1 の実測座標をそのまま `create()` に渡してよい |
| いずれかが `false` | **符号変換が必要。** `readBack` の実測値を見て変換規則を決め、本番作図の前に [`docs/07`](../../../docs/07-easyeda-schematic-rules.md) §2 へ追記する |

`ok: false` が返る場合は回路図ページが開かれていない。

## 注意

- **書き込みを行う skill** なので、実行前に対象プロジェクトを確認すること。
  回路図の document uuid は複製元 2P 版と同一なので、
  [`eda-schematic-dump`](../eda-schematic-dump/SKILL.md) で `target: power-2S-02` を確認してから実行する
  ([`docs/07`](../../../docs/07-easyeda-schematic-rules.md) §3 落とし穴 ④)
- プローブは `x = 1000` に置く。A4 シートは 1170 × 825 units なので既存要素と重なりにくいが、
  万一残った場合は `content === 'PROBE'` のテキストと同座標の矩形を手で削除する
