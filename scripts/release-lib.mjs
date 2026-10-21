/**
 * @file release-lib.mjs
 * @description リリース処理（scripts/release.mjs）で使う純粋関数。
 *
 * バージョンのタグの解析、manifest.json / package.json の version との照合、
 * CHANGELOG.md からの該当バージョンの節の取り出し、Generic Package Registry の URL の組み立てを行います。
 * ファイルやネットワークに触れないため、Vitest で単体テストします。
 */

/** Generic Package Registry に登録するパッケージ名 */
export const PACKAGE_NAME = "jotline";

/** リリースに添付するファイル（ビルド結果） */
export const RELEASE_FILES = ["main.js", "manifest.json"];

/**
 * バージョンのタグ（`vX.Y.Z`、X・Y・Z は数字）からバージョン `X.Y.Z` を取り出します。
 *
 * @param {string} tag タグ名
 * @returns {string | null} バージョン。形式が違う場合は null
 */
export function parseVersionTag(tag) {
	const match = /^v(\d+\.\d+\.\d+)$/.exec(tag ?? "");
	return match ? match[1] : null;
}

/**
 * タグのバージョンと、manifest.json・package.json の version が一致するかを確かめます。
 *
 * @param {string} tagVersion タグのバージョン
 * @param {string} manifestVersion manifest.json の version
 * @param {string} packageVersion package.json の version
 * @returns {string[]} 不一致を説明するメッセージ（一致すれば空配列）
 */
export function checkVersions(tagVersion, manifestVersion, packageVersion) {
	const errors = [];
	if (manifestVersion !== tagVersion) {
		errors.push(`manifest.json version (${manifestVersion}) does not match the tag version (${tagVersion})`);
	}
	if (packageVersion !== tagVersion) {
		errors.push(`package.json version (${packageVersion}) does not match the tag version (${tagVersion})`);
	}
	return errors;
}

/**
 * CHANGELOG.md から、指定したバージョンの節の本文を取り出します。
 * 節は `## [X.Y.Z]` で始まる見出しから、次の `## ` 見出しの直前までです（見出しの行は含めません）。
 *
 * @param {string} changelog CHANGELOG.md の本文
 * @param {string} version バージョン（`X.Y.Z`）
 * @returns {string | null} 節の本文（前後の空行を除く）。節がない、または本文が空の場合は null
 */
export function extractChangelogSection(changelog, version) {
	const lines = changelog.split(/\r?\n/);
	const escaped = version.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
	const heading = new RegExp(`^## \\[${escaped}\\](?:\\s|$)`);
	const start = lines.findIndex((line) => heading.test(line));
	if (start === -1) return null;

	let end = lines.findIndex((line, i) => i > start && /^## /.test(line));
	if (end === -1) end = lines.length;

	const body = lines.slice(start + 1, end).join("\n").trim();
	return body.length > 0 ? body : null;
}

/**
 * Generic Package Registry のファイルの URL を組み立てます。
 *
 * @param {string} apiUrl GitLab の API の URL（CI_API_V4_URL）
 * @param {string} projectId プロジェクトID（CI_PROJECT_ID）
 * @param {string} version バージョン（`X.Y.Z`）
 * @param {string} fileName ファイル名
 * @returns {string} URL
 */
export function buildPackageFileUrl(apiUrl, projectId, version, fileName) {
	const base = apiUrl.replace(/\/+$/, "");
	return `${base}/projects/${encodeURIComponent(projectId)}/packages/generic/${PACKAGE_NAME}/${version}/${fileName}`;
}

/**
 * リリースの前提条件（タグの形式、version の一致、CHANGELOG の節）をまとめて確かめます。
 *
 * @param {string} tag タグ名
 * @param {{ manifestVersion: string, packageVersion: string, changelog: string | null }} sources 照合に使う値
 * @returns {{ version: string | null, notes: string | null, errors: string[] }} バージョン、リリースノート、問題の一覧
 */
export function validateRelease(tag, { manifestVersion, packageVersion, changelog }) {
	const version = parseVersionTag(tag);
	if (!version) {
		return { version: null, notes: null, errors: [`"${tag}" is not a version tag (expected vX.Y.Z)`] };
	}

	const errors = checkVersions(version, manifestVersion, packageVersion);
	let notes = null;
	if (changelog === null) {
		errors.push("CHANGELOG.md was not found");
	} else {
		notes = extractChangelogSection(changelog, version);
		if (notes === null) {
			errors.push(`CHANGELOG.md has no section (or an empty section) for ${version} ("## [${version}] - YYYY-MM-DD")`);
		}
	}
	return { version, notes, errors };
}
