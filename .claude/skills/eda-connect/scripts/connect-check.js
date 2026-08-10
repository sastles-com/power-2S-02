// EasyEDA 側の状態を 1 回のリクエストでまとめて取得する。
// 作図系 API を呼ぶ前に必ずこれを通し、Online モードか / 対象ドキュメントが回路図ページか確認する。

const safe = async (fn) => {
	try {
		return await fn();
	} catch (e) {
		return { __error: (e && e.message) || String(e) };
	}
};

const env = {
	version: await safe(() => eda.sys_Environment.getEditorCurrentVersion()),
	isClient: await safe(() => eda.sys_Environment.isClient()),
	isOnlineMode: await safe(() => eda.sys_Environment.isOnlineMode()),
	isOfflineMode: await safe(() => eda.sys_Environment.isOfflineMode()),
	isHalfOfflineMode: await safe(() => eda.sys_Environment.isHalfOfflineMode()),
};

const user = await safe(() => eda.sys_Environment.getUserInfo());

// プロジェクト一覧は teamUuid が必須。引数なしだと 0 件が返るが例外にならないので気づけない。
// getCurrentTeamInfo() は uuid:"" を返すため使えない (docs/07 §3 の落とし穴 ③)。
const teams = await safe(() => eda.dmt_Team.getAllTeamsInfo());
const teamUuid = Array.isArray(teams) && teams.length ? teams[0].uuid : undefined;
const projectUuids = teamUuid
	? await safe(() => eda.dmt_Project.getAllProjectsUuid(teamUuid))
	: [];
const projects = [];
if (Array.isArray(projectUuids)) {
	for (const u of projectUuids) {
		const info = await safe(() => eda.dmt_Project.getProjectInfo(u));
		// 名前は friendlyName。name は存在しない。
		projects.push({ uuid: u, friendlyName: info && info.friendlyName });
	}
}

const doc = await safe(() => eda.dmt_SelectControl.getCurrentDocumentInfo());

// EDMT_EditorDocumentType.SCHEMATIC_PAGE === 1 (リファレンスで確認済み)
const SCHEMATIC_PAGE = 1;
const documentType = doc && typeof doc === 'object' ? doc.documentType : undefined;

return {
	env,
	user,
	teamUuid,
	projects,
	project: await safe(() => eda.dmt_Project.getCurrentProjectInfo()),
	document: doc,
	schematic: await safe(() => eda.dmt_Schematic.getCurrentSchematicInfo()),
	page: await safe(() => eda.dmt_Schematic.getCurrentSchematicPageInfo()),
	isSchematicPage: documentType === SCHEMATIC_PAGE,
	warnings: [
		// 離線/半離線だとクラウド同期されず、プロジェクト一覧も 0 件になる (docs/07 §3 落とし穴 ②)
		env.isOfflineMode === true ? '離線モードです。設計データがローカル保存になり web 版と同期しません' : null,
		env.isHalfOfflineMode === true ? '半離線モードです。クラウドプロジェクトが見えないので Online へ切り替えること' : null,
		env.isOnlineMode !== true ? 'Online モードではありません。作図前に切り替えること' : null,
		projects.length === 0 ? 'プロジェクトが 0 件です。Online モードか / teamUuid が正しいかを確認' : null,
		documentType !== SCHEMATIC_PAGE ? `現在のドキュメントは回路図ページではありません (documentType=${documentType})` : null,
	].filter(Boolean),
};
