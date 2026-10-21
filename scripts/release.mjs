#!/usr/bin/env node
/**
 * @file release.mjs
 * @description リリースのコマンド。
 *
 * - `node scripts/release.mjs check <tag>`:
 *   タグの形式、manifest.json・package.json の version との一致、CHANGELOG.md の節の有無を確かめます。
 *   GitLab の API を使わないため、手元でもリリース前の確認に使えます。問題があれば終了コード 1 で終わります。
 * - `node scripts/release.mjs publish <tag>`:
 *   check と同じ確認のあと、main.js と manifest.json を Generic Package Registry にアップロードし、
 *   CHANGELOG.md の節を説明文にして GitLab の Releases にリリースを作ります。
 *   GitLab CI（タグのパイプライン）専用で、CI の定義済み変数（CI_API_V4_URL、CI_PROJECT_ID、CI_JOB_TOKEN、CI_PROJECT_URL）を使います。
 */

import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { PACKAGE_NAME, RELEASE_FILES, buildPackageFileUrl, validateRelease } from "./release-lib.mjs";

/** リポジトリのルート（このスクリプトの1つ上のディレクトリ） */
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

const USAGE = "Usage: node scripts/release.mjs <check|publish> <tag>";

/**
 * リポジトリ直下のファイルを読みます。ファイルがなければ null を返します。
 */
async function readOptional(fileName) {
	try {
		return await readFile(path.join(ROOT, fileName), "utf-8");
	} catch (err) {
		if (err && err.code === "ENOENT") return null;
		throw err;
	}
}

/**
 * manifest.json・package.json・CHANGELOG.md を読み、リリースの前提条件を確かめます。
 */
async function loadAndValidate(tag) {
	const manifest = JSON.parse(await readFile(path.join(ROOT, "manifest.json"), "utf-8"));
	const pkg = JSON.parse(await readFile(path.join(ROOT, "package.json"), "utf-8"));
	const changelog = await readOptional("CHANGELOG.md");
	return validateRelease(tag, {
		manifestVersion: manifest.version,
		packageVersion: pkg.version,
		changelog,
	});
}

/**
 * GitLab の API を呼び、失敗したらステータスと応答本文を含むエラーにします。
 */
async function callApi(url, init, description) {
	const res = await fetch(url, init);
	if (!res.ok) {
		const body = await res.text().catch(() => "");
		throw new Error(`${description} failed: HTTP ${res.status} ${res.statusText}\n${body}`);
	}
	return res;
}

async function check(tag) {
	const { version, notes, errors } = await loadAndValidate(tag);
	if (errors.length > 0) {
		console.error(`Release check failed for ${tag}:`);
		for (const error of errors) console.error(`  - ${error}`);
		return false;
	}
	console.log(`Release check passed for ${tag} (version ${version}).`);
	console.log("Release notes:\n");
	console.log(notes);
	return true;
}

async function publish(tag) {
	const { version, notes, errors } = await loadAndValidate(tag);
	if (errors.length > 0) {
		console.error(`Release check failed for ${tag}:`);
		for (const error of errors) console.error(`  - ${error}`);
		return false;
	}

	const { CI_API_V4_URL: apiUrl, CI_PROJECT_ID: projectId, CI_JOB_TOKEN: jobToken, CI_PROJECT_URL: projectUrl } =
		process.env;
	const missing = Object.entries({ CI_API_V4_URL: apiUrl, CI_PROJECT_ID: projectId, CI_JOB_TOKEN: jobToken, CI_PROJECT_URL: projectUrl })
		.filter(([, value]) => !value)
		.map(([name]) => name);
	if (missing.length > 0) {
		console.error(`publish must run in GitLab CI. Missing variables: ${missing.join(", ")}`);
		return false;
	}

	// 1. ビルド結果を Generic Package Registry にアップロードする
	const links = [];
	for (const fileName of RELEASE_FILES) {
		const content = await readOptional(fileName);
		if (content === null) {
			console.error(`${fileName} was not found. Run the build before publishing.`);
			return false;
		}
		const url = buildPackageFileUrl(apiUrl, projectId, version, fileName);
		await callApi(
			url,
			{ method: "PUT", headers: { "JOB-TOKEN": jobToken }, body: content },
			`Uploading ${fileName} to the package registry`
		);
		console.log(`Uploaded ${fileName} to ${PACKAGE_NAME}/${version}.`);
		links.push({ name: fileName, url, link_type: "package", direct_asset_path: `/${fileName}` });
	}

	// 2. Releases にリリースを作る（説明文は CHANGELOG.md の節）
	await callApi(
		`${apiUrl.replace(/\/+$/, "")}/projects/${encodeURIComponent(projectId)}/releases`,
		{
			method: "POST",
			headers: { "JOB-TOKEN": jobToken, "Content-Type": "application/json" },
			body: JSON.stringify({
				tag_name: tag,
				name: `JotLine ${tag}`,
				description: notes,
				assets: { links },
			}),
		},
		`Creating the release ${tag}`
	);
	console.log(`Created the release: ${projectUrl}/-/releases/${tag}`);
	return true;
}

async function main() {
	const [command, tag] = process.argv.slice(2);
	if (!tag || (command !== "check" && command !== "publish")) {
		console.error(USAGE);
		return false;
	}
	return command === "check" ? check(tag) : publish(tag);
}

main()
	.then((ok) => {
		process.exitCode = ok ? 0 : 1;
	})
	.catch((err) => {
		console.error(err instanceof Error ? err.message : err);
		process.exitCode = 1;
	});
