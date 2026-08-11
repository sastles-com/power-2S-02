#!/usr/bin/env python3
"""生成した .kicad_sch のネットリストが EasyEDA 側と一致するかを検証する。

KiCad を起動せずに確認できるのが要点。両方を同じ幾何ルールで解いて
「部品ピン -> ネット名」の対応が完全一致するかを比較する。

    python3 tools/verify_kicad.py tools/schematic-dump.json kicad/power-2S-02.kicad_sch

幾何ルール (EasyEDA / KiCad 共通):
  * 線分の 2 端点は同一ネット
  * 端子 (部品ピン / ラベル / GND 記号) が線分上 (端点でも内部でも) にあれば同一ネット
  * 同一座標にある端子同士は同一ネット (ワイヤなしの直結)
ネット名は グローバルラベル / GND 記号 から取る。名前が付かない島は
接続されている端子の集合で比較する (名前ではなく分割の一致を見る)。
"""
from __future__ import annotations

import json
import re
import sys


class UF:
    def __init__(self):
        self.p = {}

    def find(self, a):
        self.p.setdefault(a, a)
        while self.p[a] != a:
            self.p[a] = self.p[self.p[a]]
            a = self.p[a]
        return a

    def union(self, a, b):
        ra, rb = self.find(a), self.find(b)
        if ra != rb:
            self.p[ra] = rb


def on_seg(p, a, b) -> bool:
    (px, py), (x1, y1), (x2, y2) = p, a, b
    if abs(x1 - x2) < 1e-6 and abs(px - x1) < 1e-6:
        return min(y1, y2) - 1e-6 <= py <= max(y1, y2) + 1e-6
    if abs(y1 - y2) < 1e-6 and abs(py - y1) < 1e-6:
        return min(x1, x2) - 1e-6 <= px <= max(x1, x2) + 1e-6
    return False


def solve(segs, terminals):
    """segs: [(a,b)] / terminals: [(key, point, netname_or_None)] -> {key: netname}"""
    uf = UF()
    for a, b in segs:
        uf.union(a, b)
    for _, p, _ in terminals:
        for a, b in segs:
            if on_seg(p, a, b):
                uf.union(p, a)
    same = {}
    for k, p, _ in terminals:
        same.setdefault(p, []).append(k)
    for pts in same.values():
        pass  # 同一座標は同じ point キーなので自動的に同一クラス
    names = {}
    for _, p, nm in terminals:
        if nm:
            names.setdefault(uf.find(p), set()).add(nm)
    out = {}
    for k, p, _ in terminals:
        r = uf.find(p)
        nms = names.get(r)
        out[k] = "/".join(sorted(nms)) if nms else f"(unnamed:{r})"
    return out


# ---------------------------------------------------------------- EasyEDA 側
def from_dump(path):
    d = json.load(open(path, encoding="utf-8"))
    segs = []
    for w in d["wires"]:
        pts = w["pts"]
        for i in range(0, len(pts) - 1, 2):
            a, b = tuple(pts[i]), tuple(pts[i + 1])
            if a != b:
                segs.append((a, b))
    term = []
    for p in d["parts"]:
        for q in p["pins"] or []:
            term.append((f'{p["des"]}.{q["name"]}', (q["x"], q["y"]), None))
    for np_ in d["netports"]:
        pin = (np_["pins"] or [{"x": np_["x"], "y": np_["y"]}])[0]
        term.append((f'LBL:{np_["net"]}@{pin["x"]},{pin["y"]}', (pin["x"], pin["y"]), np_["net"]))
    for f in d["netflags"]:
        pin = (f["pins"] or [{"x": f["x"], "y": f["y"]}])[0]
        term.append((f'GND@{pin["x"]},{pin["y"]}', (pin["x"], pin["y"]), f["net"] or "GND"))
    seen = set()
    for w in d["wires"]:
        pts, net = w["pts"], w["net"]
        if not net or net in seen or len(pts) < 2:
            continue
        seen.add(net)
        term.append((f"LBL:{net}@wire", tuple(pts[0]), net))
    return solve(segs, term)


# ------------------------------------------------------------------ KiCad 側
def toks(t):
    return re.findall(r'\(|\)|"(?:[^"\\]|\\.)*"|[^\s()]+', t)


def parse(t):
    it = iter(toks(t))

    def rd():
        out = []
        for tk in it:
            if tk == "(":
                out.append(rd())
            elif tk == ")":
                return out
            else:
                out.append(tk[1:-1].replace('\\"', '"') if tk.startswith('"') else tk)
        return out
    return rd()[0]


def kids(node, name):
    return [c for c in node if isinstance(c, list) and c and c[0] == name]


def from_kicad(path):
    tree = parse(open(path, encoding="utf-8").read())
    libs = {}
    for ls in kids(tree, "lib_symbols"):
        for sym in kids(ls, "symbol"):
            pins = []

            def walk(n):
                for c in n:
                    if isinstance(c, list):
                        if c[0] == "pin":
                            at = kids(c, "at")[0]
                            nm = kids(c, "name")
                            pins.append(((nm[0][1] if nm else "~"), float(at[1]), float(at[2])))
                        walk(c)
            walk(sym)
            libs[sym[1]] = pins
    segs = []
    for w in kids(tree, "wire"):
        xy = kids(kids(w, "pts")[0], "xy")
        a = (round(float(xy[0][1]), 3), round(float(xy[0][2]), 3))
        b = (round(float(xy[1][1]), 3), round(float(xy[1][2]), 3))
        if a != b:
            segs.append((a, b))
    term = []
    for sym in kids(tree, "symbol"):
        lid = kids(sym, "lib_id")
        at = kids(sym, "at")
        if not lid or not at:
            continue
        x, y = float(at[0][1]), float(at[0][2])
        ref = val = None
        for pr in kids(sym, "property"):
            if pr[1] == "Reference":
                ref = pr[2]
            elif pr[1] == "Value":
                val = pr[2]
        for pname, lx, ly in libs.get(lid[0][1], []):
            pt = (round(x + lx, 3), round(y - ly, 3))     # 実測: sheet_y = inst_y - local_y
            if str(ref).startswith("#PWR"):
                term.append((f"GND@{pt[0]},{pt[1]}", pt, val or "GND"))
            else:
                term.append((f"{ref}.{pname}", pt, None))
    for tag in ("global_label", "label"):
        for gl in kids(tree, tag):
            at = kids(gl, "at")[0]
            pt = (round(float(at[1]), 3), round(float(at[2]), 3))
            term.append((f"LBL:{gl[1]}@{pt[0]},{pt[1]}", pt, gl[1]))
    return solve(segs, term)


def main(dump_path, sch_path):
    eda = from_dump(dump_path)
    kic = from_kicad(sch_path)
    # 部品ピンだけを比較対象にする (ラベル/GND のキーは座標が違うので除外)
    def pinmap(m):
        return {k: v for k, v in m.items() if not k.startswith(("LBL:", "GND@"))}
    e, k = pinmap(eda), pinmap(kic)
    print(f"EasyEDA 側の部品ピン: {len(e)}    KiCad 側: {len(k)}")
    only_e = sorted(set(e) - set(k))
    only_k = sorted(set(k) - set(e))
    if only_e:
        print(f"⚠️ KiCad に無いピン {len(only_e)}: {only_e[:12]}")
    if only_k:
        print(f"⚠️ EasyEDA に無いピン {len(only_k)}: {only_k[:12]}")

    # 名前ではなく「ネットごとのピン集合」で比較する
    def groups(m):
        g = {}
        for kk, vv in m.items():
            g.setdefault(vv, set()).add(kk)
        return {frozenset(v): n for n, v in g.items()}
    ge, gk = groups(e), groups(k)
    same = set(ge) & set(gk)
    print(f"\nネット (ピン集合として一致): {len(same)} / EasyEDA {len(ge)} / KiCad {len(gk)}")
    bad = 0
    for grp in sorted(set(ge) - set(gk), key=lambda s: sorted(s)):
        print(f"  ⚠️ EasyEDA のみ: {ge[grp]:<12} {sorted(grp)}")
        bad += 1
    for grp in sorted(set(gk) - set(ge), key=lambda s: sorted(s)):
        print(f"  ⚠️ KiCad のみ  : {gk[grp]:<12} {sorted(grp)}")
        bad += 1
    if not bad and not only_e and not only_k:
        print("\n✅ ネットリスト完全一致 (ピン数・ネット分割ともに同一)")
        named = sum(1 for n in ge.values() if not n.startswith("(unnamed"))
        print(f"   うち名前付きネット {named} / 無名 {len(ge) - named}")
        return 0
    print(f"\n❌ 不一致 {bad} 件")
    return 1


if __name__ == "__main__":
    if len(sys.argv) != 3:
        print(__doc__)
        sys.exit(1)
    sys.exit(main(sys.argv[1], sys.argv[2]))
