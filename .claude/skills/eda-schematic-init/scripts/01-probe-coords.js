// 座標系の実測 (本番作図の前に必ず 1 回実行する)
//
// docs/07 §2 に「getAll() では矩形の topLeftY が負、テキストの y が正で返る」と記録があるが、
// それは *読み取り* 値。create() が同じ符号を取るかは別問題なので、ここで実測して確定させる。
//
// やること: 既知の座標にプローブを作る → getAll() で読み戻す → 削除して結果を返す。
// 空プロジェクトから作図する場合、比較対象の既存要素が無いのでこの手順が唯一の根拠になる。

const PROBE_X = 1000;
const PROBE_Y = -100; // 負値を渡してみる
const PROBE_TEXT_Y = 100; // テキストは正値を渡してみる

const doc = await eda.dmt_SelectControl.getCurrentDocumentInfo();
if (!doc || doc.documentType !== 1) {
	return { ok: false, error: `回路図ページを開いてから実行してください (documentType=${doc && doc.documentType})` };
}

const rect = await eda.sch_PrimitiveRectangle.create(PROBE_X, PROBE_Y, 40, 20);
const text = await eda.sch_PrimitiveText.create(PROBE_X, PROBE_TEXT_Y, 'PROBE', 0, null, null, 19.685);

const rects = (await eda.sch_PrimitiveRectangle.getAll()) || [];
const texts = (await eda.sch_PrimitiveText.getAll()) || [];

const readRect = rects
	.map((r) => ({
		id: r.getState_PrimitiveId ? r.getState_PrimitiveId() : null,
		x: r.getState_TopLeftX ? r.getState_TopLeftX() : null,
		y: r.getState_TopLeftY ? r.getState_TopLeftY() : null,
		w: r.getState_Width ? r.getState_Width() : null,
		h: r.getState_Height ? r.getState_Height() : null,
	}))
	.filter((r) => r.x === PROBE_X);

const readText = texts
	.map((t) => ({
		id: t.getState_PrimitiveId ? t.getState_PrimitiveId() : null,
		content: t.getState_Content ? t.getState_Content() : null,
		x: t.getState_X ? t.getState_X() : null,
		y: t.getState_Y ? t.getState_Y() : null,
		fontSize: t.getState_FontSize ? t.getState_FontSize() : null,
	}))
	.filter((t) => t.content === 'PROBE');

// 後片付け (プローブは残さない)
const cleanup = {
	rect: rect ? await eda.sch_PrimitiveRectangle.delete(rect) : null,
	text: text ? await eda.sch_PrimitiveText.delete(text) : null,
};

return {
	ok: true,
	sent: { rect: { x: PROBE_X, y: PROBE_Y }, text: { x: PROBE_X, y: PROBE_TEXT_Y } },
	readBack: { rect: readRect, text: readText },
	// これが true なら docs/07 の記録どおり「渡した値がそのまま返る」= 変換不要
	rectYRoundTrips: readRect.length === 1 && readRect[0].y === PROBE_Y,
	textYRoundTrips: readText.length === 1 && readText[0].y === PROBE_TEXT_Y,
	cleanup,
	note: '*YRoundTrips が false の場合、02-create-frames.js を流す前に符号変換を決めること',
};
