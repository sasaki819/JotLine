/**
 * @file store.test.ts
 * @description JotStore のアンドゥ／リドゥと外部変更の取り込みの単体テスト（Vitest）。
 *
 * `obsidian` パッケージは実行時コードを持たないため、vitest.config.mjs の alias で
 * src/__mocks__/obsidian.ts に差し替え、ファイル内容を文字列で保持する偽の Vault で JotStore を動かします。
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { get } from "svelte/store";
import type { App, TFile } from "obsidian";
import { __noticeTestState } from "./__mocks__/obsidian";
import { JotStore } from "./store";
import type { JotDocument } from "./types";

const FILE = { path: "_jotline.md" } as TFile;

/** 標準形（シリアライズ結果と一致する形）のサンプル */
const SAMPLE = `<!-- group -->
<!-- card -->
Card A

<!-- card -->
Card B

<!-- group: topic -->
<!-- card -->
Card C

<!-- card -->
Card D
`;

/**
 * ファイル内容を文字列で保持する偽の Vault。
 * `modify` は Obsidian と同じく modify イベントを発火する。
 */
function createFakeVault(initial: string) {
	let content = initial;
	let failNextModify = false;
	const listeners: Array<(file: TFile) => Promise<void> | void> = [];

	const vault = {
		read: vi.fn(async () => content),
		modify: vi.fn(async (_file: TFile, data: string) => {
			if (failNextModify) {
				failNextModify = false;
				throw new Error("write failed");
			}
			content = data;
			await Promise.all(listeners.map((l) => l(FILE)));
		}),
		on: vi.fn((_name: string, callback: (file: TFile) => Promise<void> | void) => {
			listeners.push(callback);
			return { callback };
		}),
		offref: vi.fn(),
	};

	return {
		app: { vault } as unknown as App,
		vault,
		getContent: () => content,
		failNextModify: () => {
			failNextModify = true;
		},
		/** 外部（標準エディタ等）からの書き込みを再現する */
		externalWrite: async (data: string) => {
			content = data;
			await Promise.all(listeners.map((l) => l(FILE)));
		},
	};
}

async function createStore(initial = SAMPLE) {
	const fake = createFakeVault(initial);
	const store = new JotStore(fake.app, FILE);
	await store.init();
	return { store, fake };
}

function docOf(store: JotStore): JotDocument {
	return get(store.doc);
}

/** 未分類グループとスレッド「topic」のカードIDを取得する */
function ids(store: JotStore) {
	const doc = docOf(store);
	const unclassified = doc.groups.find((g) => g.name === "")!;
	const topic = doc.groups.find((g) => g.name === "topic")!;
	return {
		a: unclassified.cards[0].id,
		b: unclassified.cards[1].id,
		c: topic.cards[0].id,
		d: topic.cards[1].id,
		topicId: topic.id,
	};
}

describe("JotStore addCard placement", () => {
	it("appends an unclassified card after existing groups and preserves their contents on reload", async () => {
		const { store, fake } = await createStore();
		const before = docOf(store).groups.map((group) => ({
			name: group.name,
			cards: group.cards.map((card) => card.content),
		}));

		await store.addCard("New card");

		expect(fake.getContent()).toBe(`${SAMPLE}\n<!-- group -->\n<!-- card -->\nNew card\n`);
		const expected = [...before, { name: "", cards: ["New card"] }];
		expect(docOf(store).groups.map((group) => ({
			name: group.name,
			cards: group.cards.map((card) => card.content),
		}))).toEqual(expected);

		const reloaded = await createStore(fake.getContent());
		expect(docOf(reloaded.store).groups.map((group) => ({
			name: group.name,
			cards: group.cards.map((card) => card.content),
		}))).toEqual(expected);
	});

	it("creates an unclassified group after a file containing only a named group", async () => {
		const initial = "<!-- group: topic -->\n<!-- card -->\nExisting\n";
		const { store, fake } = await createStore(initial);

		await store.addCard("New card");

		expect(fake.getContent()).toBe(`${initial}\n<!-- group -->\n<!-- card -->\nNew card\n`);
		expect(docOf(store).groups.map((group) => group.name)).toEqual(["topic", ""]);
	});

	it("reuses the final unclassified group for consecutive cards", async () => {
		const { store, fake } = await createStore(SAMPLE);

		await store.addCard("First");
		await store.addCard("Second");

		expect(docOf(store).groups.map((group) => group.name)).toEqual(["", "topic", ""]);
		expect(docOf(store).groups.at(-1)?.cards.map((card) => card.content)).toEqual(["First", "Second"]);
		expect(fake.getContent()).toBe(`${SAMPLE}\n<!-- group -->\n<!-- card -->\nFirst\n\n<!-- card -->\nSecond\n`);
	});

	it.each([
		["an unclassified group", "<!-- group -->\n<!-- card -->\nExisting\n", ["Existing", "New card"]],
		["an empty file", "", ["New card"]],
	])("appends to %s", async (_case, initial, expectedCards) => {
		const { store, fake } = await createStore(initial);

		await store.addCard("New card");

		expect(docOf(store).groups.map((group) => group.name)).toEqual([""]);
		expect(docOf(store).groups[0].cards.map((card) => card.content)).toEqual(expectedCards);
		const reloaded = await createStore(fake.getContent());
		expect(docOf(reloaded.store).groups[0].cards.map((card) => card.content)).toEqual(expectedCards);
	});

	it("still adds to a specified group", async () => {
		const { store } = await createStore();
		const targetGroupId = docOf(store).groups[0].id;

		await store.addCard("New card", targetGroupId);

		expect(docOf(store).groups.map((group) => group.name)).toEqual(["", "topic"]);
		expect(docOf(store).groups[0].cards.map((card) => card.content)).toEqual(["Card A", "Card B", "New card"]);
	});
});

describe("JotStore undo / redo", () => {
	beforeEach(() => {
		vi.useFakeTimers();
	});

	afterEach(() => {
		vi.useRealTimers();
	});

	const operations: Array<[string, (store: JotStore) => Promise<unknown>]> = [
		["addCard", (s) => s.addCard("New card")],
		["replyToCard", (s) => s.replyToCard(ids(s).a, "Reply")],
		["updateCard", (s) => s.updateCard(ids(s).a, "Card A edited")],
		["splitCard", (s) => s.splitCard(ids(s).a, "Card", " A")],
		["deleteCard", (s) => s.deleteCard(ids(s).b)],
		["mergeWithPreviousCard", (s) => s.mergeWithPreviousCard(ids(s).b)],
		["deleteGroup", (s) => s.deleteGroup(ids(s).topicId)],
		["moveCardUp", (s) => s.moveCardUp(ids(s).b)],
		["moveCardDown", (s) => s.moveCardDown(ids(s).a)],
		["reorderCard", (s) => s.reorderCard(ids(s).a, ids(s).topicId, 1)],
		["groupSelectedCards", (s) => s.groupSelectedCards([ids(s).a, ids(s).b], "grouped")],
		["moveCardsToGroup", (s) => s.moveCardsToGroup([ids(s).b, ids(s).a], ids(s).topicId)],
		["deleteMultipleCards", (s) => s.deleteMultipleCards([ids(s).a, ids(s).c])],
		["ungroupSelectedCards", (s) => s.ungroupSelectedCards([ids(s).c])],
		["dissolveGroup", (s) => s.dissolveGroup(ids(s).topicId)],
		["renameGroup", (s) => s.renameGroup(ids(s).topicId, "renamed")],
	];

	it.each(operations)("undoes and redoes %s", async (_name, operate) => {
		const { store, fake } = await createStore();
		const before = fake.getContent();

		await operate(store);
		const after = fake.getContent();
		expect(after).not.toBe(before);
		expect(get(store.historyState)).toEqual({ canUndo: true, canRedo: false });

		expect(await store.undo()).toBe(true);
		expect(fake.getContent()).toBe(before);
		expect(get(store.historyState)).toEqual({ canUndo: false, canRedo: true });

		expect(await store.redo()).toBe(true);
		expect(fake.getContent()).toBe(after);
		expect(get(store.historyState)).toEqual({ canUndo: true, canRedo: false });
	});

	it("restores the original text of a note without markers", async () => {
		const raw = "# Meeting notes\n\n- item 1\n- item 2\n";
		const { store, fake } = await createStore(raw);

		await store.addCard("New card");
		expect(fake.getContent()).not.toBe(raw);

		await store.undo();
		expect(fake.getContent()).toBe(raw);
	});

	it("undoes multiple operations in reverse order", async () => {
		const { store, fake } = await createStore();
		const v0 = fake.getContent();
		await store.addCard("first");
		const v1 = fake.getContent();
		await store.addCard("second");

		await store.undo();
		expect(fake.getContent()).toBe(v1);
		await store.undo();
		expect(fake.getContent()).toBe(v0);
		expect(await store.undo()).toBe(false);
	});

	it("discards redo history after a new operation", async () => {
		const { store } = await createStore();
		await store.addCard("first");
		await store.undo();
		expect(get(store.historyState).canRedo).toBe(true);

		await store.addCard("second");
		expect(get(store.historyState).canRedo).toBe(false);
		expect(await store.redo()).toBe(false);
	});

	it("does not record history or write when the content does not change", async () => {
		const { store, fake } = await createStore();
		// 先頭カードは上へ移動できない
		await store.moveCardUp(ids(store).a);

		expect(fake.vault.modify).not.toHaveBeenCalled();
		expect(get(store.historyState)).toEqual({ canUndo: false, canRedo: false });
	});

	it("records an external change as one history entry", async () => {
		const { store, fake } = await createStore();
		const external = "<!-- group -->\n<!-- card -->\nEdited in the editor\n";

		await fake.externalWrite(external);
		expect(docOf(store).groups[0].cards[0].content).toBe("Edited in the editor");
		expect(get(store.historyState)).toEqual({ canUndo: true, canRedo: false });

		await store.undo();
		expect(fake.getContent()).toBe(SAMPLE);

		await store.redo();
		expect(fake.getContent()).toBe(external);
	});

	it("discards redo history when an external change is detected", async () => {
		const { store, fake } = await createStore();
		await store.addCard("first");
		await store.undo();
		expect(get(store.historyState).canRedo).toBe(true);

		// 自己保存の直後300msは外部変更として扱われないため、時間を進める
		vi.advanceTimersByTime(300);
		await fake.externalWrite("external");
		expect(get(store.historyState).canRedo).toBe(false);
	});

	it("ignores a modify event whose content equals the current content", async () => {
		const { store, fake } = await createStore();
		await fake.externalWrite(SAMPLE);

		expect(get(store.historyState).canUndo).toBe(false);
		expect(get(store.replacedCount)).toBe(0);
	});

	it("increments replacedCount on undo, redo and external change only", async () => {
		const { store, fake } = await createStore();
		await store.addCard("first");
		expect(get(store.replacedCount)).toBe(0);

		await store.undo();
		expect(get(store.replacedCount)).toBe(1);
		await store.redo();
		expect(get(store.replacedCount)).toBe(2);

		vi.advanceTimersByTime(300);
		await fake.externalWrite("external");
		expect(get(store.replacedCount)).toBe(3);
	});

	it("keeps the history intact when writing an undo fails", async () => {
		const { store, fake } = await createStore();
		await store.addCard("first");
		const after = fake.getContent();

		fake.failNextModify();
		expect(await store.undo()).toBe(false);
		expect(fake.getContent()).toBe(after);
		expect(get(store.historyState)).toEqual({ canUndo: true, canRedo: false });
		expect(get(store.replacedCount)).toBe(0);

		// 失敗後も、改めてアンドゥできる
		expect(await store.undo()).toBe(true);
		expect(fake.getContent()).toBe(SAMPLE);
	});

	it("does not record history when saving an operation fails", async () => {
		const { store, fake } = await createStore();
		fake.failNextModify();
		await store.addCard("first");

		expect(fake.getContent()).toBe(SAMPLE);
		expect(get(store.historyState).canUndo).toBe(false);
	});
});

describe("JotStore insert / remove for drag and drop", () => {
	beforeEach(() => {
		vi.useFakeTimers();
	});

	afterEach(() => {
		vi.useRealTimers();
	});

	it("inserts cards at a position as one undoable step", async () => {
		const { store, fake } = await createStore();
		const before = fake.getContent();
		const { topicId } = ids(store);

		expect(await store.insertCards(topicId, 1, ["Dropped 1", "Dropped 2"])).toBe(true);
		const topic = docOf(store).groups.find((g) => g.name === "topic")!;
		expect(topic.cards.map((c) => c.content)).toEqual(["Card C", "Dropped 1", "Dropped 2", "Card D"]);

		await store.undo();
		expect(fake.getContent()).toBe(before);
		expect(get(store.historyState).canUndo).toBe(false);
	});

	it("inserts a thread after a group as one undoable step", async () => {
		const { store, fake } = await createStore();
		const before = fake.getContent();
		const unclassifiedId = docOf(store).groups[0].id;

		expect(await store.insertThreadAfter(unclassifiedId, "moved", ["E", "F"])).toBe(true);
		expect(docOf(store).groups.map((g) => g.name)).toEqual(["", "moved", "topic"]);
		expect(fake.getContent()).toContain("<!-- group: moved -->");

		await store.undo();
		expect(fake.getContent()).toBe(before);
	});

	it("removes cards as one undoable step", async () => {
		const { store, fake } = await createStore();
		const before = fake.getContent();
		const { a, c, d } = ids(store);

		expect(await store.removeCards([a, c, d])).toBe(true);
		// スレッド topic は空になったため削除される
		expect(docOf(store).groups.map((g) => g.name)).toEqual([""]);
		expect(docOf(store).groups[0].cards.map((card) => card.content)).toEqual(["Card B"]);

		await store.undo();
		expect(fake.getContent()).toBe(before);
	});

	it("removes a group as one undoable step", async () => {
		const { store, fake } = await createStore();
		const before = fake.getContent();

		expect(await store.removeGroup(ids(store).topicId)).toBe(true);
		expect(fake.getContent()).not.toContain("topic");

		await store.undo();
		expect(fake.getContent()).toBe(before);
	});

	it("returns false without writing when the target does not exist", async () => {
		const { store, fake } = await createStore();

		expect(await store.insertCards("missing", 0, ["x"])).toBe(false);
		expect(await store.insertThreadAfter("missing", "x", ["x"])).toBe(false);
		expect(await store.removeCards(["missing"])).toBe(false);
		expect(await store.removeGroup("missing")).toBe(false);
		expect(fake.vault.modify).not.toHaveBeenCalled();
		expect(get(store.historyState).canUndo).toBe(false);
	});

	it("returns false and restores the view when writing fails", async () => {
		const { store, fake } = await createStore();
		const { topicId } = ids(store);

		fake.failNextModify();
		expect(await store.insertCards(topicId, 0, ["x"])).toBe(false);
		expect(fake.getContent()).toBe(SAMPLE);
		expect(get(store.historyState).canUndo).toBe(false);
		// 失敗した追加が表示に残らない
		expect(docOf(store).groups.flatMap((g) => g.cards).map((c) => c.content)).toEqual([
			"Card A",
			"Card B",
			"Card C",
			"Card D",
		]);

		fake.failNextModify();
		expect(await store.removeCards([ids(store).a])).toBe(false);
		expect(fake.getContent()).toBe(SAMPLE);
		// 失敗した削除が表示に残らない
		expect(docOf(store).groups[0].cards.map((c) => c.content)).toEqual(["Card A", "Card B"]);
	});
});

describe("JotStore card move, ungroup and thread dissolve", () => {
	beforeEach(() => {
		vi.useFakeTimers();
		__noticeTestState.reset();
	});

	afterEach(() => {
		vi.useRealTimers();
	});

	it("moves multiple cards in one save, reloads with the same order, and undoes/redoes in one step", async () => {
		const { store, fake } = await createStore();
		const before = fake.getContent();
		const { b, c, topicId } = ids(store);

		expect(await store.moveCardsToGroup([c, b], topicId)).toBe(true);
		expect(fake.vault.modify).toHaveBeenCalledTimes(1);

		const expected = [
			{ name: "", cards: ["Card A"] },
			{ name: "topic", cards: ["Card D", "Card B", "Card C"] },
		];
		expect(docOf(store).groups.map((g) => ({ name: g.name, cards: g.cards.map((card) => card.content) }))).toEqual(expected);

		const reloaded = await createStore(fake.getContent());
		expect(docOf(reloaded.store).groups.map((g) => ({ name: g.name, cards: g.cards.map((card) => card.content) }))).toEqual(expected);

		expect(await store.undo()).toBe(true);
		expect(fake.getContent()).toBe(before);
		expect(await store.redo()).toBe(true);
		expect(docOf(store).groups.map((g) => ({ name: g.name, cards: g.cards.map((card) => card.content) }))).toEqual(expected);
	});

	it("ungroups cards to the tail unclassified group, persists on reload, and undoes/redoes in one step", async () => {
		const { store, fake } = await createStore();
		const before = fake.getContent();
		const { d, c } = ids(store);

		expect(await store.ungroupSelectedCards([d, c])).toBe(true);
		expect(fake.vault.modify).toHaveBeenCalledTimes(1);

		const expected = [
			{ name: "", cards: ["Card A", "Card B"] },
			{ name: "", cards: ["Card C", "Card D"] },
		];
		expect(docOf(store).groups.map((g) => ({ name: g.name, cards: g.cards.map((card) => card.content) }))).toEqual(expected);

		const reloaded = await createStore(fake.getContent());
		expect(docOf(reloaded.store).groups.map((g) => ({ name: g.name, cards: g.cards.map((card) => card.content) }))).toEqual(expected);

		expect(await store.undo()).toBe(true);
		expect(fake.getContent()).toBe(before);
		expect(await store.redo()).toBe(true);
		expect(docOf(store).groups.map((g) => ({ name: g.name, cards: g.cards.map((card) => card.content) }))).toEqual(expected);
	});

	it("dissolves a middle thread group in place, persists on reload, and undoes/redoes in one step", async () => {
		const initial = `<!-- group -->
<!-- card -->
Card A

<!-- group: mid -->
<!-- card -->
Card B

<!-- card -->
Card C

<!-- group: last -->
<!-- card -->
Card D
`;
		const { store, fake } = await createStore(initial);
		const midId = docOf(store).groups[1].id;

		expect(await store.dissolveGroup(midId)).toBe(true);
		expect(fake.vault.modify).toHaveBeenCalledTimes(1);

		const expected = [
			{ name: "", cards: ["Card A"] },
			{ name: "", cards: ["Card B", "Card C"] },
			{ name: "last", cards: ["Card D"] },
		];
		expect(docOf(store).groups.map((g) => ({ name: g.name, cards: g.cards.map((card) => card.content) }))).toEqual(expected);

		const reloaded = await createStore(fake.getContent());
		expect(docOf(reloaded.store).groups.map((g) => ({ name: g.name, cards: g.cards.map((card) => card.content) }))).toEqual(expected);

		expect(await store.undo()).toBe(true);
		expect(fake.getContent()).toBe(initial);
		expect(await store.redo()).toBe(true);
		expect(docOf(store).groups.map((g) => ({ name: g.name, cards: g.cards.map((card) => card.content) }))).toEqual(expected);
	});

	it("does not save or record history when IDs are invalid or order is unchanged", async () => {
		const { store, fake } = await createStore();
		const { a, c, d, topicId } = ids(store);
		const unclassifiedId = docOf(store).groups[0].id;

		expect(await store.moveCardsToGroup([], topicId)).toBe(false);
		expect(await store.moveCardsToGroup(["missing"], topicId)).toBe(false);
		expect(await store.moveCardsToGroup([a], "missing")).toBe(false);
		expect(await store.moveCardsToGroup([a], unclassifiedId)).toBe(false);
		expect(await store.moveCardsToGroup([c, d], topicId)).toBe(false);
		expect(await store.ungroupSelectedCards(["missing"])).toBe(false);
		expect(await store.dissolveGroup("missing")).toBe(false);
		expect(await store.dissolveGroup(unclassifiedId)).toBe(false);

		expect(fake.vault.modify).not.toHaveBeenCalled();
		expect(get(store.historyState)).toEqual({ canUndo: false, canRedo: false });
	});

	it("returns false and restores the document when writing fails", async () => {
		const { store, fake } = await createStore();
		const { a, c, topicId } = ids(store);
		const snapshot = () =>
			docOf(store).groups.map((g) => ({ name: g.name, cards: g.cards.map((card) => card.content) }));

		fake.failNextModify();
		expect(await store.moveCardsToGroup([a], topicId)).toBe(false);
		expect(fake.getContent()).toBe(SAMPLE);
		expect(get(store.historyState).canUndo).toBe(false);
		expect(snapshot()).toEqual([
			{ name: "", cards: ["Card A", "Card B"] },
			{ name: "topic", cards: ["Card C", "Card D"] },
		]);

		fake.failNextModify();
		expect(await store.ungroupSelectedCards([c])).toBe(false);
		expect(fake.getContent()).toBe(SAMPLE);
		expect(get(store.historyState).canUndo).toBe(false);
		expect(snapshot()).toEqual([
			{ name: "", cards: ["Card A", "Card B"] },
			{ name: "topic", cards: ["Card C", "Card D"] },
		]);

		fake.failNextModify();
		expect(await store.dissolveGroup(topicId)).toBe(false);
		expect(fake.getContent()).toBe(SAMPLE);
		expect(get(store.historyState).canUndo).toBe(false);
		expect(snapshot()).toEqual([
			{ name: "", cards: ["Card A", "Card B"] },
			{ name: "topic", cards: ["Card C", "Card D"] },
		]);
		expect(__noticeTestState.messages.filter((m) => String(m).startsWith("Ungrouped"))).toEqual([]);
	});

	it("does not save, record history, or show a success Notice when serialized markdown is unchanged", async () => {
		const { store, fake } = await createStore();
		const { a, b, c, d, topicId } = ids(store);

		// 末尾の名前付きグループを解散して全カードを削除すると、メモリ末尾だけ空の未分類グループが残る
		expect(await store.dissolveGroup(topicId)).toBe(true);
		expect(await store.removeCards([c, d])).toBe(true);
		expect(docOf(store).groups).toHaveLength(2);
		expect(docOf(store).groups[1].cards).toEqual([]);

		const savedTextBefore = fake.getContent();
		fake.vault.modify.mockClear();
		__noticeTestState.reset();

		expect(await store.ungroupSelectedCards([a, b])).toBe(false);
		expect(fake.vault.modify).not.toHaveBeenCalled();
		expect(fake.getContent()).toBe(savedTextBefore);
		expect(__noticeTestState.messages).toEqual([]);
		expect(docOf(store).groups.map((g) => ({ name: g.name, cards: g.cards.map((card) => card.content) }))).toEqual([
			{ name: "", cards: ["Card A", "Card B"] },
		]);

		// ungroup の履歴が積まれていないため、直後の undo は removeCards を取り消す
		expect(await store.undo()).toBe(true);
		expect(fake.getContent()).toContain("Card C");
	});

	it("shows an Ungrouped Notice only when ungroupSelectedCards saves a change", async () => {
		const { store } = await createStore();
		const { c } = ids(store);

		__noticeTestState.reset();
		expect(await store.ungroupSelectedCards([c])).toBe(true);
		expect(__noticeTestState.messages).toEqual(["Ungrouped 1 card(s)"]);
	});
});
