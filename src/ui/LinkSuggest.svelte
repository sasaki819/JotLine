<script lang="ts">
	/**
	 * Obsidian の [[ 内部リンク入力時に候補ノートをインクリメンタル検索・提示するポップアップコンポーネント。
	 * 
	 * 【主な機能】:
	 * - Vault 内のすべての Markdown ノート（`app.vault.getMarkdownFiles()`）を対象に入力テキストでフィルタリング。
	 * - キーボード操作（↑ / ↓ / Enter / Tab / Esc）による候補選択をサポート。
	 * - 選択時に `[[ノート名]]` を自動挿入するためのコールバックを親コンポーネントへ通知。
	 */
	import type { App } from "obsidian";

	/** Obsidian アプリケーションインスタンス */
	export let app: App;
	/** ユーザーが `[[` の後に入力した検索クエリ文字列 */
	export let query = "";
	/** サジェストポップアップを表示するかどうかのフラグ */
	export let isOpen = false;
	/** 現在キーボードでハイライトされている候補のインデックス番号 */
	export let selectedIndex = 0;
	/** ノート候補が選択・確定された際のコールバック関数 */
	export let onSelect: (name: string) => void;

	// クエリに部分一致するVault内のMarkdownファイル名（basename）を最大8件抽出
	$: matchingFiles = isOpen
		? app.vault
				.getMarkdownFiles()
				.map((f) => f.basename)
				.filter((name) => name.toLowerCase().includes(query.toLowerCase()))
				.slice(0, 8)
		: [];

	// 候補件数の変動に応じて選択インデックスを範囲内に補正
	$: if (selectedIndex >= matchingFiles.length) {
		selectedIndex = 0;
	}

	/**
	 * 上下キー操作で選択カーソルを循環移動させます。
	 * @param delta +1（下移動）または -1（上移動）
	 */
	export function moveSelection(delta: number) {
		if (matchingFiles.length === 0) return;
		selectedIndex = (selectedIndex + delta + matchingFiles.length) % matchingFiles.length;
	}

	/**
	 * 現在選択されている候補を確定します。
	 * @returns 候補が存在して選択できた場合は true
	 */
	export function selectCurrent(): boolean {
		if (matchingFiles.length > 0 && matchingFiles[selectedIndex]) {
			onSelect(matchingFiles[selectedIndex]);
			return true;
		}
		return false;
	}

	/**
	 * 表示可能な候補が存在するかどうかを返します。
	 */
	export function hasSuggestions(): boolean {
		return matchingFiles.length > 0;
	}
</script>

<!-- ポップアップが開いており、一致するノートが1件以上ある場合にリストボックスを表示 -->
{#if isOpen && matchingFiles.length > 0}
	<div class="jotline-suggest-container" role="listbox">
		{#each matchingFiles as name, idx (name)}
			<!-- svelte-ignore a11y-click-events-have-key-events -->
			<div
				class="jotline-suggest-item {idx === selectedIndex ? 'is-selected' : ''}"
				role="option"
				tabindex="-1"
				aria-selected={idx === selectedIndex}
				on:mousedown|preventDefault={() => onSelect(name)}
			>
				<span class="jotline-suggest-icon">📄</span>
				<span class="jotline-suggest-name">{name}</span>
			</div>
		{/each}
	</div>
{/if}

<style>
	.jotline-suggest-container {
		position: absolute;
		bottom: 100%;
		left: 0;
		right: 0;
		margin-bottom: 4px;
		background: var(--background-primary);
		border: 1px solid var(--background-modifier-border);
		border-radius: var(--radius-s, 6px);
		box-shadow: var(--shadow-s, 0 4px 12px rgba(0, 0, 0, 0.2));
		max-height: 180px;
		overflow-y: auto;
		z-index: 100;
	}

	.jotline-suggest-item {
		display: flex;
		align-items: center;
		gap: 6px;
		padding: 6px 10px;
		font-size: 0.85em;
		color: var(--text-normal);
		cursor: pointer;
		transition: background-color 0.1s ease;
	}

	.jotline-suggest-item:hover,
	.jotline-suggest-item.is-selected {
		background-color: var(--background-modifier-hover);
		color: var(--text-accent);
	}

	.jotline-suggest-icon {
		font-size: 11px;
		opacity: 0.7;
	}

	.jotline-suggest-name {
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}
</style>
