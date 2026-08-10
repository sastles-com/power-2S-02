---
name: eda-schematic-dump
description: EasyEDA Pro の回路図の全要素 (部品 / NET_PORT / ワイヤのネット / モジュール枠 / 注釈文字) を構造化して吐き出す。作図前の棚卸し、作図後の差分確認、2P 版からの残留物チェック、LCSC 番号の欠落検出に使う。読み取り専用。
---

# eda-schematic-dump — 回路図の棚卸し

回路図を**読み取り専用**で全部列挙する。[`eda-connect`](../eda-connect/SKILL.md) の `eda-exec.sh` を経由する。

## 使い方

```bash
.claude/skills/eda-connect/scripts/eda-exec.sh .claude/skills/eda-schematic-dump/scripts/dump.js
```

回路図ページ (documentType 1) を開いた状態で実行する。出力が大きいのでファイルに落とすとよい:

```bash
.claude/skills/eda-connect/scripts/eda-exec.sh .claude/skills/eda-schematic-dump/scripts/dump.js > /tmp/dump.json
```

## 最初に見るフィールド

| フィールド | 意味 |
| --- | --- |
| **`target`** | **`power-2S-02` であることを必ず確認する。** `DANGER: 複製元 2P 版…` が出たら即中断 |
| `project` / `doc` | project uuid と document uuid。**回路図の document uuid は複製元と同一なので project uuid で判断する** ([`docs/07`](../../../docs/07-easyeda-schematic-rules.md) §3 落とし穴 ④) |
| `counts` | 部品 / NET_PORT / ワイヤ / 枠 / 文字の総数。複製直後の基準値は 部品 45 + NET_PORT 27 + シート 1 = 73 / ワイヤ 76 / 枠 4 |
| `missingLcsc` | **LCSC 番号 (Supplier ID) が空の実装部品**。発注前に空でなければならない ([`docs/05`](../../../docs/05-jlcpcb-fab.md) §2) |
| `netportNets` | NET_PORT のネット名と個数 = **そのままシステムのバス定義**。2S 版のネット名は [`docs/01`](../../../docs/01-legacy-analysis.md) §3.1 の ASCII 表に従う |
| `wireNets` | ワイヤのネット名と本数。**`GND` が多数出るのが正常** (GND は NET_PORT を使わない規約、[`docs/07`](../../../docs/07-easyeda-schematic-rules.md) §1) |
| `parts` | Designator 昇順。`libUuid` / `symUuid` は**同じシンボルを再配置するときにそのまま使える** |

## 2P 版からの残留物チェック

作図後、以下が `parts` に残っていたら差し替え漏れ ([`docs/07`](../../../docs/07-easyeda-schematic-rules.md) §5、CLAUDE.md §7):

| 残っていてはいけない部品 | LCSC | 理由 |
| --- | --- | --- |
| MAX16054AZT+T | C79401 | ディスクリートラッチへ変更 ([`docs/06`](../../../docs/06-power-switch.md)) |
| TP4056 | C9900002169 | IP2326 へ差し替え ([`docs/02`](../../../docs/02-ip2326-module.md)) |
| TPS61088RHLR | C87357 | MP1584 へ差し替え ([`docs/03`](../../../docs/03-mp1584-module.md)) |
| SSM6J808R,LF | C20247098 | 直列 P-FET 方式廃止 |

## 注意

- `SCH_PrimitiveAttribute` (2P 版で 2217 個) は**列挙しない** — 部品属性を含む総数で、30 秒のタイムアウトに引っかかる
- `getAll()` の Y 符号は**矩形が負・テキストが正**で返る。これは読み取り値であって `create()` の符号とは別問題
  ([`eda-schematic-init`](../eda-schematic-init/SKILL.md) の probe で実測する)
