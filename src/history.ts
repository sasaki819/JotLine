/**
 * @file history.ts
 * @description JotLineのアンドゥ／リドゥ用の操作履歴スタック。
 *
 * 履歴の1件は「ファイル内容（Markdownテキスト全体）のスナップショット」です。
 * ObsidianやSvelteに依存しないため、単体テストで直接検証できます。
 */

/** 保持する履歴（アンドゥ側）の上限件数 */
export const UNDO_HISTORY_LIMIT = 100;

/**
 * アンドゥ／リドゥの2本のスタックを管理するクラス。
 *
 * - `record(before)`: 変更直前の内容を積む（リドゥ履歴は破棄）。
 * - `undo(current)` / `redo(current)`: 戻り先の内容を取り出し、現在の内容を反対側のスタックへ積む。
 */
export class UndoHistory {
	private undoStack: string[] = [];
	private redoStack: string[] = [];

	/**
	 * @param limit アンドゥ側に保持する上限件数（超えた分は古いものから破棄）
	 */
	constructor(private readonly limit = UNDO_HISTORY_LIMIT) {}

	/** アンドゥできる履歴があるかどうか */
	get canUndo(): boolean {
		return this.undoStack.length > 0;
	}

	/** リドゥできる履歴があるかどうか */
	get canRedo(): boolean {
		return this.redoStack.length > 0;
	}

	/**
	 * 変更直前の内容を履歴に積みます。
	 * 新しい変更が入ったため、リドゥ履歴は破棄します。
	 *
	 * @param before 変更直前のファイル内容
	 */
	record(before: string): void {
		this.undoStack.push(before);
		if (this.undoStack.length > this.limit) {
			this.undoStack.splice(0, this.undoStack.length - this.limit);
		}
		this.redoStack = [];
	}

	/**
	 * アンドゥの戻り先を取り出します。
	 *
	 * @param current 現在のファイル内容（リドゥ側へ積まれる）
	 * @returns 戻り先のファイル内容。履歴がなければ null
	 */
	undo(current: string): string | null {
		const target = this.undoStack.pop();
		if (target === undefined) return null;
		this.redoStack.push(current);
		return target;
	}

	/**
	 * リドゥの戻り先を取り出します。
	 *
	 * @param current 現在のファイル内容（アンドゥ側へ積まれる）
	 * @returns 戻り先のファイル内容。履歴がなければ null
	 */
	redo(current: string): string | null {
		const target = this.redoStack.pop();
		if (target === undefined) return null;
		this.undoStack.push(current);
		return target;
	}

	/** 履歴をすべて破棄します。 */
	clear(): void {
		this.undoStack = [];
		this.redoStack = [];
	}
}
