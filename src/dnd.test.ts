/**
 * @file dnd.test.ts
 * @description ドラッグセッション・ドロップ位置プレビュー・修飾キーの判定（dnd.ts）の単体テスト（Vitest）。
 */

import { describe, it, expect, afterEach } from "vitest";
import { get } from "svelte/store";
import type { Editor } from "obsidian";
import type { JotStore } from "./store";
import {
	startDrag,
	endDrag,
	getDragSource,
	activeDragSource,
	dropPreview,
	getDropPreview,
	setDropPreview,
	clearDropPreview,
	getCardDropSlotIndex,
	resolveDropPreview,
	isCopyDrop,
	JOTLINE_DRAG_MIME,
	type DragSource,
} from "./dnd";

const storeA = { file: { path: "_jotline.md" } } as JotStore;
const storeASameFile = { file: { path: "_jotline.md" } } as JotStore;
const storeB = { file: { path: "other.md" } } as JotStore;

const cardsSource: DragSource = {
	kind: "cards",
	store: storeA,
	filePath: "_jotline.md",
	cardIds: ["c1", "c2"],
	draggedCardId: "c1",
	text: "A\n\nB",
	contents: ["A", "B"],
};

const threadSource: DragSource = {
	kind: "thread",
	store: storeA,
	filePath: "_jotline.md",
	groupId: "g1",
	name: "Topic",
	text: "A\n\nB",
	contents: ["A", "B"],
};

const editorSource: DragSource = {
	kind: "editor",
	editor: {} as Editor,
	filePath: "note.md",
	from: { line: 0, ch: 0 },
	to: { line: 0, ch: 5 },
	text: "Hello",
};

describe("drag session", () => {
	afterEach(() => {
		endDrag();
	});

	it("is empty when no drag has started", () => {
		expect(getDragSource()).toBeNull();
		expect(get(activeDragSource)).toBeNull();
		expect(getDropPreview()).toBeNull();
		expect(get(dropPreview)).toBeNull();
	});

	it("returns the started source until the drag ends and clears preview on start/end", () => {
		startDrag(cardsSource);
		expect(getDragSource()).toBe(cardsSource);
		expect(get(activeDragSource)).toBe(cardsSource);

		setDropPreview({ kind: "card", store: storeA, groupId: "g1", index: 1 });
		expect(getDropPreview()).toEqual({ kind: "card", store: storeA, groupId: "g1", index: 1 });
		expect(get(dropPreview)).toEqual({ kind: "card", store: storeA, groupId: "g1", index: 1 });

		endDrag();
		expect(getDragSource()).toBeNull();
		expect(get(activeDragSource)).toBeNull();
		expect(getDropPreview()).toBeNull();
		expect(get(dropPreview)).toBeNull();
	});

	it("overwrites the previous source and resets preview when a new drag starts", () => {
		startDrag(cardsSource);
		setDropPreview({ kind: "card", store: storeA, groupId: "g1", index: 0 });
		startDrag(editorSource);
		expect(getDragSource()).toBe(editorSource);
		expect(getDropPreview()).toBeNull();
	});

	it("supports filtered clearDropPreview without clearing another group or store preview", () => {
		setDropPreview({ kind: "card", store: storeA, groupId: "g2", index: 1 });

		clearDropPreview({ store: storeA, groupId: "g1" });
		expect(getDropPreview()).toEqual({ kind: "card", store: storeA, groupId: "g2", index: 1 });

		clearDropPreview({ store: storeB, groupId: "g2" });
		expect(getDropPreview()).toEqual({ kind: "card", store: storeA, groupId: "g2", index: 1 });

		clearDropPreview({ store: storeA, groupId: "g2" });
		expect(getDropPreview()).toBeNull();
	});
});

describe("getCardDropSlotIndex", () => {
	it("returns cardIndex for upper half and cardIndex + 1 for midpoint and lower half", () => {
		const rect = { top: 100, height: 80 }; // midpoint = 140
		expect(getCardDropSlotIndex(100, rect, 2)).toBe(2);
		expect(getCardDropSlotIndex(139.9, rect, 2)).toBe(2);
		expect(getCardDropSlotIndex(140, rect, 2)).toBe(3);
		expect(getCardDropSlotIndex(180, rect, 2)).toBe(3);
	});

	it("falls back to cardIndex when element height is 0 or negative", () => {
		expect(getCardDropSlotIndex(50, { top: 0, height: 0 }, 1)).toBe(1);
		expect(getCardDropSlotIndex(50, { top: 0, height: -10 }, 1)).toBe(1);
	});
});

describe("resolveDropPreview", () => {
	it("returns null when drag source is null", () => {
		expect(resolveDropPreview(null, storeA, "g1", 0)).toBeNull();
	});

	it("resolves card preview for same-view reorder and cross-file cards", () => {
		expect(resolveDropPreview(cardsSource, storeA, "g1", 2)).toEqual({
			kind: "card",
			store: storeA,
			groupId: "g1",
			index: 2,
		});
		expect(resolveDropPreview(cardsSource, storeB, "g9", 0)).toEqual({
			kind: "card",
			store: storeB,
			groupId: "g9",
			index: 0,
		});
	});

	it("returns null for same-file different-view cards or same-file editor drags", () => {
		expect(resolveDropPreview(cardsSource, storeASameFile, "g1", 0)).toBeNull();
		expect(
			resolveDropPreview(
				{ ...editorSource, filePath: "_jotline.md" },
				storeA,
				"g1",
				0,
			),
		).toBeNull();
	});

	it("resolves card preview for cross-file editor drag", () => {
		expect(resolveDropPreview(editorSource, storeA, "g1", 1)).toEqual({
			kind: "card",
			store: storeA,
			groupId: "g1",
			index: 1,
		});
	});

	it("resolves thread-after preview only for cross-file thread drag", () => {
		expect(resolveDropPreview(threadSource, storeA, "g2", 0)).toBeNull();
		expect(resolveDropPreview(threadSource, storeASameFile, "g2", 0)).toBeNull();
		expect(resolveDropPreview(threadSource, storeB, "g2", 0)).toEqual({
			kind: "thread-after",
			store: storeB,
			groupId: "g2",
		});
	});
});

describe("isCopyDrop", () => {
	it("uses Ctrl on Windows / Linux", () => {
		expect(isCopyDrop({ ctrlKey: true, altKey: false }, false)).toBe(true);
		expect(isCopyDrop({ ctrlKey: false, altKey: true }, false)).toBe(false);
		expect(isCopyDrop({ ctrlKey: false, altKey: false }, false)).toBe(false);
	});

	it("uses Option (altKey) on macOS", () => {
		expect(isCopyDrop({ ctrlKey: false, altKey: true }, true)).toBe(true);
		expect(isCopyDrop({ ctrlKey: true, altKey: false }, true)).toBe(false);
		expect(isCopyDrop({ ctrlKey: false, altKey: false }, true)).toBe(false);
	});
});

describe("JOTLINE_DRAG_MIME", () => {
	it("is a custom MIME type", () => {
		expect(JOTLINE_DRAG_MIME).toBe("application/x-jotline-drag");
	});
});
