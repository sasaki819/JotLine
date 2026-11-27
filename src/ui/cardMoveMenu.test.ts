import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Menu as ObsidianMenu } from "obsidian";
import { Menu, __menuTestState, type MockMenuEntry } from "../__mocks__/obsidian";
import type { JotGroup } from "../types";
import { addCardMoveMenu } from "./cardMoveMenu";

function setTestLanguage(lang: string) {
	vi.stubGlobal("window", {
		moment: {
			locale: () => lang,
		},
	});
}

function entrySummary(entries: MockMenuEntry[]) {
	return entries.map((entry) => (entry.kind === "separator" ? "---" : entry.item.title));
}

function itemEntries(menu: Menu) {
	return menu.entries.flatMap((entry) => (entry.kind === "item" ? [entry.item] : []));
}

describe("addCardMoveMenu", () => {
	const groups: JotGroup[] = [
		{ id: "g-unclassified-top", name: "", cards: [{ id: "c1", content: "U1" }] },
		{ id: "g-first", name: "Alpha", cards: [{ id: "c2", content: "A1" }] },
		{ id: "g-dup-1", name: "Same", cards: [{ id: "c3", content: "S1" }] },
		{ id: "g-unclassified-mid", name: "", cards: [{ id: "c4", content: "U2" }] },
		{ id: "g-dup-2", name: "Same", cards: [{ id: "c5", content: "S2" }] },
		{ id: "g-html", name: "<b>Raw & HTML</b>", cards: [{ id: "c6", content: "H1" }] },
	];

	beforeEach(() => {
		__menuTestState.reset();
		setTestLanguage("en");
	});

	afterEach(() => {
		vi.unstubAllGlobals();
		vi.restoreAllMocks();
	});

	it("lists named groups in display order including duplicates and current group, followed by separator and Ungroup (submenu supported)", async () => {
		const menu = new Menu();
		const onMoveToGroup = vi.fn();
		const onUngroup = vi.fn();
		const event = { clientX: 100, clientY: 200 } as MouseEvent;
		const sourceIds = ["c2", "c5"];

		addCardMoveMenu(menu as unknown as ObsidianMenu, groups, sourceIds, { onMoveToGroup, onUngroup }, event);
		// メニュー構築後に元配列が変わっても保持した対象IDに影響しない
		sourceIds.push("c1");

		const parentItems = itemEntries(menu);
		expect(parentItems).toHaveLength(1);
		expect(parentItems[0].title).toBe("Send to group");
		expect(parentItems[0].clickHandler).toBeNull();
		expect(parentItems[0].submenu).not.toBeNull();

		const submenu = parentItems[0].submenu!;
		expect(entrySummary(submenu.entries)).toEqual([
			"Alpha",
			"Same",
			"Same",
			"<b>Raw & HTML</b>",
			"---",
			"Ungroup",
		]);
		// メニューを開いて閉じただけではコールバックを呼ばない
		expect(onMoveToGroup).not.toHaveBeenCalled();
		expect(onUngroup).not.toHaveBeenCalled();

		const subItems = itemEntries(submenu);
		// 同名グループの2番目を選択すると、対応するIDが渡される
		await subItems[2].triggerClick();
		expect(onMoveToGroup).toHaveBeenCalledWith(["c2", "c5"], "g-dup-2");

		// 現在所属しているグループ（Alpha）も選択できる
		await subItems[0].triggerClick();
		expect(onMoveToGroup).toHaveBeenCalledWith(["c2", "c5"], "g-first");

		// グループ解除を選択できる
		await subItems[4].triggerClick();
		expect(onUngroup).toHaveBeenCalledWith(["c2", "c5"]);
	});

	it("uses Japanese labels when locale is ja", () => {
		setTestLanguage("ja");
		const menu = new Menu();
		const event = {} as MouseEvent;

		addCardMoveMenu(
			menu as unknown as ObsidianMenu,
			groups,
			["c1"],
			{ onMoveToGroup: vi.fn(), onUngroup: vi.fn() },
			event
		);

		const parentItem = itemEntries(menu)[0];
		expect(parentItem.title).toBe("グループへ移動");
		expect(entrySummary(parentItem.submenu!.entries)).toEqual([
			"Alpha",
			"Same",
			"Same",
			"<b>Raw & HTML</b>",
			"---",
			"グループ解除",
		]);
	});

	it("omits the leading separator and shows only Ungroup when there are no named groups", async () => {
		const menu = new Menu();
		const onMoveToGroup = vi.fn();
		const onUngroup = vi.fn();
		const unclassifiedOnly: JotGroup[] = [
			{ id: "g-u", name: "", cards: [{ id: "c1", content: "Only" }] },
		];

		addCardMoveMenu(
			menu as unknown as ObsidianMenu,
			unclassifiedOnly,
			["c1"],
			{ onMoveToGroup, onUngroup },
			{} as MouseEvent
		);

		const submenu = itemEntries(menu)[0].submenu!;
		expect(entrySummary(submenu.entries)).toEqual(["Ungroup"]);
		await itemEntries(submenu)[0].triggerClick();
		expect(onUngroup).toHaveBeenCalledWith(["c1"]);
		expect(onMoveToGroup).not.toHaveBeenCalled();
	});

	it("opens a child menu at the original MouseEvent when setSubmenu is unavailable", async () => {
		__menuTestState.submenuSupported = false;
		const menu = new Menu();
		const onMoveToGroup = vi.fn();
		const onUngroup = vi.fn();
		const event = { clientX: 42, clientY: 84 } as MouseEvent;

		addCardMoveMenu(menu as unknown as ObsidianMenu, groups, ["c1", "c3"], { onMoveToGroup, onUngroup }, event);

		const parentItem = itemEntries(menu)[0];
		expect(parentItem.title).toBe("Send to group");
		expect(parentItem.submenu).toBeNull();
		expect(parentItem.clickHandler).not.toBeNull();

		// 親項目クリック前は子メニューを作らず、データ操作もしない
		expect(__menuTestState.instances).toHaveLength(1);
		expect(onMoveToGroup).not.toHaveBeenCalled();

		// 親項目クリックで親を閉じて子メニューを元の位置へ開く
		await parentItem.triggerClick();
		expect(menu.hidden).toBe(true);
		expect(__menuTestState.instances).toHaveLength(2);
		const childMenu = __menuTestState.instances[1];
		expect(childMenu.shownEvents).toEqual([event]);
		expect(entrySummary(childMenu.entries)).toEqual([
			"Alpha",
			"Same",
			"Same",
			"<b>Raw & HTML</b>",
			"---",
			"Ungroup",
		]);
		// 子メニューを開いただけでは移動しない
		expect(onMoveToGroup).not.toHaveBeenCalled();
		expect(onUngroup).not.toHaveBeenCalled();

		// 子メニューの項目を選んだときだけ移動・解除される
		const childItems = itemEntries(childMenu);
		await childItems[1].triggerClick();
		expect(onMoveToGroup).toHaveBeenCalledWith(["c1", "c3"], "g-dup-1");

		await childItems[4].triggerClick();
		expect(onUngroup).toHaveBeenCalledWith(["c1", "c3"]);
	});

	it("falls back to opening a child menu without mutating data when setSubmenu throws, and handles child show failure safely", async () => {
		const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
		__menuTestState.submenuSupported = true;
		__menuTestState.throwOnSubmenu = true;

		const menu = new Menu();
		const onMoveToGroup = vi.fn();
		const onUngroup = vi.fn();
		const event = { clientX: 10, clientY: 20 } as MouseEvent;

		addCardMoveMenu(menu as unknown as ObsidianMenu, groups, ["c1"], { onMoveToGroup, onUngroup }, event);
		expect(errorSpy).toHaveBeenCalledTimes(1);
		expect(onMoveToGroup).not.toHaveBeenCalled();

		// フォールバック経路が動くこと、さらに表示失敗しても例外が漏れずデータ操作しないこと
		__menuTestState.throwOnShow = true;
		const parentItem = itemEntries(menu)[0];
		await expect(parentItem.triggerClick()).resolves.toBeUndefined();
		expect(errorSpy).toHaveBeenCalledTimes(2);
		expect(onMoveToGroup).not.toHaveBeenCalled();
		expect(onUngroup).not.toHaveBeenCalled();
	});

	it("adds nothing when cardIds is empty", () => {
		const menu = new Menu();
		addCardMoveMenu(
			menu as unknown as ObsidianMenu,
			groups,
			[],
			{ onMoveToGroup: vi.fn(), onUngroup: vi.fn() },
			{} as MouseEvent
		);
		expect(menu.entries).toHaveLength(0);
	});
});
