<script lang="ts">
	/**
	 * タイムライン上の単一メモカードを描画・操作するコンポーネント。
	 * 
	 * 【主な機能】:
	 * 1. Obsidian公式の `MarkdownRenderer.render` によるリッチMarkdownプレビュー（数式・内部リンク・画像対応）。
	 * 2. ダブルクリックまたは「✏️」ボタンによるインライン編集モードへの移行。
	 * 3. インライン編集中の `[[` 内部リンクサジェスト（LinkSuggest）対応。
	 * 4. カーソル位置でのカード分割（`✂️ Split`）および上位カードとの可逆結合（`⬆️`）。
	 * 5. 既存カードに対する返信スレッドの作成（`💬`）。
	 * 6. 単体Markdownコピー（`📋`）および削除（`🗑️`）。
	 * 7. ドラッグハンドル（`⠿`）によるHTML5 Drag & Drop並び替え。
	 *    あわせて、エディタや別ファイルのJotLineビューへのドラッグ用に、ドラッグセッションと `text/plain` を設定する
	 *    （複数選択中は選択中の全カードが対象）。
	 * 8. 単一・複数選択ハイライト（`.is-selected`）と右クリックメニューイベント通知。
	 */
	import { onMount, onDestroy } from "svelte";
	import { get } from "svelte/store";
	import { App, Component, MarkdownRenderer, Notice } from "obsidian";
	import { exportToPureMarkdown } from "../parser";
	import { startDrag, endDrag, activeDragSource, JOTLINE_DRAG_MIME } from "../dnd";
	import type { JotCard } from "../types";
	import type { JotStore } from "../store";
	import { icon } from "../utils/icon";
	import { t } from "../i18n";
	import LinkSuggest from "./LinkSuggest.svelte";

	/** 表示対象のカードデータ */
	export let card: JotCard;
	/** カードが属する親グループのID */
	export let groupId: string;
	export let store: JotStore;
	export let app: App;
	/** 上位カードと結合（Merge Up）可能かどうかのフラグ（ドキュメント最上位のカード以外はtrue） */
	export let canMergeUp = false;
	/** グループ内で1つ上へ移動可能かどうかのフラグ（先頭カード以外はtrue） */
	export let canMoveUp = false;
	/** グループ内で1つ下へ移動可能かどうかのフラグ（末尾カード以外はtrue） */
	export let canMoveDown = false;
	/** 複数選択状態かどうか */
	export let isSelected = false;
	/** カードクリック時の選択イベント通知コールバック */
	export let onSelectCard: (cardId: string, event: MouseEvent) => void = () => {};
	/** カード右クリック時のコンテキストメニュー表示通知コールバック */
	export let onContextMenuCard: (cardId: string, event: MouseEvent) => void = () => {};
	/** ドラッグ対象のカードID一覧を求めるコールバック（複数選択中は選択中の全カード） */
	export let getDragCardIds: (cardId: string) => string[] = (cardId) => [cardId];

	/** インライン編集モード中フラグ */
	let isEditing = false;
	/** 編集中のテキスト */
	let editContent = card.content;
	/** 返信入力欄の展開フラグ */
	let isReplying = false;
	/** 返信メッセージテキスト */
	let replyText = "";

	/** MarkdownRenderer が描画するコンテナ要素 */
	let markdownContainer: HTMLElement;
	/** MarkdownRenderer のライフサイクル管理用 Obsidian Component */
	let obsidianComponent: Component;

	// インライン編集時の [[ サジェスト関連ステート
	let linkSuggestComponent: LinkSuggest;
	let isSuggestOpen = false;
	let suggestQuery = "";
	let suggestStartPos = 0;
	let editTextareaEl: HTMLTextAreaElement;

	/**
	 * 編集欄のカーソル直前テキストを解析し、`[[` 内部リンク入力中かを判定
	 */
	function checkSuggest(el: HTMLTextAreaElement) {
		const cursor = el.selectionStart;
		const textBefore = editContent.slice(0, cursor);
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
	 * サジェストから選択されたノートリンクを編集欄に挿入
	 */
	function handleSelectLink(name: string) {
		if (!editTextareaEl) return;
		const cursor = editTextareaEl.selectionStart;
		const before = editContent.slice(0, suggestStartPos);
		const after = editContent.slice(cursor);
		const inserted = `[[${name}]]`;
		editContent = before + inserted + after;
		isSuggestOpen = false;
		const newPos = before.length + inserted.length;
		setTimeout(() => {
			editTextareaEl.selectionStart = editTextareaEl.selectionEnd = newPos;
			editTextareaEl.focus();
		}, 0);
	}

	/**
	 * Obsidian の MarkdownRenderer を用いてカード本文をリッチHTMLとして描画します。
	 */
	function renderMarkdown() {
		if (!markdownContainer) return;
		markdownContainer.empty();
		if (!obsidianComponent) {
			obsidianComponent = new Component();
			obsidianComponent.load();
		}
		MarkdownRenderer.render(
			app,
			card.content,
			markdownContainer,
			store.file.path,
			obsidianComponent
		);
	}

	onMount(() => {
		renderMarkdown();
	});

	onDestroy(() => {
		// メモリリーク防止のため MarkdownRenderer のコンポーネントを安全にアンロード
		if (obsidianComponent) {
			obsidianComponent.unload();
		}
	});

	// カード本文が外部またはストアで更新された際にMarkdownを再描画
	$: if (!isEditing && markdownContainer && card.content) {
		renderMarkdown();
	}

	/** 編集モードの開始 */
	function startEdit() {
		editContent = card.content;
		isEditing = true;
	}

	/** 編集内容の保存 */
	async function saveEdit() {
		if (editContent.trim()) {
			await store.updateCard(card.id, editContent);
		}
		isEditing = false;
	}

	/** 編集のキャンセル */
	function cancelEdit() {
		editContent = card.content;
		isEditing = false;
	}

	/** スレッド返信の送信 */
	async function handleReply() {
		if (!replyText.trim()) return;
		await store.replyToCard(card.id, replyText);
		replyText = "";
		isReplying = false;
	}

	/** カード本文の単体クリップボードコピー */
	async function handleCopy() {
		await navigator.clipboard.writeText(card.content);
		new Notice(t("NOTICE_COPIED_CARD"));
	}

	/** カードの削除 */
	async function handleDelete() {
		await store.deleteCard(card.id);
	}

	/** 一つ上のカードと結合（Merge Up） */
	async function handleMergeUp() {
		await store.mergeWithPreviousCard(card.id);
	}

	/** カードをグループ内で1つ上へ移動 */
	async function handleMoveUp() {
		await store.moveCardUp(card.id);
	}

	/** カードをグループ内で1つ下へ移動 */
	async function handleMoveDown() {
		await store.moveCardDown(card.id);
	}

	/**
	 * 編集モード中、カーソル位置でカードを2分割（Split）します。
	 */
	async function handleSplit(textarea: HTMLTextAreaElement) {
		const selStart = textarea.selectionStart;
		if (selStart > 0 && selStart < editContent.length) {
			const before = editContent.substring(0, selStart);
			const after = editContent.substring(selStart);
			await store.splitCard(card.id, before, after);
			isEditing = false;
			new Notice(t("NOTICE_CARD_SPLIT"));
		} else {
			new Notice(t("NOTICE_SPLIT_HINT"));
		}
	}

	/**
	 * HTML5 Drag & Drop 開始処理。
	 * - 同じビュー内の並び替え用に、カードIDと所属グループIDをJSONデータとして設定します。
	 * - エディタや別ファイルのJotLineビューへのドラッグ用に、ドラッグセッションを開始し、
	 *   Markdownコピーと同じテキストを `text/plain` に設定します（複数選択中は選択中の全カード）。
	 * - カードの編集中・返信欄を開いている間は、カード自体をドラッグ不可にしています（`draggable` 属性）。
	 *   Chromium はドラッグ可能な親要素の中の入力欄で文字をドラッグすると親要素ごとドラッグするため、
	 *   入力欄の文字のドラッグをカードのドラッグとして扱わないようにするためです。
	 * - 編集中・返信欄を開いている間に届いた dragstart は、編集欄・返信欄の中の文字のドラッグ
	 *   （親のカードへバブリングしてきたもの）なので、何もせず入力欄の標準動作に任せます。
	 *   起点の要素での判定では防げなかったため、カードの状態で判定します。
	 */
	function handleDragStart(e: DragEvent) {
		if (!e.dataTransfer) return;
		if (isEditing || isReplying) return;
		const target = e.target;
		if (target instanceof Element && target.closest("textarea, input")) return;
		e.dataTransfer.setData("application/json", JSON.stringify({
			cardId: card.id,
			sourceGroupId: groupId,
		}));

		const cardIds = getDragCardIds(card.id);
		const idSet = new Set(cardIds);
		const cards = get(store.doc).groups.flatMap((g) => g.cards).filter((c) => idSet.has(c.id));
		const text = exportToPureMarkdown(cards);
		e.dataTransfer.setData(JOTLINE_DRAG_MIME, "cards");
		e.dataTransfer.setData("text/plain", text);
		e.dataTransfer.effectAllowed = "copyMove";
		startDrag({
			kind: "cards",
			store,
			filePath: store.file.path,
			cardIds: cards.map((c) => c.id),
			draggedCardId: card.id,
			text,
			contents: cards.map((c) => c.content.trim()),
		});
	}

	/** このカードが現在ドラッグ中かどうか */
	$: isDragging =
		$activeDragSource?.kind === "cards" &&
		$activeDragSource.store === store &&
		($activeDragSource.draggedCardId
			? $activeDragSource.draggedCardId === card.id
			: $activeDragSource.cardIds.includes(card.id));
</script>

<!-- svelte-ignore a11y-no-static-element-interactions -->
<!-- svelte-ignore a11y-no-noninteractive-element-interactions -->
<!-- svelte-ignore a11y-click-events-have-key-events -->
<div
	class="jotline-card {isSelected ? 'is-selected' : ''} {isDragging ? 'is-dragging' : ''}"
	role="article"
	aria-label="Note card"
	draggable={!isEditing && !isReplying}
	on:dragstart={handleDragStart}
	on:dragend={endDrag}
	on:click={(e) => onSelectCard(card.id, e)}
	on:contextmenu={(e) => onContextMenuCard(card.id, e)}
>
	<div class="jotline-card-header">
		<span class="jotline-drag-handle" title={t("DRAG_TO_REORDER")}>⠿</span>
		<div class="jotline-card-actions">
			{#if canMoveUp}
				<button
					class="clickable-icon"
					aria-label={t("MOVE_UP")}
					title={t("MOVE_UP")}
					use:icon={"arrow-up"}
					on:click={handleMoveUp}
				></button>
			{/if}
			{#if canMoveDown}
				<button
					class="clickable-icon"
					aria-label={t("MOVE_DOWN")}
					title={t("MOVE_DOWN")}
					use:icon={"arrow-down"}
					on:click={handleMoveDown}
				></button>
			{/if}
			{#if canMergeUp}
				<button
					class="clickable-icon"
					aria-label={t("MERGE_UP")}
					title={t("MERGE_UP")}
					on:click={handleMergeUp}
				>
					⬆️
				</button>
			{/if}
			<button class="clickable-icon" aria-label={t("REPLY_THREAD")} title={t("REPLY_THREAD")} on:click={() => (isReplying = !isReplying)}>
				💬
			</button>
			<button class="clickable-icon" aria-label={t("EDIT_CARD")} title={t("EDIT_CARD")} on:click={startEdit}>
				✏️
			</button>
			<button class="clickable-icon" aria-label={t("COPY_CARD")} title={t("COPY_CARD")} on:click={handleCopy}>
				📋
			</button>
			<button class="clickable-icon" aria-label={t("DELETE_CARD")} title={t("DELETE_CARD")} on:click={handleDelete}>
				🗑️
			</button>
		</div>
	</div>

	{#if isEditing}
		<div class="jotline-edit-container">
			<LinkSuggest
				bind:this={linkSuggestComponent}
				{app}
				query={suggestQuery}
				isOpen={isSuggestOpen}
				onSelect={handleSelectLink}
			/>
			<textarea
				bind:this={editTextareaEl}
				bind:value={editContent}
				rows="4"
				class="jotline-edit-textarea"
				on:input={(e) => checkSuggest(e.currentTarget)}
				on:keydown={(e) => {
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
							if (linkSuggestComponent.selectCurrent()) return;
						}
						if (e.key === "Escape") {
							e.preventDefault();
							isSuggestOpen = false;
							return;
						}
					}
					if ((e.ctrlKey || e.metaKey) && e.key === "Enter") {
						e.preventDefault();
						saveEdit();
					} else if (e.key === "Escape") {
						cancelEdit();
					}
				}}
			></textarea>
			<div class="jotline-edit-actions">
				<button class="mod-cta" title={t("SAVE_EDIT")} on:click={saveEdit}>{t("SAVE")}</button>
				<button title={t("CANCEL_EDIT")} on:click={cancelEdit}>{t("CANCEL")}</button>
				<button
					class="jotline-btn-split"
					title={t("SPLIT_CARD")}
					on:click={() => {
						if (editTextareaEl) handleSplit(editTextareaEl);
					}}
				>
					✂️ {t("SPLIT_CARD")}
				</button>
			</div>
		</div>
	{:else}
		<!-- svelte-ignore a11y-no-static-element-interactions -->
		<div
			class="jotline-card-content markdown-rendered"
			bind:this={markdownContainer}
			on:dblclick={startEdit}
		></div>
	{/if}

	{#if isReplying}
		<div class="jotline-reply-container">
			<input
				type="text"
				placeholder={t("REPLY_PLACEHOLDER")}
				bind:value={replyText}
				class="jotline-reply-input"
				on:keydown={(e) => {
					if (e.key === "Enter") {
						e.preventDefault();
						handleReply();
					} else if (e.key === "Escape") {
						isReplying = false;
					}
				}}
			/>
			<button class="mod-cta" on:click={handleReply}>{t("REPLY_SEND")}</button>
			<button on:click={() => (isReplying = false)}>{t("CANCEL")}</button>
		</div>
	{/if}
</div>

<style>
	.jotline-card {
		background-color: var(--background-primary-alt);
		border: 1px solid var(--background-modifier-border);
		border-radius: 8px;
		padding: 10px 12px;
		margin-bottom: 8px;
		position: relative;
		transition: border-color 0.15s ease, box-shadow 0.15s ease;
	}

	.jotline-card:hover {
		border-color: var(--interactive-accent);
	}

	.jotline-card.is-selected {
		border-color: var(--interactive-accent);
		background-color: var(--background-modifier-hover);
		box-shadow: 0 0 0 2px var(--interactive-accent);
	}

	.jotline-card.is-dragging {
		opacity: 0.45;
	}

	.jotline-card-header {
		display: flex;
		justify-content: space-between;
		align-items: center;
		margin-bottom: 6px;
		opacity: 0.6;
		transition: opacity 0.15s ease;
	}

	.jotline-card:hover .jotline-card-header {
		opacity: 1;
	}

	.jotline-drag-handle {
		cursor: grab;
		user-select: none;
		font-size: 14px;
		color: var(--text-muted);
	}

	.jotline-card-actions {
		display: flex;
		gap: 4px;
	}

	.clickable-icon {
		background: none;
		border: none;
		cursor: pointer;
		padding: 2px 4px;
		font-size: 12px;
		border-radius: 4px;
		color: var(--text-muted);
	}

	.clickable-icon:hover {
		background-color: var(--background-modifier-hover);
		color: var(--text-normal);
	}

	.jotline-card-content {
		line-height: 1.5;
		word-break: break-word;
		font-size: var(--font-text-size);
	}

	.jotline-edit-container {
		position: relative;
		display: flex;
		flex-direction: column;
		gap: 6px;
	}

	.jotline-edit-textarea {
		width: 100%;
		resize: vertical;
		background: var(--background-primary);
		color: var(--text-normal);
		border: 1px solid var(--interactive-accent);
		border-radius: 4px;
		padding: 6px;
		font-family: inherit;
		font-size: inherit;
	}

	.jotline-edit-actions {
		display: flex;
		gap: 6px;
		justify-content: flex-end;
	}

	.jotline-reply-container {
		margin-top: 8px;
		padding-top: 8px;
		border-top: 1px dashed var(--background-modifier-border);
		display: flex;
		gap: 6px;
	}

	.jotline-reply-input {
		flex: 1;
		background: var(--background-primary);
		border: 1px solid var(--background-modifier-border);
		border-radius: 4px;
		padding: 4px 8px;
		color: var(--text-normal);
	}
</style>
