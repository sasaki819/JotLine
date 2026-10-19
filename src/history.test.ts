/**
 * @file history.test.ts
 * @description アンドゥ／リドゥ用の操作履歴スタック（UndoHistory）の単体テスト（Vitest）。
 */

import { describe, it, expect } from "vitest";
import { UndoHistory, UNDO_HISTORY_LIMIT } from "./history";

describe("UndoHistory", () => {
	it("starts empty and returns null for undo / redo", () => {
		const history = new UndoHistory();
		expect(history.canUndo).toBe(false);
		expect(history.canRedo).toBe(false);
		expect(history.undo("current")).toBeNull();
		expect(history.redo("current")).toBeNull();
	});

	it("round-trips record -> undo -> redo", () => {
		const history = new UndoHistory();
		history.record("v1");
		expect(history.canUndo).toBe(true);
		expect(history.canRedo).toBe(false);

		// v2 の状態からアンドゥすると v1 に戻る
		expect(history.undo("v2")).toBe("v1");
		expect(history.canUndo).toBe(false);
		expect(history.canRedo).toBe(true);

		// v1 の状態からリドゥすると v2 に戻る
		expect(history.redo("v1")).toBe("v2");
		expect(history.canUndo).toBe(true);
		expect(history.canRedo).toBe(false);
	});

	it("undoes and redoes multiple steps in order", () => {
		const history = new UndoHistory();
		history.record("v1");
		history.record("v2");

		expect(history.undo("v3")).toBe("v2");
		expect(history.undo("v2")).toBe("v1");
		expect(history.undo("v1")).toBeNull();

		expect(history.redo("v1")).toBe("v2");
		expect(history.redo("v2")).toBe("v3");
		expect(history.redo("v3")).toBeNull();
	});

	it("discards redo history when a new change is recorded", () => {
		const history = new UndoHistory();
		history.record("v1");
		expect(history.undo("v2")).toBe("v1");
		expect(history.canRedo).toBe(true);

		history.record("v1");
		expect(history.canRedo).toBe(false);
		expect(history.redo("v3")).toBeNull();
		expect(history.undo("v3")).toBe("v1");
	});

	it("drops the oldest entries when exceeding the limit", () => {
		const history = new UndoHistory(3);
		for (const v of ["v1", "v2", "v3", "v4", "v5"]) {
			history.record(v);
		}

		expect(history.undo("v6")).toBe("v5");
		expect(history.undo("v5")).toBe("v4");
		expect(history.undo("v4")).toBe("v3");
		// v1, v2 は上限超過で破棄済み
		expect(history.undo("v3")).toBeNull();
	});

	it("keeps up to 100 entries by default", () => {
		expect(UNDO_HISTORY_LIMIT).toBe(100);

		const history = new UndoHistory();
		for (let i = 1; i <= UNDO_HISTORY_LIMIT + 1; i++) {
			history.record(`v${i}`);
		}

		let count = 0;
		let current = "latest";
		let target: string | null;
		while ((target = history.undo(current)) !== null) {
			count++;
			current = target;
		}
		expect(count).toBe(UNDO_HISTORY_LIMIT);
		// 最も古い v1 は破棄され、最後に戻れるのは v2
		expect(current).toBe("v2");
	});

	it("clears both stacks", () => {
		const history = new UndoHistory();
		history.record("v1");
		history.record("v2");
		history.undo("v3");
		history.clear();
		expect(history.canUndo).toBe(false);
		expect(history.canRedo).toBe(false);
	});
});
