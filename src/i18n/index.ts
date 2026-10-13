/**
 * @file index.ts
 * @description JotLineの多言語対応（i18n）管理モジュール。
 * 
 * Obsidianの現在の言語設定（`moment.locale()` / `localStorage.language`）に基づいて、
 * 日本語（ja）または英語（en: フォールバック）のテキストを返します。
 */

import en from "./locales/en";
import ja from "./locales/ja";

const localeMap: Record<string, typeof en> = {
	en,
	ja,
};

/**
 * 現在のObsidianまたはシステムの言語設定に対応する辞書オブジェクトを取得します。
 */
function getActiveLocale(): typeof en {
	let lang = "en";
	try {
		if (typeof window !== "undefined") {
			const win = window as any;
			if (win.moment && typeof win.moment.locale === "function") {
				lang = win.moment.locale();
			} else if (win.localStorage) {
				lang = win.localStorage.getItem("language") || navigator?.language || "en";
			}
		}
	} catch {
		lang = "en";
	}

	// "ja", "ja-jp" などのプレフィックスでマッチング
	const baseLang = lang.toLowerCase().split("-")[0];
	return localeMap[baseLang] ?? en;
}

/**
 * 指定したキーのローカライズ文字列を取得します。
 * 関数型の値（動的パラメータを持つメッセージ）の場合は引数を渡して評価します。
 * 
 * @param key 辞書キー
 * @param args パラメータ（関数型の場合）
 */
export function t<K extends keyof typeof en>(
	key: K,
	...args: typeof en[K] extends (...a: any[]) => any ? Parameters<typeof en[K]> : []
): string {
	const currentDict = getActiveLocale();
	const val = currentDict[key] ?? en[key];

	if (typeof val === "function") {
		return (val as (...a: any[]) => string)(...args);
	}
	return val as string;
}
