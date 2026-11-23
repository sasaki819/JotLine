import { App, EventRef, TFile, Notice } from "obsidian";
import { writable, get, type Writable } from "svelte/store";
import { JotCard, JotDocument, JotGroup } from "./types";
import {
	exportToPureMarkdown,
	generateId,
	parseJotDocument,
	serializeJotDocument,
	mergeCardWithPrevious,
	groupSelectedCards,
	generateGroupTimestamp,
	moveCardsToGroupInDoc,
	ungroupCards,
	dissolveGroupInDoc,
	renameGroup,
	deleteGroupDoc,
	moveCardInDoc,
	insertCardsInDoc,
	insertGroupAfterInDoc,
	removeCardsFromDoc,
} from "./parser";
import { t } from "./i18n";
import { UndoHistory } from "./history";


/**
 * JotLine の状態管理およびファイル永続化を担当するストアクラス。
 * 
 * 【主な責務】:
 * 1. Svelte の Writable ストア（`doc`）を保持し、UIへのリアクティブな状態変更を通知。
 * 2. 対象 Markdown ファイル（`TFile`）の読み込み（`load`）および安全な一括保存（`save`）。
 * 3. Obsidian Vault の `modify` イベントを監視し、外部編集（他ペインや別アプリ同期）を自動検知して再描画。
 * 4. 自プラグイン保存時の更新検知ループ防止（`isSaving` フラグとデバウンス制御）。
 * 5. アンドゥ／リドゥ用の操作履歴の管理。履歴の1件は「変更直前のファイル内容（テキスト全体）」で、
 *    JotLine上の操作と、検知した外部変更のたびに積まれる。
 */
export class JotStore {
	/** Obsidian アプリケーションインスタンス */
	app: App;
	/** 対象となるMarkdownファイル */
	file: TFile;
	/** Svelte UI が購読するリアクティブなJotDocumentストア */
	doc: Writable<JotDocument>;
	/** 自プラグインによる保存処理中フラグ（外部変更検知との無限ループ防止用） */
	isSaving = false;
	/** Vault modify イベントのリスナー参照 */
	private modifyEventRef: EventRef | null = null;
	/** 最後に読み込んだ、または書き込んだファイル内容（履歴の比較・記録の基準） */
	private currentText = "";
	/** アンドゥ／リドゥ用の操作履歴 */
	private history = new UndoHistory();
	/** アンドゥ／リドゥの書き込み中フラグ（重ねての実行を防ぐ） */
	private isApplying = false;
	/** アンドゥ／リドゥの可否（ボタンの有効／無効表示用） */
	historyState: Writable<{ canUndo: boolean; canRedo: boolean }> = writable({ canUndo: false, canRedo: false });
	/**
	 * 表示を置き換えた回数（アンドゥ／リドゥ／外部変更による読み直しのたびに増加）。
	 * UIはこれを購読し、変化したらカードの選択を解除する。
	 */
	replacedCount: Writable<number> = writable(0);

	constructor(app: App, file: TFile) {
		this.app = app;
		this.file = file;
		this.doc = writable<JotDocument>({
			groups: [{ id: generateId(), name: "", cards: [] }],
		});
	}

	/**
	 * ストアを初期化し、ファイル読み込みとVault変更イベントリスナーの登録を行います。
	 */
	async init() {
		await this.loadInitial();

		// ファイル変更イベントを監視（他ペインや別デバイスからの変更を即座にUIへ反映）
		this.modifyEventRef = this.app.vault.on("modify", async (modifiedFile) => {
			if (modifiedFile.path === this.file.path && !this.isSaving) {
				await this.handleExternalChange();
			}
		});
	}

	/**
	 * ストア破棄時にイベントリスナーを安全に解除します。
	 */
	destroy() {
		if (this.modifyEventRef) {
			this.app.vault.offref(this.modifyEventRef);
			this.modifyEventRef = null;
		}
	}

	/**
	 * 対象Markdownファイルを初回読み込みし、パースしてストアを更新します（履歴には積みません）。
	 */
	private async loadInitial() {
		try {
			const content = await this.app.vault.read(this.file);
			this.currentText = content;
			this.doc.set(parseJotDocument(content));
		} catch (e) {
			console.error("JotLine: Failed to load file", e);
			new Notice("JotLine: Failed to read file");
		}
	}

	/**
	 * 外部（標準エディタ、同期、他アプリ等）によるファイル変更を取り込みます。
	 * 内容が変わっていれば、変更前の内容を1件の履歴として積み（リドゥ履歴は破棄）、表示を置き換えます。
	 */
	private async handleExternalChange() {
		let content: string;
		try {
			content = await this.app.vault.read(this.file);
		} catch (e) {
			console.error("JotLine: Failed to load file", e);
			new Notice("JotLine: Failed to read file");
			return;
		}
		// 自己保存のイベントが遅れて届いた場合など、内容が同じなら何もしない
		if (content === this.currentText) return;

		this.history.record(this.currentText);
		this.currentText = content;
		this.doc.set(parseJotDocument(content));
		this.replacedCount.update((n) => n + 1);
		this.updateHistoryState();
	}

	/**
	 * 現在のメモリ上のJotDocumentをMarkdownへシリアライズし、Vaultファイルへ一括上書き保存します。
	 * 部分置換ではなく全体上書きを行うことで行ズレやマーカー破損を防ぎます。
	 * 保存に成功したら、変更前の内容を1件の履歴として積みます（内容が変わらない場合は履歴にも積まず書き込みもしません）。
	 *
	 * @returns "saved"（保存した）／"failed"（書き込みに失敗した）／"unchanged"（内容が変わらず何もしなかった）
	 */
	private async save(): Promise<"saved" | "failed" | "unchanged"> {
		const after = serializeJotDocument(get(this.doc));
		if (after === this.currentText) return "unchanged";

		const before = this.currentText;
		if (await this.writeFile(after)) {
			this.history.record(before);
			this.currentText = after;
			this.updateHistoryState();
			return "saved";
		}
		return "failed";
	}

	/**
	 * ドキュメントを変更して保存し、成否を返します（ドラッグ＆ドロップの追加・削除用）。
	 * 書き込みに失敗した場合は、表示をファイルの内容（変更前）に戻します。
	 * 失敗した変更が表示に残ったまま次の操作で保存され、意図しない追加・削除が起きるのを防ぐためです。
	 *
	 * @param mutate ドキュメントを変更する関数（変更した場合は true を返す）
	 * @returns 変更を保存できた場合は true（変更対象がない場合・書き込みに失敗した場合は false）
	 */
	private async applyChange(mutate: (doc: JotDocument) => boolean): Promise<boolean> {
		let changed = false;
		this.doc.update((current) => {
			changed = mutate(current);
			return current;
		});
		if (!changed) return false;

		const result = await this.save();
		if (result === "failed") {
			this.doc.set(parseJotDocument(this.currentText));
			return false;
		}
		return true;
	}

	/**
	 * 指定したグループの指定位置に、本文ごとに新しいカードを追加して保存します。
	 *
	 * @param groupId 追加先のグループID
	 * @param index 追加位置（グループ内のインデックス）
	 * @param contents 追加するカードの本文
	 * @returns 保存できた場合は true
	 */
	async insertCards(groupId: string, index: number, contents: string[]): Promise<boolean> {
		return this.applyChange((doc) => insertCardsInDoc(doc, groupId, index, contents));
	}

	/**
	 * 指定したグループの直後に、新しいスレッドを追加して保存します。
	 *
	 * @param afterGroupId このグループの直後に追加する
	 * @param name スレッド名
	 * @param contents スレッドに含めるカードの本文
	 * @returns 保存できた場合は true
	 */
	async insertThreadAfter(afterGroupId: string, name: string, contents: string[]): Promise<boolean> {
		return this.applyChange((doc) => insertGroupAfterInDoc(doc, afterGroupId, name, contents));
	}

	/**
	 * 指定したカードを削除して保存します（通知は出しません）。
	 *
	 * @param cardIds 削除するカードIDのリスト
	 * @returns 保存できた場合は true（対象のカードがない場合は false）
	 */
	async removeCards(cardIds: string[]): Promise<boolean> {
		return this.applyChange((doc) => removeCardsFromDoc(doc, cardIds));
	}

	/**
	 * 指定したグループを所属カードごと削除して保存します。
	 *
	 * @param groupId 削除するグループID
	 * @returns 保存できた場合は true（対象のグループがない場合は false）
	 */
	async removeGroup(groupId: string): Promise<boolean> {
		return this.applyChange((doc) => deleteGroupDoc(doc, groupId));
	}

	/**
	 * 指定した内容をVaultファイルへ書き込みます。
	 *
	 * @returns 書き込みに成功した場合は true
	 */
	private async writeFile(content: string): Promise<boolean> {
		this.isSaving = true;
		try {
			await this.app.vault.modify(this.file, content);
			return true;
		} catch (e) {
			console.error("JotLine: Failed to save file", e);
			new Notice("JotLine: Failed to save file");
			return false;
		} finally {
			// 保存完了後、Vaultのmodifyイベントが発火し終えるまで少し待ってからフラグを解除（ループ抑止）
			setTimeout(() => {
				this.isSaving = false;
			}, 300);
		}
	}

	/**
	 * 直前の変更を取り消します（アンドゥ）。
	 *
	 * @returns 取り消しを実行できた場合は true
	 */
	async undo(): Promise<boolean> {
		return this.applyHistory("undo");
	}

	/**
	 * 取り消した変更をやり直します（リドゥ）。
	 *
	 * @returns やり直しを実行できた場合は true
	 */
	async redo(): Promise<boolean> {
		return this.applyHistory("redo");
	}

	/**
	 * 履歴から戻り先の内容を取り出してファイルへ書き込み、表示を置き換えます。
	 * 書き込みに失敗した場合は、取り出した履歴を元のスタックへ戻します。
	 */
	private async applyHistory(direction: "undo" | "redo"): Promise<boolean> {
		if (this.isApplying) return false;

		const current = this.currentText;
		const target = direction === "undo" ? this.history.undo(current) : this.history.redo(current);
		if (target === null) return false;

		this.isApplying = true;
		try {
			if (!(await this.writeFile(target))) {
				// 逆方向に1回動かすと、取り出す前のスタックの状態に戻る
				if (direction === "undo") {
					this.history.redo(target);
				} else {
					this.history.undo(target);
				}
				return false;
			}
			this.currentText = target;
			this.doc.set(parseJotDocument(target));
			this.replacedCount.update((n) => n + 1);
			return true;
		} finally {
			this.isApplying = false;
			this.updateHistoryState();
		}
	}

	/**
	 * アンドゥ／リドゥの可否をUI向けストアへ反映します。
	 */
	private updateHistoryState() {
		this.historyState.set({ canUndo: this.history.canUndo, canRedo: this.history.canRedo });
	}

	/**
	 * 新しいメモカードを追加します。
	 * 
	 * @param content カードの本文テキスト
	 * @param targetGroupId 追加先のグループID（省略時はドキュメント末尾の未分類グループに追加）
	 */
	async addCard(content: string, targetGroupId?: string) {
		const text = content.trim();
		if (!text) return;

		this.doc.update((current) => {
			let group: JotGroup | undefined;
			if (targetGroupId) {
				group = current.groups.find((g) => g.id === targetGroupId);
			} else {
				const lastGroup = current.groups.at(-1);
				group = lastGroup?.name === "" ? lastGroup : undefined;
			}

			if (!group) {
				group = {
					id: generateId(),
					name: targetGroupId ? generateGroupTimestamp() : "",
					cards: [],
				};
				current.groups.push(group);
			}

			group.cards.push({
				id: generateId(),
				content: text,
			});

			return current;
		});

		await this.save();
	}

	/**
	 * 指定したカードに対する「返信（スレッド化）」を行います。
	 * 
	 * - 親カードが未分類だった場合: 新規スレッドグループ（タイムスタンプ名）を作成し、親カードと返信カードをその中へ移動。
	 * - 親カードが既にスレッドに属していた場合: そのスレッドグループの末尾に返信カードを追加。
	 * 
	 * @param cardId 返信先の親カードID
	 * @param replyContent 返信メッセージ本文
	 */
	async replyToCard(cardId: string, replyContent: string) {
		const text = replyContent.trim();
		if (!text) return;

		this.doc.update((current) => {
			let parentGroupIndex = -1;
			let parentCardIndex = -1;

			// 親カードの位置を探索
			for (let g = 0; g < current.groups.length; g++) {
				const cIdx = current.groups[g].cards.findIndex((c) => c.id === cardId);
				if (cIdx !== -1) {
					parentGroupIndex = g;
					parentCardIndex = cIdx;
					break;
				}
			}

			if (parentGroupIndex === -1) return current;

			const parentGroup = current.groups[parentGroupIndex];
			const parentCard = parentGroup.cards[parentCardIndex];

			if (parentGroup.name === "") {
				// 未分類カードへの返信: 新規スレッドを生成して親カードごと移行
				parentGroup.cards.splice(parentCardIndex, 1);

				const newGroup: JotGroup = {
					id: generateId(),
					name: generateGroupTimestamp(),
					cards: [
						parentCard,
						{
							id: generateId(),
							content: text,
						},
					],
				};

				current.groups.push(newGroup);
			} else {
				// 既存スレッドへの返信: 同一スレッドの末尾へ追記
				parentGroup.cards.push({
					id: generateId(),
					content: text,
				});
			}

			return current;
		});

		await this.save();
	}

	/**
	 * 既存カードの本文テキストを更新して保存します。
	 * 
	 * @param cardId 更新対象のカードID
	 * @param newContent 新しい本文テキスト
	 */
	async updateCard(cardId: string, newContent: string) {
		this.doc.update((current) => {
			for (const group of current.groups) {
				const card = group.cards.find((c) => c.id === cardId);
				if (card) {
					card.content = newContent;
					break;
				}
			}
			return current;
		});

		await this.save();
	}

	/**
	 * 指定したカードをカーソル位置等の前後コンテンツで2枚に分割（Split）します。
	 * 
	 * @param cardId 分割元のカードID（beforeContent を保持）
	 * @param beforeContent 前半のテキスト（既存カードに残る）
	 * @param afterContent 後半のテキスト（直後に新規カードとして挿入）
	 */
	async splitCard(cardId: string, beforeContent: string, afterContent: string) {
		this.doc.update((current) => {
			for (const group of current.groups) {
				const idx = group.cards.findIndex((c) => c.id === cardId);
				if (idx !== -1) {
					group.cards[idx].content = beforeContent;
					group.cards.splice(idx + 1, 0, {
						id: generateId(),
						content: afterContent,
					});
					break;
				}
			}
			return current;
		});

		await this.save();
	}

	/**
	 * 指定したカードを削除します。
	 * もしカード削除によってスレッドグループ（名前付き）が空になった場合、スレッド自体も自動で削除します。
	 * 
	 * @param cardId 削除対象のカードID
	 */
	async deleteCard(cardId: string) {
		this.doc.update((current) => {
			for (let g = 0; g < current.groups.length; g++) {
				const idx = current.groups[g].cards.findIndex((c) => c.id === cardId);
				if (idx !== -1) {
					current.groups[g].cards.splice(idx, 1);
					// スレッドグループが空になった場合はグループごと削除
					if (current.groups[g].cards.length === 0 && current.groups[g].name !== "") {
						current.groups.splice(g, 1);
					}
					break;
				}
			}
			return current;
		});

		await this.save();
	}

	/**
	 * 指定カードを直前のカードと結合（Merge）します。
	 * 直前のカードの末尾に改行1つを挟んで結合します（詳細は `mergeCardWithPrevious` を参照）。
	 * 
	 * @param cardId 結合元のカードID
	 * @returns 結合できた場合は true
	 */
	async mergeWithPreviousCard(cardId: string): Promise<boolean> {
		let merged = false;
		this.doc.update((current) => {
			merged = mergeCardWithPrevious(current, cardId);
			return current;
		});

		if (merged) {
			await this.save();
			new Notice(t("NOTICE_MERGED"));
		} else {
			new Notice(t("NOTICE_NO_CARD_ABOVE"));
		}
		return merged;
	}

	/**
	 * 指定したグループを所属するカードごと削除します。
	 * 
	 * @param groupId 削除対象のグループID
	 */
	async deleteGroup(groupId: string) {
		let modified = false;
		this.doc.update((current) => {
			modified = deleteGroupDoc(current, groupId);
			return current;
		});

		if (modified) {
			await this.save();
		}
	}

	/**
	 * カードを同一グループ内で1つ上へ移動（位置を入れ替え）します。
	 * 
	 * @param cardId 移動対象のカードID
	 */
	async moveCardUp(cardId: string) {
		let moved = false;
		this.doc.update((current) => {
			moved = moveCardInDoc(current, cardId, "up");
			return current;
		});

		if (moved) {
			await this.save();
		}
	}

	/**
	 * カードを同一グループ内で1つ下へ移動（位置を入れ替え）します。
	 * 
	 * @param cardId 移動対象のカードID
	 */
	async moveCardDown(cardId: string) {
		let moved = false;
		this.doc.update((current) => {
			moved = moveCardInDoc(current, cardId, "down");
			return current;
		});

		if (moved) {
			await this.save();
		}
	}

	/**
	 * ドラッグ＆ドロップによるカードの並び替え・グループ間移動を実行します。
	 * 
	 * @param cardId 移動するカードID
	 * @param targetGroupId 移動先のグループID
	 * @param targetIndex 移動先グループ内での挿入インデックス位置
	 */
	async reorderCard(cardId: string, targetGroupId: string, targetIndex: number) {
		this.doc.update((current) => {
			let foundCard: JotCard | null = null;

			// 移動元グループからカードを取り出す
			for (let g = 0; g < current.groups.length; g++) {
				const idx = current.groups[g].cards.findIndex((c) => c.id === cardId);
				if (idx !== -1) {
					foundCard = current.groups[g].cards.splice(idx, 1)[0];
					// 移動元スレッドが空になった場合はグループ削除
					if (current.groups[g].cards.length === 0 && current.groups[g].name !== "") {
						current.groups.splice(g, 1);
					}
					break;
				}
			}

			if (!foundCard) return current;

			// 移動先グループへ挿入
			let targetGroup = current.groups.find((g) => g.id === targetGroupId);
			if (!targetGroup) {
				targetGroup = current.groups.find((g) => g.name === "");
			}

			if (targetGroup) {
				const clampedIdx = Math.max(0, Math.min(targetIndex, targetGroup.cards.length));
				targetGroup.cards.splice(clampedIdx, 0, foundCard);
			} else {
				current.groups.push({
					id: generateId(),
					name: "",
					cards: [foundCard],
				});
			}

			return current;
		});

		await this.save();
	}

	/**
	 * 指定したグループ内の全カードを純粋なMarkdownテキストとしてエクスポートします。
	 * 
	 * @param groupId グループID
	 * @returns マーカー除去済みのMarkdownテキスト
	 */
	exportGroup(groupId: string): string {
		const current = get(this.doc);
		const group = current.groups.find((g) => g.id === groupId);
		if (!group) return "";
		return exportToPureMarkdown(group.cards);
	}

	/**
	 * 指定した単一カードの本文を純粋なMarkdownテキストとしてエクスポートします。
	 * 
	 * @param cardId カードID
	 * @returns カードのトリム済み本文テキスト
	 */
	exportCard(cardId: string): string {
		const current = get(this.doc);
		for (const g of current.groups) {
			const card = g.cards.find((c) => c.id === cardId);
			if (card) return card.content.trim();
		}
		return "";
	}

	/**
	 * 複数選択されたカード群を新規スレッドグループへまとめます。
	 * 
	 * @param cardIds 選択カードIDリスト
	 * @param groupName 作成するグループ名（省略時はタイムスタンプ）
	 * @returns 処理が成功した場合は true
	 */
	async groupSelectedCards(cardIds: string[], groupName?: string): Promise<boolean> {
		let success = false;
		this.doc.update((current) => {
			success = groupSelectedCards(current, cardIds, groupName);
			return current;
		});

		if (success) {
			await this.save();
			new Notice(`Grouped ${cardIds.length} cards`);
		}
		return success;
	}

	/**
	 * 複数選択されたカードを一括削除します。
	 * 
	 * @param cardIds 削除対象のカードIDリスト
	 */
	async deleteMultipleCards(cardIds: string[]): Promise<void> {
		const idSet = new Set(cardIds);
		this.doc.update((current) => {
			for (let g = current.groups.length - 1; g >= 0; g--) {
				current.groups[g].cards = current.groups[g].cards.filter((c) => !idSet.has(c.id));
				if (current.groups[g].cards.length === 0 && current.groups[g].name !== "") {
					current.groups.splice(g, 1);
				}
			}
			if (current.groups.length === 0) {
				current.groups.push({ id: generateId(), name: "", cards: [] });
			}
			return current;
		});

		await this.save();
		new Notice(`Deleted ${cardIds.length} cards`);
	}

	/**
	 * 複数選択されたカード群をドキュメント上の順序を保ったまま結合し、純粋なMarkdownとしてエクスポートします。
	 * 
	 * @param cardIds 選択カードIDリスト
	 * @returns 結合されたMarkdownテキスト
	 */
	exportSelectedCards(cardIds: string[]): string {
		const idSet = new Set(cardIds);
		const current = get(this.doc);
		const cards: JotCard[] = [];
		for (const g of current.groups) {
			for (const c of g.cards) {
				if (idSet.has(c.id)) {
					cards.push(c);
				}
			}
		}
		return exportToPureMarkdown(cards);
	}

	/**
	 * 指定されたカード群を既存の名前付きグループの末尾へまとめて移動して保存します。
	 *
	 * @param cardIds 移動対象のカードIDリスト
	 * @param targetGroupId 移動先の名前付きグループID
	 * @returns 変更を保存できた場合は true
	 */
	async moveCardsToGroup(cardIds: string[], targetGroupId: string): Promise<boolean> {
		return this.applyChange((doc) => moveCardsToGroupInDoc(doc, cardIds, targetGroupId));
	}

	/**
	 * 選択されたカードのグループ所属を解除し、ファイル末尾の未分類グループへ移動して保存します。
	 * 
	 * @param cardIds 解除対象のカードIDリスト
	 * @returns 変更を保存できた場合は true
	 */
	async ungroupSelectedCards(cardIds: string[]): Promise<boolean> {
		const saved = await this.applyChange((doc) => ungroupCards(doc, cardIds));
		if (saved) {
			new Notice(`Ungrouped ${cardIds.length} card(s)`);
		}
		return saved;
	}

	/**
	 * 指定された名前付きグループをその場で解散し、未分類グループにして保存します。
	 *
	 * @param groupId 解散対象のグループID
	 * @returns 変更を保存できた場合は true
	 */
	async dissolveGroup(groupId: string): Promise<boolean> {
		return this.applyChange((doc) => dissolveGroupInDoc(doc, groupId));
	}

	/**
	 * 指定したスレッドグループの名前を変更します。
	 * 
	 * @param groupId グループID
	 * @param newName 新しいグループ名
	 * @returns リネームが成功した場合は true
	 */
	async renameGroup(groupId: string, newName: string): Promise<boolean> {
		let success = false;
		this.doc.update((current) => {
			success = renameGroup(current, groupId, newName);
			return current;
		});

		if (success) {
			await this.save();
			new Notice(`Group renamed to "${newName.trim()}"`);
		}
		return success;
	}
}
