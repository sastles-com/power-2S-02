// CHARGE ブロック (IP2326 段) のピン単位接続監査
// ワイヤは同一ネットで 1 オブジェクトに融合されるので、その点集合をネット等価類として使う。
const comps = await eda.sch_PrimitiveComponent.getAll() || [];
const wires = await eda.sch_PrimitiveWire.getAll() || [];

const groups = wires.map(w => {
  const L = w.line || [], pts = [], segs = [];
  for (let i = 0; i < L.length; i += 2) pts.push([L[i], L[i+1]]);
  for (let i = 0; i + 1 < pts.length; i++) segs.push([pts[i], pts[i+1]]);
  return { set: new Set(pts.map(p => p[0]+","+p[1])), segs };
});

const onSeg = (g, x, y) => {
  if (g.set.has(x+","+y)) return true;
  for (const [[x1,y1],[x2,y2]] of g.segs) {
    if (Math.abs(x1-x2) < 1e-6 && Math.abs(x-x1) < 1e-6 && y >= Math.min(y1,y2)-1e-6 && y <= Math.max(y1,y2)+1e-6) return true;
    if (Math.abs(y1-y2) < 1e-6 && Math.abs(y-y1) < 1e-6 && x >= Math.min(x1,x2)-1e-6 && x <= Math.max(x1,x2)+1e-6) return true;
  }
  return false;
};

// 各ワイヤ束に乗っている netflag / netport 名 (端点でも線上でも拾う)
const tags = comps.filter(c => c.componentType !== "part" && c.componentType !== "sheet");
const label = groups.map(g => [...new Set(tags.filter(t => onSeg(g, t.x, t.y)).map(t => t.net))]);

const CHARGE = ["U1","L1","D1","C1","C2","C3","C4","C5","C6","C7","C8","R1","R3","R4","R5","R6"];
const rows = [];
for (const ref of CHARGE) {
  const c = comps.find(x => x.designator === ref);
  if (!c) { rows.push(ref + " = MISSING"); continue; }
  const ps = await eda.sch_PrimitiveComponent.getAllPinsByPrimitiveId(c.primitiveId) || [];
  for (const q of ps) {
    const t = tags.find(z => z.x === q.x && z.y === q.y);
    const gi = groups.findIndex(g => onSeg(g, q.x, q.y));
    let net;
    if (t) net = t.net;
    else if (gi >= 0) net = label[gi].length ? label[gi].join("/") : "(無名 G"+gi+")";
    else net = "★未接続";
    rows.push(ref+"."+q.pinNumber+(q.pinName && q.pinName!==q.pinNumber ? "("+q.pinName+")" : "")+" = "+net);
  }
}
const multiNet = label.map((n,i)=>[i,n]).filter(([,n])=>n.length>1);
const zeroLen = wires.filter(w=>{const L=w.line||[];const s=new Set();for(let i=0;i<L.length;i+=2)s.add(L[i]+","+L[i+1]);return s.size===1;}).map(w=>w.line.join(","));
return { rows, multiNet, zeroLen, wireCount: wires.length };
