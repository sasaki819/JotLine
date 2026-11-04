<script lang="ts">
	/**
	 * @file GroupView.svelte
	 * @description JotLineのカードグループ（スレッド）表示コンポーネント。
	 * 
	 * 【主な役割・機能】
	 * 1. スレッドヘッダー表示:
	 *    - 名前付きグループの場合、スレッドタイトル「🧵 グループ名 (カード枚数)」を表示。
	 *    - スレッド名のインライン編集（ダブルクリックまたは編集ボタン）。
	 *    - グループ単位のアクション（グループ解除/解散、Markdownとしてクリップボードへコピー）。
	 * 2. カードのコンテナ表示:
	 *    - 所属するカード一覧（CardView）を垂直に配置。
	 *    - 最上位カードかどうかの判定（canMergeUpプロパティの制御）。
	 * 3. ドラッグ＆ドロップ (D&D) 受付:
	 *    - グループコンテナ全体またはカード間ドロップ領域でカードの移動・並べ替えを受け付け。
	 * 4. 複数選択状態とイベントの中継:
	 *    - 親コンポーネント（App.svelte）から渡された選択状態やイベントハンドラをCardViewへ中継。
	 */
	import { Notice, Platform, type App } from "obsidian";
	import type { JotGroup } from "../types";
	import type { JotStore } from "../store";
	import { icon } from "../utils/icon";
	import { t } from "../i18n";
	import { startDrag, endDrag, getDragSource, isCopyDrop, JOTLINE_DRAG_MIME, type DragSource } from "../dnd";
	import CardView from "./CardView.svelte";

	/** 表示対象のグループデータ */
	export let group: JotGroup;
	/** データ操作用ストア */
	export let store: JotStore;
	/** Obsidian Appインスタンス */
	export let app: App;
	/** ドキュメント全体で最初のグループかどうか（先頭カードのMerge Up可否判定に使用） */
	export let isFirstGroup = false;
	/** 現在選択中のカードIDセット（複数選択ハイライト用） */
	export let selectedCardIds: Set<string> = new Set();
	/** カードクリック（選択・範囲選択）時のコールバック関数 */
	export let onSelectCard: (cardId: string, event: MouseEvent) => void = () => {};
	/** カード右クリック（コンテキストメニュー表示）時のコールバック関数 */
	export let onContextMenuCard: (cardId: string, event: MouseEvent) => void = () => {};
	/** ドラッグ対象のカードID一覧を求めるコールバック（CardViewへ中継） */
	export let getDragCardIds: (cardId: string) => string[] = (cardId) => [cardId];

	/** スレッドが折りたたまれているかどうかのフラグ */
	let isCollapsed = false;
	/** ドラッグオーバー中かどうかのフラグ（枠線ハイライト用） */
	let isDragOver = false;
	/** グループ名変更中かどうかのフラグ */
	let isRenaming = false;
	/** 変更中のグループ名入力バッファ */
	let editingName = group.name;

	// グループ名が外部から変更された場合（編集モード中でなければ）バッファを同期
	$: if (!isRenaming) {
		editingName = group.name;
	}

	/**
	 * グループ名変更モードを開始する
	 */
	function startRename() {
		editingName = group.name;
		isRenaming = true;
	}

	/** 編集欄が DOM に挿入されたら、キー操作と blur を受け取れるようにする。 */
	function focusRenameInput(node: HTMLInputElement) {
		node.focus();
	}

	/**
	 * 変更したグループ名を保存する
	 */
	async function saveRename() {
		if (!isRenaming) return;
		const newName = editingName.trim();
		const groupId = group.id;
		// 保存待ちや入力欄の削除に伴う blur からの再実行を防ぐ。
		isRenaming = false;
		if (newName && newName !== group.name) {
			await store.renameGroup(groupId, newName);
		}
	}

	/**
	 * グループ名変更をキャンセルし、元の名前に戻す
	 */
	function cancelRename() {
		isRenaming = false;
		editingName = group.name;
	}

	/**
	 * グループを解散（グループ化解除）する
	 * 所属する全カードをデフォルトグループ（未分類）に戻します。
	 */
	async function handleDissolveGroup() {
		const cardIds = group.cards.map((c) => c.id);
		await store.ungroupSelectedCards(cardIds);
	}

	/**
	 * グループ全体のカード内容をMarkdown形式でクリップボードにコピーする
	 */
	async function handleCopyGroup() {
		const md = store.exportGroup(group.id);
		await navigator.clipboard.writeText(md);
		new Notice(t("NOTICE_COPIED_GROUP", group.name || "Default"));
	}

	/**
	 * グループを所属カードごと削除する
	 */
	async function handleDeleteGroup() {
		await store.deleteGroup(group.id);
		new Notice(t("NOTICE_GROUP_DELETED", group.name || "Thread"));
	}

	/**
	 * スレッドヘッダーのドラッグ開始処理。
	 * エディタや別ファイルのJotLineビューへのドラッグ用に、ドラッグセッションを開始し、
	 * スレッドコピーと同じテキストを `text/plain` に設定します（並び替え用のJSONは設定しない）。
	 */
	function handleThreadDragStart(e: DragEvent) {
		if (!e.dataTransfer) return;
		// カード0枚のスレッドはドラッグの対象外（ヘッダーもドラッグ不可にしているが念のため）
		if (group.cards.length === 0) return;
		const text = store.exportGroup(group.id);
		e.dataTransfer.setData(JOTLINE_DRAG_MIME, "thread");
		e.dataTransfer.setData("text/plain", text);
		e.dataTransfer.effectAllowed = "copyMove";
		startDrag({
			kind: "thread",
			store,
			filePath: store.file.path,
			groupId: group.id,
			name: group.name,
			text,
			contents: group.cards.map((c) => c.content.trim()),
		});
	}

	/**
	 * ドラッグオーバー時のハンドラ
	 * 他のカードがこのグループ上にドラッグされた際にドロップ可能であることを示します。
	 */
	function handleDragOver(e: DragEvent) {
		// JotLine・エディタ由来のドラッグ（ドラッグセッションがあるもの）だけを受け付ける。
		// それ以外（カード編集欄の文字のドラッグなど）を受け付けると、ドロップしても何も追加されないのに、
		// ブラウザ標準の「移動」で元の入力欄から文字が消えてしまうため。
		if (!getDragSource()) return;
		e.preventDefault();
		if (e.dataTransfer) {
			e.dataTransfer.dropEffect = "move";
		}
		isDragOver = true;
	}

	/**
	 * ドラッグ領域から離れた時のハンドラ
	 */
	function handleDragLeave() {
		isDragOver = false;
	}

	/**
	 * ドロップ時のハンドラ
	 * ドラッグセッションに応じて、次のいずれかを行います。
	 * - 同じビュー内のカード: 既存の並び替え（ドラッグしたカード1枚の移動）。同じビュー内のスレッドは何もしない
	 * - 同じファイル（別ビュー、または同じファイルのエディタ）から: 何もせず通知
	 * - 別ファイルのJotLineビューのカード・スレッド: このグループへ追加し、移動なら元を削除
	 * - 別ファイルのエディタの選択テキスト: 1枚のカードとして追加し、移動なら元のノートから削除
	 * - それ以外（他のアプリからのテキストなど）: 何もしない
	 *
	 * @param e ドラッグイベント
	 * @param targetIndex 挿入先インデックス（省略時は末尾）
	 */
	async function handleDrop(e: DragEvent, targetIndex?: number) {
		e.preventDefault();
		isDragOver = false;

		// targetIndexが指定されていればその位置、なければグループ末尾に挿入
		const index = targetIndex !== undefined ? targetIndex : group.cards.length;
		const isCopy = isCopyDrop(e, Platform.isMacOS);
		const source = getDragSource();

		// JotLineのカード・スレッド（古いセッションを誤用しないよう、転送データの種類も確かめる）
		if (source && source.kind !== "editor" && e.dataTransfer?.types.includes(JOTLINE_DRAG_MIME)) {
			if (source.store === store) {
				if (source.kind === "cards") {
					await reorderDraggedCard(e, index);
				}
				return;
			}
			if (source.filePath === store.file.path) {
				new Notice(t("NOTICE_DROP_SAME_FILE"));
				return;
			}
			await dropFromJotLine(source, index, isCopy);
			return;
		}

		// エディタの選択テキスト（ドロップされたテキストがセッションと一致する場合だけ）
		if (source && source.kind === "editor") {
			if (e.dataTransfer?.getData("text/plain") !== source.text) return;
			if (source.filePath === store.file.path) {
				new Notice(t("NOTICE_DROP_SAME_FILE"));
				return;
			}
			await dropFromEditor(source, index, isCopy);
			return;
		}
	}

	/**
	 * 同じビュー内でドラッグされたカード1枚を、このグループの指定位置へ並び替えます（既存の並び替え）。
	 */
	async function reorderDraggedCard(e: DragEvent, index: number) {
		const rawData = e.dataTransfer?.getData("application/json");
		if (!rawData) return;

		try {
			const data = JSON.parse(rawData);
			const cardId = data.cardId;
			await store.reorderCard(cardId, group.id, index);
		} catch (err) {
			console.error("Failed to parse dropped card data", err);
		}
	}

	/**
	 * 別ファイルのJotLineビューからドラッグされたカード・スレッドを追加し、移動なら元を削除します。
	 * 追加に成功した場合だけ元を削除します（追加に失敗した場合は、ストアが書き込み失敗を通知済み）。
	 */
	async function dropFromJotLine(source: Exclude<DragSource, { kind: "editor" }>, index: number, isCopy: boolean) {
		const inserted =
			source.kind === "cards"
				? await store.insertCards(group.id, index, source.contents)
				: await store.insertThreadAfter(group.id, source.name, source.contents);
		if (!inserted || isCopy) return;

		const removed =
			source.kind === "cards"
				? await source.store.removeCards(source.cardIds)
				: await source.store.removeGroup(source.groupId);
		if (!removed) {
			new Notice(t("NOTICE_MOVE_SOURCE_NOT_REMOVED"));
		}
	}

	/**
	 * 別ファイルのエディタからドラッグされた選択テキストを1枚のカードとして追加し、
	 * 移動なら元のノートから選択範囲を削除します（エディタの編集として行うため、エディタのアンドゥで戻せる）。
	 * 元の範囲の内容がドラッグ開始時から変わっている場合（エディタが閉じられた場合を含む）は削除しません。
	 */
	async function dropFromEditor(source: Extract<DragSource, { kind: "editor" }>, index: number, isCopy: boolean) {
		const inserted = await store.insertCards(group.id, index, [source.text]);
		if (!inserted || isCopy) return;

		const { editor, from, to, text } = source;
		try {
			if (editor.getRange(from, to) !== text) {
				new Notice(t("NOTICE_MOVE_SOURCE_NOT_REMOVED"));
				return;
			}
			editor.replaceRange("", from, to);
		} catch (err) {
			console.error("JotLine: Failed to remove the dragged text from the editor", err);
			new Notice(t("NOTICE_MOVE_SOURCE_NOT_REMOVED"));
		}
	}
</script>

<!-- グループ全体のコンテナ（名前付きスレッドまたはデフォルトグループ） -->
<div
	class="jotline-group {group.name ? 'is-thread' : 'is-default'} {isDragOver ? 'is-dragover' : ''} {isCollapsed ? 'is-collapsed' : ''}"
	on:dragover={handleDragOver}
	on:dragleave={handleDragLeave}
	on:drop={(e) => handleDrop(e)}
	role="region"
	aria-label={group.name ? `Thread: ${group.name}` : "Unclassified Notes"}
>
	{#if group.name}
		<!-- スレッドヘッダー（名前付きグループのみ表示。カードが1枚以上あり、スレッド名の編集中でなければドラッグ可能） -->
		<!-- svelte-ignore a11y-no-static-element-interactions -->
		<div
			class="jotline-group-header"
			draggable={!isRenaming && group.cards.length > 0}
			on:dragstart={handleThreadDragStart}
			on:dragend={endDrag}
		>
			<div class="jotline-group-title">
				<!-- アコーディオン展開/折りたたみボタン -->
				<button
					class="clickable-icon jotline-collapse-toggle"
					aria-label={isCollapsed ? t("EXPAND_THREAD") : t("COLLAPSE_THREAD")}
					title={isCollapsed ? t("EXPAND_THREAD") : t("COLLAPSE_THREAD")}
					use:icon={isCollapsed ? "chevron-right" : "chevron-down"}
					on:click={() => (isCollapsed = !isCollapsed)}
				></button>
				{#if isRenaming}
					<!-- スレッド名のインライン編集入力ボックス -->
					<div class="jotline-rename-box">
						<input
							type="text"
							class="jotline-rename-input"
							bind:value={editingName}
							use:focusRenameInput
							on:blur={saveRename}
							on:keydown={(e) => {
								if (e.isComposing || e.keyCode === 229) return;
								if (e.key === "Enter") saveRename();
								else if (e.key === "Escape") cancelRename();
							}}
						/>
					</div>
				{:else}
					<!-- スレッド名ラベル（ダブルクリックまたは編集ボタンで変更可能） -->
					<!-- svelte-ignore a11y-no-static-element-interactions -->
					<span
						class="jotline-thread-name clickable"
						title={t("DOUBLE_CLICK_TO_RENAME")}
						on:dblclick={startRename}
					>
						{group.name}
					</span>
					<button class="clickable-icon" title={t("RENAME_THREAD")} on:click={startRename}>
						✏️
					</button>
					<span class="jotline-card-count">({group.cards.length})</span>
				{/if}
			</div>
			<!-- グループ操作ボタン群（解散、Markdownコピー、削除） -->
			<div class="jotline-group-actions">
				<button
					class="clickable-icon"
					aria-label={t("UNGROUP_THREAD_TOOLTIP")}
					title={t("UNGROUP_THREAD_TOOLTIP")}
					use:icon={"folder-minus"}
					on:click={handleDissolveGroup}
				></button>
				<button
					class="clickable-icon"
					aria-label={t("COPY_THREAD_TOOLTIP")}
					title={t("COPY_THREAD_TOOLTIP")}
					use:icon={"copy"}
					on:click={handleCopyGroup}
				></button>
				<button
					class="clickable-icon mod-warning"
					aria-label={t("DELETE_THREAD_TOOLTIP")}
					title={t("DELETE_THREAD_TOOLTIP")}
					use:icon={"trash"}
					on:click={handleDeleteGroup}
				></button>
			</div>
		</div>
	{/if}

	<!-- グループ所属カード一覧コンテナ（折りたたまれていない時のみ表示） -->
	{#if !isCollapsed}
		<div class="jotline-group-cards">
			{#each group.cards as card, index (card.id)}
				<!-- 各カードのドロップ領域ラッパー（カード間の並べ替えを受け付け） -->
				<div
					class="jotline-card-wrapper"
					on:dragover={(e) => {
						e.stopPropagation();
						handleDragOver(e);
					}}
					on:drop={(e) => {
						e.stopPropagation();
						handleDrop(e, index);
					}}
					role="listitem"
				>
					<CardView
						{card}
						groupId={group.id}
						{store}
						{app}
						canMergeUp={!(isFirstGroup && index === 0)}
						canMoveUp={index > 0}
						canMoveDown={index < group.cards.length - 1}
						isSelected={selectedCardIds.has(card.id)}
						{onSelectCard}
						{onContextMenuCard}
						{getDragCardIds}
					/>
				</div>
			{/each}

			{#if group.cards.length === 0}
				<!-- カードが0枚の時の空状態プレースホルダー -->
				<div class="jotline-empty-group">
					{t("DROP_CARDS_HERE")}
				</div>
			{/if}
		</div>
	{/if}
</div>

<style>
	.jotline-group {
		margin-bottom: 16px;
		border-radius: 8px;
		transition: background-color 0.15s ease, border-color 0.15s ease;
	}

	.jotline-group.is-thread {
		border: 1px solid var(--background-modifier-border);
		background-color: var(--background-secondary-alt);
		padding: 8px 10px;
	}

	.jotline-group.is-dragover {
		border-color: var(--interactive-accent);
		background-color: var(--background-modifier-hover);
	}

	.jotline-group-header {
		display: flex;
		justify-content: space-between;
		align-items: center;
		padding-bottom: 6px;
		margin-bottom: 8px;
		border-bottom: 1px solid var(--background-modifier-border);
	}

	.jotline-group.is-collapsed .jotline-group-header {
		margin-bottom: 0;
		border-bottom: none;
		padding-bottom: 0;
	}

	.jotline-collapse-toggle {
		padding: 2px;
	}

	.jotline-group-title {
		display: flex;
		align-items: center;
		gap: 6px;
		font-size: 0.85em;
		font-weight: 600;
		color: var(--text-muted);
	}

	.jotline-thread-name {
		color: var(--text-normal);
	}

	.jotline-thread-name.clickable {
		cursor: pointer;
		padding: 2px 4px;
		border-radius: 4px;
		transition: background-color 0.15s ease;
	}

	.jotline-thread-name.clickable:hover {
		background-color: var(--background-modifier-hover);
	}

	.jotline-rename-box {
		display: flex;
		align-items: center;
		gap: 4px;
	}

	.jotline-rename-input {
		background: var(--background-primary);
		color: var(--text-normal);
		border: 1px solid var(--interactive-accent);
		border-radius: 4px;
		padding: 2px 6px;
		font-size: 0.9em;
		font-family: inherit;
		min-width: 140px;
	}

	.jotline-card-count {
		font-size: 0.8em;
		color: var(--text-faint);
	}

	.clickable-icon {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		background: none;
		border: none;
		cursor: pointer;
		font-size: 11px;
		padding: 4px;
		border-radius: var(--radius-s, 4px);
		color: var(--text-muted);
		transition: background-color 0.15s ease, color 0.15s ease;
	}

	.clickable-icon:hover {
		background-color: var(--background-modifier-hover);
		color: var(--text-normal);
	}

	.jotline-group-cards {
		display: flex;
		flex-direction: column;
	}

	.jotline-empty-group {
		padding: 12px;
		text-align: center;
		color: var(--text-faint);
		font-size: 0.85em;
		border: 1px dashed var(--background-modifier-border);
		border-radius: 6px;
	}
</style>
