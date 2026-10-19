/**
 * @file obsidian.ts
 * @description テスト用の `obsidian` モジュールの代替実装。
 *
 * `obsidian` パッケージは型定義のみで実行時コードを持たないため、
 * Vitest 実行時は vitest.config.mjs の alias でこのファイルに差し替えます。
 * テスト対象が実行時に使うものだけを最小限に定義します。
 */

/** 通知（テストでは何も表示しない） */
export class Notice {
	constructor(_message?: string | DocumentFragment, _duration?: number) {}
}
