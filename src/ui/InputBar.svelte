<script lang="ts">
	/**
	 * 画面下部に常駐するチャット風クイックキャプチャ入力バー。
	 * 
	 * 【主な機能】:
	 * 1. テキスト入力 & Enter での即座なカード追加（Shift+Enter で改行）。
	 * 2. 入力量に応じた textarea の高さ自動伸縮（1行〜最大180px）。
	 * 3. `[[` 入力による内部リンクサジェスト（LinkSuggest）のインライン表示・キーボード操作。
	 * 4. クリップボードからの画像ペースト自動検知（Vaultのアタッチメント設定に保存して `![[...]]` 挿入）。
	 * 5. Excel/スプレッドシート（TSV）やHTML表の貼り付け自動検知（Markdownテーブル構文へ自動変換）。
	 */
	import { Notice, type App } from "obsidian";
	import type { JotStore } from "../store";
	import { htmlTableToMarkdownTable, tsvToMarkdownTable } from "../utils/tableConverter";
	import LinkSuggest from "./LinkSuggest.svelte";

	export let store: JotStore;
	export let app: App;
	/** メモ送信完了時に最下部への自動スクロールをトリガーするコールバック */
	export let onSend: () => void = () => {};

	let inputText = "";
	let textareaEl: HTMLTextAreaElement;
	let linkSuggestComponent: LinkSuggest;
	let isSuggestOpen = false;
	let suggestQuery = "";
	let suggestStartPos = 0;

	/**
	 * カーソル直前の文字列を解析し、`[[` 内部リンク入力中かどうかを判定します。
	 */
	function checkSuggest() {
		if (!textareaEl) return;
		const cursor = textareaEl.selectionStart;
		const textBefore = inputText.slice(0, cursor);
		// 直前に `[[` があり、その後に `]` や改行が含まれていないパターンを検出
		const match = textBefore.match(/\[\[([^\]\r\n]*)$/);
		if (match) {
			suggestQuery = match[1];
			suggestStartPos = match.index!;
			isSuggestOpen = true;
		} else {
			isSuggestOpen = false;
		}
	}

	/**
	 * サジェスト候補からノートが選択されたときに `[[ノート名]]` を入力欄へ挿入します。
	 */
	function handleSelectLink(name: string) {
		if (!textareaEl) return;
		const cursor = textareaEl.selectionStart;
		const before = inputText.slice(0, suggestStartPos);
		const after = inputText.slice(cursor);
		const inserted = `[[${name}]]`;
		inputText = before + inserted + after;
		isSuggestOpen = false;
		const newPos = before.length + inserted.length;
		setTimeout(() => {
			textareaEl.selectionStart = textareaEl.selectionEnd = newPos;
			textareaEl.focus();
			handleInput();
		}, 0);
	}

	/**
	 * メモを送信して新しいカードとして追加します。
	 */
	async function handleSend() {
		const text = inputText.trim();
		if (!text) return;

		await store.addCard(text);
		inputText = "";
		isSuggestOpen = false;
		if (textareaEl) {
			textareaEl.style.height = "auto";
		}
		onSend();
	}

	/**
	 * キーボード入力をハンドリングします。
	 * サジェストポップアップ表示中はサジェストの選択移動を優先し、通常時はEnter送信を行います。
	 */
	function handleKeyDown(e: KeyboardEvent) {
		// サジェスト表示中のキーナビゲーション
		if (isSuggestOpen && linkSuggestComponent && linkSuggestComponent.hasSuggestions()) {
			if (e.key === "ArrowDown") {
				e.preventDefault();
				linkSuggestComponent.moveSelection(1);
				return;
			}
			if (e.key === "ArrowUp") {
				e.preventDefault();
				linkSuggestComponent.moveSelection(-1);
				return;
			}
			if (e.key === "Enter" || e.key === "Tab") {
				e.preventDefault();
				if (linkSuggestComponent.selectCurrent()) {
					return;
				}
			}
			if (e.key === "Escape") {
				e.preventDefault();
				isSuggestOpen = false;
				return;
			}
		}

		// 通常時の Enter 送信（Shift+Enter で改行）
		if (e.key === "Enter" && !e.shiftKey) {
			e.preventDefault();
			handleSend();
		}
	}

	/**
	 * テキスト入力時の処理: サジェスト判定とテキストエリアの高さ自動調整
	 */
	function handleInput() {
		checkSuggest();
		if (textareaEl) {
			textareaEl.style.height = "auto";
			textareaEl.style.height = `${Math.min(textareaEl.scrollHeight, 180)}px`;
		}
	}

	/**
	 * クリップボードからのペーストイベントを捕捉し、画像や表データの自動変換を行います。
	 */
	async function handlePaste(e: ClipboardEvent) {
		const clipboardData = e.clipboardData;
		if (!clipboardData) return;

		// 1. 画像データのペースト検知
		const items = Array.from(clipboardData.items);
		for (const item of items) {
			if (item.type.startsWith("image/")) {
				const file = item.getAsFile();
				if (file) {
					e.preventDefault();
					await saveAndInsertImage(file);
					return;
				}
			}
		}

		// 2. HTML テーブルのペースト検知（ブラウザ等からのコピー）
		const html = clipboardData.getData("text/html");
		if (html && html.includes("<table")) {
			const mdTable = htmlTableToMarkdownTable(html);
			if (mdTable) {
				e.preventDefault();
				insertAtCursor(mdTable);
				return;
			}
		}

		// 3. TSV 表データのペースト検知（Excel/スプレッドシート等からのコピー）
		const text = clipboardData.getData("text/plain");
		if (text && text.includes("\t") && text.includes("\n")) {
			const mdTable = tsvToMarkdownTable(text);
			if (mdTable !== text) {
				e.preventDefault();
				insertAtCursor(mdTable);
				return;
			}
		}
	}

	/**
	 * 画像ファイルをVaultのアタッチメントフォルダにバイナリ保存し、Markdownリンク（`![[...]]`）を入力欄に挿入します。
	 */
	async function saveAndInsertImage(file: File) {
		try {
			const arrayBuffer = await file.arrayBuffer();
			const ext = file.name.split(".").pop() || "png";
			const baseName = `Pasted image ${new Date().toISOString().replace(/[:.]/g, "-")}.${ext}`;

			// Obsidian の内部APIを使用して設定に従ったアタッチメント保存先パスを解決
			// @ts-ignore
			const attachmentPath = await app.fileManager.getAvailablePathForAttachment(
				baseName,
				store.file.path
			);

			// Vault内に画像ファイルを新規作成
			const createdFile = await app.vault.createBinary(attachmentPath, arrayBuffer);
			// 現在のノートからの相対Markdownリンクを生成
			const link = app.fileManager.generateMarkdownLink(createdFile, store.file.path);

			insertAtCursor(`\n${link}\n`);
			new Notice("Image attached to note");
		} catch (err) {
			console.error("Failed to save attachment", err);
			new Notice("Failed to save image attachment");
		}
	}

	/**
	 * テキストエリアの現在カーソル位置に指定文字列を挿入します。
	 */
	function insertAtCursor(textToInsert: string) {
		if (!textareaEl) return;
		const start = textareaEl.selectionStart;
		const end = textareaEl.selectionEnd;
		inputText = inputText.substring(0, start) + textToInsert + inputText.substring(end);
		setTimeout(() => {
			textareaEl.selectionStart = textareaEl.selectionEnd = start + textToInsert.length;
			textareaEl.focus();
			handleInput();
		}, 0);
	}
</script>

<div class="jotline-input-bar">
	<LinkSuggest
		bind:this={linkSuggestComponent}
		{app}
		query={suggestQuery}
		isOpen={isSuggestOpen}
		onSelect={handleSelectLink}
	/>
	<textarea
		bind:this={textareaEl}
		bind:value={inputText}
		rows="1"
		placeholder="Type a memo... (Enter to send, Shift+Enter for new line)"
		class="jotline-chat-input"
		on:keydown={handleKeyDown}
		on:input={handleInput}
		on:paste={handlePaste}
	></textarea>
	<button
		class="jotline-send-btn mod-cta"
		title="Send (Enter)"
		on:click={handleSend}
		disabled={!inputText.trim()}
	>
		➤
	</button>
</div>

<style>
	.jotline-input-bar {
		position: relative;
		display: flex;
		align-items: flex-end;
		gap: 8px;
		padding: 10px 12px;
		background: var(--background-secondary);
		border-top: 1px solid var(--background-modifier-border);
	}

	.jotline-chat-input {
		flex: 1;
		resize: none;
		border-radius: 8px;
		border: 1px solid var(--background-modifier-border);
		background: var(--background-primary);
		color: var(--text-normal);
		padding: 8px 12px;
		font-family: inherit;
		font-size: var(--font-text-size);
		line-height: 1.4;
		max-height: 180px;
		outline: none;
		transition: border-color 0.15s ease;
	}

	.jotline-chat-input:focus {
		border-color: var(--interactive-accent);
	}

	.jotline-send-btn {
		width: 38px;
		height: 38px;
		border-radius: 50%;
		display: flex;
		align-items: center;
		justify-content: center;
		padding: 0;
		font-size: 15px;
		cursor: pointer;
		flex-shrink: 0;
	}

	.jotline-send-btn:disabled {
		opacity: 0.4;
		cursor: not-allowed;
	}
</style>
