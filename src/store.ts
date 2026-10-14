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
	ungroupCards,
	renameGroup,
	deleteGroupDoc,
	moveCardInDoc,
} from "./parser";
import { t } from "./i18n";


/**
 * JotLine の状態管理およびファイル永続化を担当するストアクラス。
 * 
 * 【主な責務】:
 * 1. Svelte の Writable ストア（`doc`）を保持し、UIへのリアクティブな状態変更を通知。
 * 2. 対象 Markdown ファイル（`TFile`）の読み込み（`load`）および安全な一括保存（`save`）。
 * 3. Obsidian Vault の `modify` イベントを監視し、外部編集（他ペインや別アプリ同期）を自動検知して再描画。
 * 4. 自プラグイン保存時の更新検知ループ防止（`isSaving` フラグとデバウンス制御）。
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
		await this.load();

		// ファイル変更イベントを監視（他ペインや別デバイスからの変更を即座にUIへ反映）
		this.modifyEventRef = this.app.vault.on("modify", async (modifiedFile) => {
			if (modifiedFile.path === this.file.path && !this.isSaving) {
				await this.load();
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
	 * 対象Markdownファイルから最新コンテンツを読み込み、パースしてストアを更新します。
	 */
	async load() {
		try {
			const content = await this.app.vault.read(this.file);
			const parsed = parseJotDocument(content);
			this.doc.set(parsed);
		} catch (e) {
			console.error("JotLine: Failed to load file", e);
			new Notice("JotLine: Failed to read file");
		}
	}

	/**
	 * 現在のメモリ上のJotDocumentをMarkdownへシリアライズし、Vaultファイルへ一括上書き保存します。
	 * 部分置換ではなく全体上書きを行うことで行ズレやマーカー破損を防ぎます。
	 */
	async save() {
		const currentDoc = get(this.doc);
		const serialized = serializeJotDocument(currentDoc);

		this.isSaving = true;
		try {
			await this.app.vault.modify(this.file, serialized);
		} catch (e) {
			console.error("JotLine: Failed to save file", e);
			new Notice("JotLine: Failed to save file");
		} finally {
			// 保存完了後、Vaultのmodifyイベントが発火し終えるまで少し待ってからフラグを解除（ループ抑止）
			setTimeout(() => {
				this.isSaving = false;
			}, 300);
		}
	}

	/**
	 * 新しいメモカードを追加します。
	 * 
	 * @param content カードの本文テキスト
	 * @param targetGroupId 追加先のグループID（省略時は未分類グループに追加）
	 */
	async addCard(content: string, targetGroupId?: string) {
		const text = content.trim();
		if (!text) return;

		this.doc.update((current) => {
			let group = targetGroupId
				? current.groups.find((g) => g.id === targetGroupId)
				: current.groups.find((g) => g.name === "");

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
	 * 選択されたカードのグループ所属を解除（未分類グループへ戻す）します。
	 * 
	 * @param cardIds 解除対象のカードIDリスト
	 * @returns 処理が成功した場合は true
	 */
	async ungroupSelectedCards(cardIds: string[]): Promise<boolean> {
		let success = false;
		this.doc.update((current) => {
			success = ungroupCards(current, cardIds);
			return current;
		});

		if (success) {
			await this.save();
			new Notice(`Ungrouped ${cardIds.length} card(s)`);
		}
		return success;
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
