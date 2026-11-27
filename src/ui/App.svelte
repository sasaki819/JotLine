<script lang="ts">
	/**
	 * @file App.svelte
	 * @description JotLineプラグインのメインUIコンポーネント。
	 * 
	 * 【主な役割・機能】
	 * 1. 画面レイアウト統括:
	 *    - 上部ヘッダー（タイトル、対象ファイル名、一括Markdownコピー、標準エディタ起動）
	 *    - 中央タイムライン（グループおよびカードの垂直スクロール一覧、最下部への自動スクロール）
	 *    - フローティング選択バー（カード複数選択時のアクションボタン群）
	 *    - 下部入力バー（InputBarコンポーネント）
	 * 2. カードの選択状態管理:
	 *    - 単一選択、Ctrl/Cmd+Clickによるトグル選択、Shift+Clickによる連続範囲選択、Escapeによる選択解除を実装。
	 * 3. コンテキストメニュー（右クリックメニュー）:
	 *    - Obsidianの `Menu` APIを利用し、選択カード数に応じたアクション（グループ化、グループへ移動、解除、コピー、削除）を提供。
	 * 4. 一括操作アクション:
	 *    - 選択カードのグループ化、グループ移動、グループ解除、Markdownコピー、一括削除の実行と状態リセット。
	 * 5. アンドゥ／リドゥ:
	 *    - ヘッダーのボタンとキー操作（Ctrl/Cmd+Z、Ctrl/Cmd+Shift+Z、Ctrl+Y）からストアのアンドゥ／リドゥを実行。
	 *    - アンドゥ／リドゥや外部変更で表示が置き換わったら、カードの選択を解除。
	 */
	import { onMount, tick } from "svelte";
	import { Notice, Menu, type App } from "obsidian";
	import type { JotStore } from "../store";
	import GroupView from "./GroupView.svelte";
	import InputBar from "./InputBar.svelte";
	import { addCardMoveMenu } from "./cardMoveMenu";
	import { exportToPureMarkdown } from "../parser";
	import { icon } from "../utils/icon";
	import { t } from "../i18n";

	/** データ管理ストア */
	export let store: JotStore;
	/** Obsidian Appインスタンス */
	export let app: App;

	/** タイムラインのDOM参照（スクロール制御用） */
	let timelineEl: HTMLElement;
	/** 現在選択中のカードIDセット */
	let selectedCardIds = new Set<string>();
	/** 範囲選択（Shift+Click）の起点となる直前に選択されたカードID */
	let lastSelectedCardId: string | null = null;

	// ストアのドキュメント状態を購読
	$: doc = store.doc;
	// アンドゥ／リドゥの可否（ヘッダーのボタンの有効／無効表示用）
	$: historyState = store.historyState;
	// 表示を置き換えた回数（アンドゥ／リドゥ／外部変更による読み直しで増える）
	$: replacedCount = store.replacedCount;
	// 表示が置き換わったら、カードIDが振り直されて古い選択が無効になるため選択を解除する
	$: handleReplaced($replacedCount);
	// 存在しなくなったカード（ドラッグ＆ドロップでの移動などで削除されたもの）を選択から外す
	$: pruneSelection(allCardIds);
	// ドキュメント内の全カードIDをフラットな配列として算出（範囲選択のインデックス計算に使用）
	$: allCardIds = $doc.groups.flatMap((g) => g.cards.map((c) => c.id));
	// 選択中のカードの中に、名前付きグループ（スレッド）に属しているカードが存在するか判定
	$: anySelectedInGroup = $doc.groups.some(
		(g) => g.name !== "" && g.cards.some((c) => selectedCardIds.has(c.id))
	);

	/**
	 * タイムラインを最下部までスクロールする
	 * DOM更新後に最下部へ移動するため tick() を待機します。
	 */
	async function scrollToBottom() {
		await tick();
		if (timelineEl) {
			timelineEl.scrollTop = timelineEl.scrollHeight;
		}
	}

	// コンポーネントマウント時に初期スクロールを最下部へ移動
	onMount(() => {
		scrollToBottom();
	});

	/**
	 * ドキュメント内の全メモをMarkdown形式でクリップボードへコピーする
	 */
	async function handleCopyAll() {
		const allCards = $doc.groups.flatMap((g) => g.cards);
		if (allCards.length === 0) {
			new Notice(t("NOTICE_NO_NOTES_TO_COPY"));
			return;
		}
		const md = exportToPureMarkdown(allCards);
		await navigator.clipboard.writeText(md);
		new Notice(t("NOTICE_COPIED_ALL", allCards.length));
	}

	/**
	 * 現在のJotLineファイル（_jotline.md等）をObsidianの標準Markdownエディタで開く
	 */
	function handleOpenInEditor() {
		const leaf = app.workspace.getLeaf(false);
		leaf.openFile(store.file);
	}

	/**
	 * カードクリック時の選択・複数選択処理
	 * ボタンや入力欄、編集領域内のクリックは選択処理を無視します。
	 * 
	 * - Shift+Click: 直前の選択カードから現在クリックしたカードまでの範囲を一括選択
	 * - Ctrl/Cmd+Click: 選択状態の個別トグル（追加/除外）
	 * - 単純クリック: 既に選択中の場合は選択解除
	 * 
	 * @param cardId クリックされたカードID
	 * @param event マウスイベント
	 */
	function handleSelectCard(cardId: string, event: MouseEvent) {
		const target = event.target as HTMLElement;
		// ボタン、テキストエリア、編集コンテナ、D&Dハンドルのクリックは選択処理を無視
		if (
			target.closest("button") ||
			target.closest("textarea") ||
			target.closest("input") ||
			target.closest(".jotline-edit-container") ||
			target.closest(".jotline-drag-handle")
		) {
			return;
		}

		if (event.shiftKey && lastSelectedCardId && allCardIds.includes(lastSelectedCardId)) {
			// Shift+Click: 連続するカード範囲を選択
			const idx1 = allCardIds.indexOf(lastSelectedCardId);
			const idx2 = allCardIds.indexOf(cardId);
			const start = Math.min(idx1, idx2);
			const end = Math.max(idx1, idx2);
			const newSet = new Set(selectedCardIds);
			for (let i = start; i <= end; i++) {
				newSet.add(allCardIds[i]);
			}
			selectedCardIds = newSet;
		} else if (event.ctrlKey || event.metaKey) {
			// Ctrl/Cmd+Click: 1枚ずつのトグル選択
			const newSet = new Set(selectedCardIds);
			if (newSet.has(cardId)) {
				newSet.delete(cardId);
			} else {
				newSet.add(cardId);
			}
			selectedCardIds = newSet;
			lastSelectedCardId = cardId;
		} else {
			// 修飾キーなしクリック: 選択があればクリア
			if (selectedCardIds.size > 0) {
				clearSelection();
			}
		}
	}

	/**
	 * カード右クリック時のコンテキストメニュー表示
	 * 右クリックされたカードが未選択ならそれを選択状態にし、選択枚数に応じたメニューを構築・表示します。
	 * 
	 * @param cardId 右クリックされたカードID
	 * @param event マウスイベント
	 */
	function handleContextMenuCard(cardId: string, event: MouseEvent) {
		event.preventDefault();

		// 右クリックされたカードが選択セットに含まれていなければ、そのカードのみを選択
		if (!selectedCardIds.has(cardId)) {
			selectedCardIds = new Set([cardId]);
			lastSelectedCardId = cardId;
		}

		const menu = new Menu();
		const targetCardIds = Array.from(selectedCardIds);
		const moveCallbacks = {
			onMoveToGroup: handleMoveCardsToGroup,
			onUngroup: handleUngroupCards,
		};

		// 指定したカード群の中に名前付きグループに属するカードがあるか判定
		const hasCardInNamedGroup = (ids: string[]) => {
			const set = new Set(ids);
			return $doc.groups.some((g) => g.name !== "" && g.cards.some((c) => set.has(c.id)));
		};

		if (targetCardIds.length >= 2) {
			// 複数枚選択時のメニュー構成
			menu.addItem((item) =>
				item
					.setTitle(t("MENU_GROUP_MULTI", targetCardIds.length))
					.setIcon("folder-plus")
					.onClick(async () => {
						await handleGroupSelection();
					})
			);
			addCardMoveMenu(menu, $doc.groups, targetCardIds, moveCallbacks, event);
			if (hasCardInNamedGroup(targetCardIds)) {
				menu.addItem((item) =>
					item
						.setTitle(t("MENU_UNGROUP_MULTI", targetCardIds.length))
						.setIcon("folder-minus")
						.onClick(async () => {
							await handleUngroupCards(targetCardIds);
						})
				);
			}
			menu.addItem((item) =>
				item
					.setTitle(t("MENU_COPY_MULTI", targetCardIds.length))
					.setIcon("copy")
					.onClick(async () => {
						await handleCopySelection();
					})
			);
			menu.addItem((item) =>
				item
					.setTitle(t("MENU_DELETE_MULTI", targetCardIds.length))
					.setIcon("trash")
					.onClick(async () => {
						await handleDeleteSelection();
					})
			);
			menu.addSeparator();
			menu.addItem((item) =>
				item
					.setTitle(t("MENU_CLEAR_SELECTION"))
					.setIcon("x")
					.onClick(() => {
						clearSelection();
					})
			);
		} else {
			// 単一カード選択時のメニュー構成
			if (hasCardInNamedGroup([cardId])) {
				menu.addItem((item) =>
					item
						.setTitle(t("MENU_CARD_UNGROUP"))
						.setIcon("folder-minus")
						.onClick(async () => {
							await handleUngroupCards(targetCardIds);
						})
				);
			} else {
				menu.addItem((item) =>
					item
						.setTitle(t("MENU_CARD_GROUP"))
						.setIcon("folder-plus")
						.onClick(async () => {
							await store.groupSelectedCards([cardId]);
							clearSelection();
						})
				);
			}
			addCardMoveMenu(menu, $doc.groups, targetCardIds, moveCallbacks, event);
			menu.addItem((item) =>
				item
					.setTitle(t("MENU_CARD_COPY"))
					.setIcon("copy")
					.onClick(async () => {
						const md = store.exportCard(cardId);
						await navigator.clipboard.writeText(md);
						new Notice(t("NOTICE_COPIED_CARD"));
					})
			);
			menu.addItem((item) =>
				item
					.setTitle(t("MENU_CARD_DELETE"))
					.setIcon("trash")
					.onClick(async () => {
						await store.deleteCard(cardId);
						clearSelection();
					})
			);
		}

		// マウスカーソル位置にコンテキストメニューを表示
		menu.showAtMouseEvent(event);
	}

	/**
	 * 選択中のカードを新規グループ（スレッド）にまとめる
	 */
	async function handleGroupSelection() {
		const ids = Array.from(selectedCardIds);
		if (ids.length === 0) return;
		await store.groupSelectedCards(ids);
		clearSelection();
	}

	/**
	 * 指定したカード群を既存の名前付きグループの末尾へ移動する
	 * 保存失敗時も選択を解除し、復元で振り直されたIDを選択状態に残さない。
	 */
	async function handleMoveCardsToGroup(ids: string[], targetGroupId: string) {
		if (ids.length === 0) return;
		try {
			await store.moveCardsToGroup(ids, targetGroupId);
		} finally {
			clearSelection();
		}
	}

	/**
	 * 指定したカード群のグループ所属を解除し、ファイル末尾の未分類グループへ移動する
	 * 保存失敗時も選択を解除し、復元で振り直されたIDを選択状態に残さない。
	 */
	async function handleUngroupCards(ids: string[]) {
		if (ids.length === 0) return;
		try {
			await store.ungroupSelectedCards(ids);
		} finally {
			clearSelection();
		}
	}

	/**
	 * 選択中のカードのグループ所属を解除（ファイル末尾の未分類グループへ移動）する
	 */
	async function handleUngroupSelection() {
		await handleUngroupCards(Array.from(selectedCardIds));
	}

	/**
	 * 選択中のカード群の内容をMarkdown形式でクリップボードへコピーする
	 */
	async function handleCopySelection() {
		const ids = Array.from(selectedCardIds);
		if (ids.length === 0) return;
		const md = store.exportSelectedCards(ids);
		await navigator.clipboard.writeText(md);
		new Notice(t("NOTICE_COPIED_SELECTION", ids.length));
	}

	/**
	 * 選択中のカード群を一括削除する
	 */
	async function handleDeleteSelection() {
		const ids = Array.from(selectedCardIds);
		if (ids.length === 0) return;
		await store.deleteMultipleCards(ids);
		clearSelection();
	}

	/**
	 * カードの選択状態をクリアする
	 */
	function clearSelection() {
		selectedCardIds = new Set();
		lastSelectedCardId = null;
	}

	/**
	 * 存在しなくなったカード（ドラッグ＆ドロップでの移動などで削除されたもの）を選択から外す
	 */
	function pruneSelection(existingIds: string[]) {
		const existing = new Set(existingIds);
		if ([...selectedCardIds].every((id) => existing.has(id))) return;
		selectedCardIds = new Set([...selectedCardIds].filter((id) => existing.has(id)));
		if (lastSelectedCardId && !existing.has(lastSelectedCardId)) {
			lastSelectedCardId = null;
		}
	}

	/**
	 * ドラッグ対象のカードID一覧を求める
	 * ドラッグしたカードが選択中で、選択が2枚以上なら選択中の全カード（ドキュメント上の並び順）、それ以外はドラッグしたカード1枚。
	 */
	function getDragCardIds(cardId: string): string[] {
		if (selectedCardIds.has(cardId) && selectedCardIds.size >= 2) {
			return allCardIds.filter((id) => selectedCardIds.has(id));
		}
		return [cardId];
	}

	/** 直前に処理した replacedCount の値（初回の値では選択を解除しないため） */
	let lastReplacedCount: number | null = null;

	/**
	 * 表示の置き換え（アンドゥ／リドゥ／外部変更による読み直し）を検知して選択を解除する
	 */
	function handleReplaced(count: number) {
		if (lastReplacedCount !== null && count !== lastReplacedCount) {
			clearSelection();
		}
		lastReplacedCount = count;
	}

	/**
	 * キー入力がアンドゥ／リドゥのショートカットかを判定する
	 * - アンドゥ: Ctrl/Cmd+Z
	 * - リドゥ: Ctrl/Cmd+Shift+Z、Ctrl+Y
	 */
	function getHistoryAction(event: KeyboardEvent): "undo" | "redo" | null {
		if (!(event.ctrlKey || event.metaKey) || event.altKey) return null;
		const key = event.key.toLowerCase();
		if (key === "z") return event.shiftKey ? "redo" : "undo";
		if (key === "y" && event.ctrlKey && !event.shiftKey) return "redo";
		return null;
	}

	/**
	 * フォーカス中の入力欄が、アンドゥ／リドゥのキーを入力欄の標準動作として使うべきかを判定する
	 * - カード編集欄・スレッド名編集欄・返信欄: 常に入力欄の標準動作
	 * - メイン入力欄: 文字が入力されている間だけ入力欄の標準動作（空ならJotLineのアンドゥ／リドゥ）
	 */
	function isHandledByTextInput(target: HTMLElement): boolean {
		if (
			target.closest(".jotline-edit-container") ||
			target.closest(".jotline-rename-box") ||
			target.closest(".jotline-reply-container")
		) {
			return true;
		}
		const chatInput = target.closest(".jotline-chat-input");
		if (chatInput instanceof HTMLTextAreaElement) {
			return chatInput.value !== "";
		}
		return false;
	}

	/**
	 * JotLineビュー内のキー入力を処理する
	 * - Ctrl/Cmd+Z、Ctrl/Cmd+Shift+Z、Ctrl+Y: アンドゥ／リドゥ（入力欄の標準動作を優先する場面は除外）
	 * - Escape: カードの選択状態を一括解除（Escapeが別の意味を持つ場面は除外）
	 */
	function handleKeyDown(event: KeyboardEvent) {
		if (event.isComposing) return;

		const historyAction = getHistoryAction(event);
		if (historyAction) {
			if (isHandledByTextInput(event.target as HTMLElement)) return;
			// Obsidian本体のホットキー処理（エディタのアンドゥ等）に渡さない
			event.preventDefault();
			event.stopPropagation();
			if (historyAction === "undo") {
				store.undo();
			} else {
				store.redo();
			}
			return;
		}

		handleEscape(event);
	}

	/**
	 * Escapeキーでカードの選択状態を一括解除する
	 * カード編集欄・スレッド名編集欄・返信欄・リンクサジェストなど、Escapeが別の意味を持つ場面は除外します。
	 */
	function handleEscape(event: KeyboardEvent) {
		if (event.key !== "Escape" || selectedCardIds.size === 0) return;
		// サジェストを閉じる等、子コンポーネントが処理済みのEscapeは無視
		if (event.defaultPrevented) return;
		const target = event.target as HTMLElement;
		if (
			target.closest(".jotline-edit-container") ||
			target.closest(".jotline-rename-box") ||
			target.closest(".jotline-reply-container")
		) {
			return;
		}
		clearSelection();
	}
</script>

<!-- JotLineメインアプリケーションコンテナ（tabindexはカードクリック後のキー入力を受け取るため） -->
<!-- svelte-ignore a11y-no-static-element-interactions -->
<div class="jotline-app-container" tabindex="-1" on:keydown={handleKeyDown}>
	<!-- 上部ヘッダーバー: タイトル・ファイル名表示・全件コピー・エディタ切替 -->
	<div class="jotline-header">
		<div class="jotline-title-area">
			<span class="jotline-app-icon">⚡</span>
			<span class="jotline-app-title">JotLine</span>
			<span class="jotline-file-badge">{store.file.basename}</span>
		</div>
		<div class="jotline-header-actions">
			<button
				class="clickable-icon jotline-history-btn"
				aria-label={t("UNDO_TOOLTIP")}
				title={t("UNDO_TOOLTIP")}
				use:icon={"undo-2"}
				disabled={!$historyState.canUndo}
				on:click={() => store.undo()}
			></button>
			<button
				class="clickable-icon jotline-history-btn"
				aria-label={t("REDO_TOOLTIP")}
				title={t("REDO_TOOLTIP")}
				use:icon={"redo-2"}
				disabled={!$historyState.canRedo}
				on:click={() => store.redo()}
			></button>
			<button
				class="clickable-icon"
				title={t("COPY_ALL_TOOLTIP")}
				on:click={handleCopyAll}
			>
				📋 {t("COPY_ALL")}
			</button>
			<button
				class="clickable-icon"
				title={t("OPEN_IN_EDITOR_TOOLTIP")}
				on:click={handleOpenInEditor}
			>
				📝 {t("OPEN_IN_EDITOR")}
			</button>
		</div>
	</div>

	<!-- タイムライン領域: グループおよびカードの垂直スクロール一覧 -->
	<div class="jotline-timeline" bind:this={timelineEl}>
		{#each $doc.groups as group, groupIndex (group.id)}
			<GroupView
				{group}
				{store}
				{app}
				isFirstGroup={groupIndex === 0}
				{selectedCardIds}
				onSelectCard={handleSelectCard}
				onContextMenuCard={handleContextMenuCard}
				{getDragCardIds}
			/>
		{/each}

		{#if $doc.groups.every((g) => g.cards.length === 0)}
			<!-- カードが1枚も存在しない場合の初期ウェルカム表示 -->
			<div class="jotline-welcome-empty">
				<div class="jotline-welcome-icon">💬</div>
				<h3>{t("EMPTY_WELCOME_TITLE")}</h3>
				<p>{t("EMPTY_WELCOME_DESC")}</p>
			</div>
		{/if}
	</div>

	<!-- フローティング選択バー: カード複数選択時に下部へ浮動表示される操作パネル -->
	{#if selectedCardIds.size > 0}
		<div class="jotline-selection-bar">
			<!-- 選択バー 1行目: 選択件数表示と閉じる(選択解除)ボタン -->
			<div class="jotline-selection-header">
				<span class="jotline-selection-count">
					{t("SELECTED_COUNT", selectedCardIds.size)}
				</span>
				<button
					class="clickable-icon"
					aria-label={t("CLEAR_SELECTION")}
					title={t("CLEAR_SELECTION")}
					use:icon={"x"}
					on:click={clearSelection}
				></button>
			</div>
			<!-- 選択バー 2行目: アクションボタン群（グループ化、解除、コピー、削除） -->
			<div class="jotline-selection-actions">
				<button
					class="clickable-icon mod-cta"
					aria-label={t("GROUP_SELECTION")}
					title={t("GROUP_SELECTION")}
					use:icon={"folder-plus"}
					on:click={handleGroupSelection}
				></button>
				{#if anySelectedInGroup}
					<button
						class="clickable-icon"
						aria-label={t("UNGROUP_SELECTION")}
						title={t("UNGROUP_SELECTION")}
						use:icon={"folder-minus"}
						on:click={handleUngroupSelection}
					></button>
				{/if}
				<button
					class="clickable-icon"
					aria-label={t("COPY_SELECTION_TOOLTIP")}
					title={t("COPY_SELECTION_TOOLTIP")}
					use:icon={"copy"}
					on:click={handleCopySelection}
				></button>
				<button
					class="clickable-icon mod-warning"
					aria-label={t("DELETE_SELECTION")}
					title={t("DELETE_SELECTION")}
					use:icon={"trash"}
					on:click={handleDeleteSelection}
				></button>
			</div>
		</div>
	{/if}

	<!-- 下部入力バー: テキスト入力・画像添付・テーブル貼り付け・送信 -->
	<InputBar {store} {app} onSend={scrollToBottom} />
</div>

<style>
	.jotline-app-container {
		display: flex;
		flex-direction: column;
		height: 100%;
		width: 100%;
		background: var(--background-primary);
		overflow: hidden;
		outline: none;
	}

	.jotline-header {
		display: flex;
		justify-content: space-between;
		align-items: center;
		padding: 8px 12px;
		background: var(--background-secondary);
		border-bottom: 1px solid var(--background-modifier-border);
		flex-shrink: 0;
	}

	.jotline-title-area {
		display: flex;
		align-items: center;
		gap: 6px;
		font-weight: 600;
	}

	.jotline-app-title {
		color: var(--text-normal);
		font-size: 0.9em;
	}

	.jotline-file-badge {
		font-size: 0.75em;
		padding: 2px 6px;
		border-radius: 4px;
		background: var(--background-modifier-form-field);
		color: var(--text-muted);
		max-width: 120px;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.jotline-header-actions {
		display: flex;
		gap: 4px;
	}

	.clickable-icon {
		background: none;
		border: none;
		cursor: pointer;
		font-size: 11px;
		padding: 4px 6px;
		border-radius: 4px;
		color: var(--text-muted);
	}

	.clickable-icon:hover {
		background-color: var(--background-modifier-hover);
		color: var(--text-normal);
	}

	.jotline-history-btn {
		display: inline-flex;
		align-items: center;
		justify-content: center;
	}

	.jotline-history-btn:disabled {
		opacity: 0.4;
		cursor: default;
	}

	.jotline-history-btn:disabled:hover {
		background: none;
		color: var(--text-muted);
	}

	.jotline-timeline {
		flex: 1;
		overflow-y: auto;
		padding: 12px;
		display: flex;
		flex-direction: column;
	}

	.jotline-welcome-empty {
		margin: auto;
		text-align: center;
		color: var(--text-muted);
		padding: 30px;
	}

	.jotline-welcome-icon {
		font-size: 32px;
		margin-bottom: 8px;
	}

	.jotline-welcome-empty h3 {
		margin: 4px 0;
		color: var(--text-normal);
	}

	.jotline-welcome-empty p {
		font-size: 0.85em;
		color: var(--text-faint);
	}

	.jotline-selection-bar {
		display: flex;
		flex-direction: column;
		gap: 6px;
		padding: 8px 12px;
		background: var(--background-secondary-alt);
		border-top: 1px solid var(--interactive-accent);
		border-bottom: 1px solid var(--background-modifier-border);
		flex-shrink: 0;
	}

	.jotline-selection-header {
		display: flex;
		align-items: center;
		justify-content: space-between;
	}

	.jotline-selection-header .clickable-icon {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		background: none;
		border: none;
		padding: 2px 4px;
		color: var(--text-muted);
		cursor: pointer;
		border-radius: var(--radius-s, 4px);
		transition: background-color 0.15s ease, color 0.15s ease;
	}

	.jotline-selection-header .clickable-icon:hover {
		background-color: var(--background-modifier-hover);
		color: var(--text-normal);
	}

	.jotline-selection-count {
		font-size: 0.85em;
		font-weight: 600;
		color: var(--text-accent);
	}

	.jotline-selection-actions {
		display: flex;
		align-items: center;
		gap: 8px;
	}

	.jotline-selection-actions .clickable-icon {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		padding: 6px 10px;
		border-radius: var(--radius-s, 4px);
		background-color: var(--background-secondary);
		border: 1px solid var(--background-modifier-border);
		color: var(--text-muted);
		cursor: pointer;
		transition: all 0.15s ease;
	}

	.jotline-selection-actions .clickable-icon:hover {
		background-color: var(--background-modifier-hover);
		color: var(--text-normal);
		border-color: var(--interactive-accent);
	}

	.jotline-selection-actions .clickable-icon.mod-cta {
		color: var(--interactive-accent);
	}

	.jotline-selection-actions .clickable-icon.mod-warning:hover {
		color: var(--text-error);
		border-color: var(--text-error);
	}
</style>
