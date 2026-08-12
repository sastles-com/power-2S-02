// DCDC ブロック (MP1584 段) のピン単位接続監査
// ワイヤは同一ネットで 1 オブジェクトに融合されるので、その点集合をネット等価類として使う。
const comps = await eda.sch_PrimitiveComponent.getAll() || [];
const wires = await eda.sch_PrimitiveWire.getAll() || [];

const groups = wires.map(w => {
  const L = w.line || [], pts = [], segs = [];
  for (let i = 0; i < L.length; i += 2) pts.push([L[i], L[i+1]]);
  for (let i = 0; i + 1 < pts.length; i++) segs.push([pts[i], pts[i+1]]);
  return { set: new Set(pts.map(p => p[0]+","+p[1])), segs };
});

const EPS = 0.01;
const eq = (a,b) => Math.abs(a-b) < EPS;
const onSeg = (g, x, y) => {
  for (const k of g.set) { const [a,b] = k.split(",").map(Number); if (eq(a,x) && eq(b,y)) return true; }
  for (const [[x1,y1],[x2,y2]] of g.segs) {
    if (eq(x1,x2) && eq(x,x1) && y >= Math.min(y1,y2)-1e-6 && y <= Math.max(y1,y2)+1e-6) return true;
    if (eq(y1,y2) && eq(y,y1) && x >= Math.min(x1,x2)-1e-6 && x <= Math.max(x1,x2)+1e-6) return true;
  }
  return false;
};

// 各ワイヤ束に乗っている netflag / netport 名 (端点でも線上でも拾う)
const tags = comps.filter(c => c.componentType !== "part" && c.componentType !== "sheet");
const label = groups.map(g => [...new Set(tags.filter(t => onSeg(g, t.x, t.y)).map(t => t.net))]);

const CHARGE = ["U2","L2","D2","D3","C9","C10","C11","C12","C13","C14","C15","C16","R7","R8","R9","R10"];
const rows = [];
for (const ref of CHARGE) {
  const c = comps.find(x => x.designator === ref);
  if (!c) { rows.push(ref + " = MISSING"); continue; }
  const ps = await eda.sch_PrimitiveComponent.getAllPinsByPrimitiveId(c.primitiveId) || [];
  for (const q of ps) {
    const t = tags.find(z => eq(z.x, q.x) && eq(z.y, q.y));
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
