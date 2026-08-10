// 回路図の全要素を構造化して吐き出す (レビュー / 差分確認 / 残留物チェック用)
//
// 読み取り専用。書き込み系 API は一切呼ばない。
// ただし「どのプロジェクトを読んでいるか」は必ず報告する
// — 回路図 document uuid は複製元 2P 版と同一なので、
//   project uuid を見ないと 2P 版を読んでいても気づけない (docs/07 §3 落とし穴 ④)。

const EXPECTED_PROJECT_UUID = '12e4820a5a9c49509b15e944859df944';
const SOURCE_2P_PROJECT_UUID = '9ead87f316b44e3b8a20dddd6de44752';

const proj = await eda.dmt_Project.getCurrentProjectInfo();
const doc = await eda.dmt_SelectControl.getCurrentDocumentInfo();

const projUuid = (proj && proj.uuid) || null;
const docProjUuid = (doc && doc.parentProjectUuid) || null;

const target =
	projUuid === EXPECTED_PROJECT_UUID && (docProjUuid === null || docProjUuid === EXPECTED_PROJECT_UUID)
		? 'power-2S-02'
		: projUuid === SOURCE_2P_PROJECT_UUID
			? 'DANGER: 複製元 2P 版 (isolation-sphere-power) を開いています'
			: 'UNKNOWN';

const header = {
	target,
	project: proj ? { uuid: projUuid, friendlyName: proj.friendlyName } : null,
	doc: doc ? { uuid: doc.uuid, documentType: doc.documentType, tabId: doc.tabId, parentProjectUuid: docProjUuid } : null,
};

if (!doc || doc.documentType !== 1) {
	return Object.assign({ ok: false, error: `回路図ページを開いてから実行してください (documentType=${doc && doc.documentType})` }, header);
}

const g = (o, n) => (o && typeof o['getState_' + n] === 'function' ? o['getState_' + n]() : null);

const comps = (await eda.sch_PrimitiveComponent.getAll()) || [];
const wires = (await eda.sch_PrimitiveWire.getAll()) || [];
const rects = (await eda.sch_PrimitiveRectangle.getAll()) || [];
const texts = (await eda.sch_PrimitiveText.getAll()) || [];

const parts = [];
const netports = [];
const others = [];

for (const c of comps) {
	const lib = g(c, 'Component') || {};
	const row = {
		id: g(c, 'PrimitiveId'),
		des: g(c, 'Designator'),
		name: g(c, 'Name'),
		x: g(c, 'X'),
		y: g(c, 'Y'),
		rot: g(c, 'Rotation'),
		lcsc: g(c, 'SupplierId'),
		mpn: g(c, 'ManufacturerId'),
		fp: g(c, 'Footprint'),
		libUuid: lib.libraryUuid || null,
		symUuid: lib.uuid || null,
	};
	const type = g(c, 'ComponentType');
	if (type === 'part') parts.push(row);
	else if (type === 'netport') netports.push(Object.assign({ net: g(c, 'Net') }, row));
	else others.push(Object.assign({ type }, row));
}

// ネットごとのワイヤ本数。GND は NET_PORT を使わずワイヤ名で完結させる規約なので
// ここに GND が多数出るのが正常 (docs/07 §1)。
const wireNets = {};
for (const w of wires) {
	const n = g(w, 'Net') || '(unnamed)';
	wireNets[n] = (wireNets[n] || 0) + 1;
}

const netportNets = {};
for (const p of netports) {
	const n = p.net || '(unnamed)';
	netportNets[n] = (netportNets[n] || 0) + 1;
}

// LCSC 番号が空の実装部品 (docs/05 §2 のルール違反になる候補)
const missingLcsc = parts.filter((p) => !p.lcsc).map((p) => `${p.des} (${p.name})`);

return Object.assign(
	{
		ok: true,
		counts: {
			components: comps.length,
			parts: parts.length,
			netports: netports.length,
			others: others.length,
			wires: wires.length,
			wireNetKinds: Object.keys(wireNets).length,
			rects: rects.length,
			texts: texts.length,
		},
		missingLcsc,
		parts: parts.sort((a, b) => String(a.des).localeCompare(String(b.des), 'en', { numeric: true })),
		netportNets,
		netports: netports.sort((a, b) => String(a.net).localeCompare(String(b.net))),
		others,
		wireNets,
		rects: rects.map((r) => ({
			id: g(r, 'PrimitiveId'),
			topLeftX: g(r, 'TopLeftX'),
			topLeftY: g(r, 'TopLeftY'),
			w: g(r, 'Width'),
			h: g(r, 'Height'),
		})),
		texts: texts.map((t) => ({
			id: g(t, 'PrimitiveId'),
			content: g(t, 'Content'),
			x: g(t, 'X'),
			y: g(t, 'Y'),
			fontSize: g(t, 'FontSize'),
			bold: g(t, 'Bold'),
		})),
	},
	header
);
