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
	 *    - 単一選択、Ctrl/Cmd+Clickによるトグル選択、Shift+Clickによる連続範囲選択を実装。
	 * 3. コンテキストメニュー（右クリックメニュー）:
	 *    - Obsidianの `Menu` APIを利用し、選択カード数に応じたアクション（グループ化、解除、コピー、削除）を提供。
	 * 4. 一括操作アクション:
	 *    - 選択カードのグループ化、グループ解除、Markdownコピー、一括削除の実行と状態リセット。
	 */
	import { onMount, tick } from "svelte";
	import { Notice, Menu, type App } from "obsidian";
	import type { JotStore } from "../store";
	import GroupView from "./GroupView.svelte";
	import InputBar from "./InputBar.svelte";
	import { exportToPureMarkdown } from "../parser";
	import { icon } from "../utils/icon";

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
			new Notice("No notes to copy");
			return;
		}
		const md = exportToPureMarkdown(allCards);
		await navigator.clipboard.writeText(md);
		new Notice(`Copied all ${allCards.length} notes as Markdown`);
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
	 * ボタンや入力欄、編集領域内のクリックは除外します。
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

		// 指定したカード群の中に名前付きグループに属するカードがあるか判定
		const hasCardInNamedGroup = (ids: string[]) => {
			const set = new Set(ids);
			return $doc.groups.some((g) => g.name !== "" && g.cards.some((c) => set.has(c.id)));
		};

		if (targetCardIds.length >= 2) {
			// 複数枚選択時のメニュー構成
			menu.addItem((item) =>
				item
					.setTitle(`選択した${targetCardIds.length}枚をグループ化`)
					.setIcon("folder-plus")
					.onClick(async () => {
						await handleGroupSelection();
					})
			);
			if (hasCardInNamedGroup(targetCardIds)) {
				menu.addItem((item) =>
					item
						.setTitle(`選択した${targetCardIds.length}枚のグループ化解除`)
						.setIcon("folder-minus")
						.onClick(async () => {
							await handleUngroupSelection();
						})
				);
			}
			menu.addItem((item) =>
				item
					.setTitle(`選択した${targetCardIds.length}枚をMarkdownコピー`)
					.setIcon("copy")
					.onClick(async () => {
						await handleCopySelection();
					})
			);
			menu.addItem((item) =>
				item
					.setTitle(`選択した${targetCardIds.length}枚を削除`)
					.setIcon("trash")
					.onClick(async () => {
						await handleDeleteSelection();
					})
			);
			menu.addSeparator();
			menu.addItem((item) =>
				item
					.setTitle("選択を解除")
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
						.setTitle("グループ化解除 (未分類に戻す)")
						.setIcon("folder-minus")
						.onClick(async () => {
							await store.ungroupSelectedCards([cardId]);
							clearSelection();
						})
				);
			} else {
				menu.addItem((item) =>
					item
						.setTitle("このカードをグループ化")
						.setIcon("folder-plus")
						.onClick(async () => {
							await store.groupSelectedCards([cardId]);
							clearSelection();
						})
				);
			}
			menu.addItem((item) =>
				item
					.setTitle("Markdownとしてコピー")
					.setIcon("copy")
					.onClick(async () => {
						const md = store.exportCard(cardId);
						await navigator.clipboard.writeText(md);
						new Notice("Card copied to clipboard");
					})
			);
			menu.addItem((item) =>
				item
					.setTitle("カードを削除")
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
	 * 選択中のカードのグループ所属を解除（未分類グループへ戻す）する
	 */
	async function handleUngroupSelection() {
		const ids = Array.from(selectedCardIds);
		if (ids.length === 0) return;
		await store.ungroupSelectedCards(ids);
		clearSelection();
	}

	/**
	 * 選択中のカード群の内容をMarkdown形式でクリップボードへコピーする
	 */
	async function handleCopySelection() {
		const ids = Array.from(selectedCardIds);
		if (ids.length === 0) return;
		const md = store.exportSelectedCards(ids);
		await navigator.clipboard.writeText(md);
		new Notice(`Copied ${ids.length} cards as Markdown`);
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
</script>

<!-- JotLineメインアプリケーションコンテナ -->
<div class="jotline-app-container">
	<!-- 上部ヘッダーバー: タイトル・ファイル名表示・全件コピー・エディタ切替 -->
	<div class="jotline-header">
		<div class="jotline-title-area">
			<span class="jotline-app-icon">⚡</span>
			<span class="jotline-app-title">JotLine</span>
			<span class="jotline-file-badge">{store.file.basename}</span>
		</div>
		<div class="jotline-header-actions">
			<button
				class="clickable-icon"
				title="Copy all notes as Markdown"
				on:click={handleCopyAll}
			>
				📋 Copy All
			</button>
			<button
				class="clickable-icon"
				title="Open in standard Markdown editor"
				on:click={handleOpenInEditor}
			>
				📝 Markdown
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
			/>
		{/each}

		{#if $doc.groups.every((g) => g.cards.length === 0)}
			<!-- カードが1枚も存在しない場合の初期ウェルカム表示 -->
			<div class="jotline-welcome-empty">
				<div class="jotline-welcome-icon">💬</div>
				<h3>No notes yet</h3>
				<p>Type a thought below to quickly capture it.</p>
			</div>
		{/if}
	</div>

	<!-- フローティング選択バー: カード複数選択時に下部へ浮動表示される操作パネル -->
	{#if selectedCardIds.size > 0}
		<div class="jotline-selection-bar">
			<!-- 選択バー 1行目: 選択件数表示と閉じる(選択解除)ボタン -->
			<div class="jotline-selection-header">
				<span class="jotline-selection-count">
					{selectedCardIds.size}件のカードを選択中
				</span>
				<button
					class="clickable-icon"
					aria-label="選択を解除"
					title="選択を解除"
					use:icon={"x"}
					on:click={clearSelection}
				></button>
			</div>
			<!-- 選択バー 2行目: アクションボタン群（グループ化、解除、コピー、削除） -->
			<div class="jotline-selection-actions">
				<button
					class="clickable-icon mod-cta"
					aria-label={selectedCardIds.size >= 2 ? "選択したカードをグループ化" : "グループ化（2枚以上選択）"}
					title={selectedCardIds.size >= 2 ? "選択したカードをグループ化" : "グループ化（2枚以上選択）"}
					use:icon={"folder-plus"}
					on:click={handleGroupSelection}
				></button>
				{#if anySelectedInGroup}
					<button
						class="clickable-icon"
						aria-label="グループ化解除（未分類に戻す）"
						title="グループ化解除（未分類に戻す）"
						use:icon={"folder-minus"}
						on:click={handleUngroupSelection}
					></button>
				{/if}
				<button
					class="clickable-icon"
					aria-label="選択したカードをMarkdownコピー"
					title="選択したカードをMarkdownコピー"
					use:icon={"copy"}
					on:click={handleCopySelection}
				></button>
				<button
					class="clickable-icon mod-warning"
					aria-label="選択したカードを削除"
					title="選択したカードを削除"
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
