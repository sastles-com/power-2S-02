const comps = await eda.sch_PrimitiveComponent.getAll() || [];
const wires = await eda.sch_PrimitiveWire.getAll() || [];
const inPmic = (x,y) => x>=0 && x<=660 && y>=370 && y<=800;
const groups = wires.filter(w => { const L=w.line||[]; for(let i=0;i<L.length;i+=2) if(inPmic(L[i],L[i+1])) return true; return false; })
  .map(w => { const L=w.line||[], s=new Set(); for(let i=0;i<L.length;i+=2) s.add(L[i]+","+L[i+1]); return s; });

// 各ワイヤ束に乗っている netflag / netport の名前を集める
const label = groups.map(s => {
  const names = new Set();
  for (const c of comps) {
    if (c.componentType === "part") continue;
    if (s.has(c.x + "," + c.y)) names.add((c.componentType === "netflag" ? "" : "") + c.net);
  }
  return [...names];
});
// 単点ワイヤ (長さ 0 の残骸)
const zeroLen = wires.filter(w => { const L=w.line||[]; if(!inPmic(L[0],L[1])) return false;
  const s=new Set(); for(let i=0;i<L.length;i+=2) s.add(L[i]+","+L[i+1]); return s.size===1; })
  .map(w => w.line[0]+","+w.line[1]);

const refs = ["U3","U4","U5","Q1","C22","C23","C24","C25","C26","C27","C28","R19","R20","R21","R22","R23"];
const rows = [];
for (const ref of refs) {
  const c = comps.find(x => x.designator === ref);
  if (!c) { rows.push(ref + " = MISSING"); continue; }
  const ps = await eda.sch_PrimitiveComponent.getAllPinsByPrimitiveId(c.primitiveId) || [];
  for (const q of ps) {
    const key = q.x + "," + q.y;
    const tag = comps.find(z => z.componentType !== "part" && z.x === q.x && z.y === q.y);
    const gi = groups.findIndex(s => s.has(key));
    let net;
    if (tag) net = tag.net;
    else if (gi >= 0) net = label[gi].length ? label[gi].join("/") : "(無名 G"+gi+")";
    else net = "★未接続";
    rows.push(ref + "." + q.pinNumber + (q.pinName && q.pinName!==q.pinNumber ? "("+q.pinName+")" : "") + " = " + net);
  }
}
return {zeroLenWires: zeroLen, rows};
