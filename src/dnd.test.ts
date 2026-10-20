/**
 * @file dnd.test.ts
 * @description ドラッグセッションと修飾キーの判定（dnd.ts）の単体テスト（Vitest）。
 */

import { describe, it, expect, afterEach } from "vitest";
import type { Editor } from "obsidian";
import type { JotStore } from "./store";
import { startDrag, endDrag, getDragSource, isCopyDrop, JOTLINE_DRAG_MIME, type DragSource } from "./dnd";

const cardsSource: DragSource = {
	kind: "cards",
	store: {} as JotStore,
	filePath: "_jotline.md",
	cardIds: ["c1", "c2"],
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
	});

	it("returns the started source until the drag ends", () => {
		startDrag(cardsSource);
		expect(getDragSource()).toBe(cardsSource);
		endDrag();
		expect(getDragSource()).toBeNull();
	});

	it("overwrites the previous source when a new drag starts", () => {
		startDrag(cardsSource);
		startDrag(editorSource);
		expect(getDragSource()).toBe(editorSource);
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
