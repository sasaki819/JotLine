/**
 * @file declarations.d.ts
 * @description TypeScript用の型定義ファイル。
 * 
 * TypeScriptコンパイラが `.svelte` ファイルのimportを解決できるように、
 * Svelteコンポーネントモジュールのデフォルトエクスポート型（ComponentType）を宣言します。
 */

declare module "*.svelte" {
	import type { ComponentType } from "svelte";
	const component: ComponentType;
	export default component;
}

