import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { build } from "esbuild";
import sveltePlugin from "esbuild-svelte";
import sveltePreprocess from "svelte-preprocess";
import { JSDOM } from "jsdom";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

const INITIAL_DOC = `<!-- group -->
<!-- card -->
U1

<!-- card -->
U2

<!-- group: Alpha -->
<!-- card -->
A1

<!-- card -->
A2

<!-- group: Beta -->
<!-- card -->
B1
`;

describe("App card context menu - Send to group and Ungroup", () => {
	let directory, dom, App, JotStore, tick, get, menuState, component, vault, store;

	beforeAll(async () => {
		directory = await mkdtemp(join(tmpdir(), "jotline-context-menu-test-"));
		const output = join(directory, "app.cjs");
		await build({
			stdin: {
				contents:
					'export {default as App} from "./src/ui/App.svelte"; export {JotStore} from "./src/store.ts"; export {tick} from "svelte"; export {get} from "svelte/store"; export {__menuTestState as menuState} from "obsidian";',
				resolveDir: fileURLToPath(new URL("../", import.meta.url)),
				loader: "ts",
			},
			bundle: true,
			platform: "browser",
			format: "cjs",
			outfile: output,
			mainFields: ["svelte", "browser", "module", "main"],
			logLevel: "silent",
			plugins: [
				{
					name: "obsidian-test",
					setup(builder) {
						builder.onResolve({ filter: /^obsidian$/ }, () => ({ path: "obsidian", namespace: "mock" }));
						builder.onLoad({ filter: /.*/, namespace: "mock" }, () => ({
							contents: `
export class Notice {}
export class Component {
	load() {}
	unload() {}
}
export const Platform = { isMacOS: false };
export const MarkdownRenderer = {
	async render(_app, markdown, el) {
		el.textContent = markdown;
	},
};
export function setIcon(el, name) {
	el.dataset.icon = name;
}
export const __menuTestState = {
	submenuSupported: true,
	instances: [],
	reset() {
		this.submenuSupported = true;
		this.instances = [];
	},
};
class MockMenuItem {
	constructor(enableSubmenu) {
		this.title = "";
		this.icon = null;
		this.clickHandler = null;
		this.submenu = null;
		if (enableSubmenu) {
			this.setSubmenu = () => {
				const sub = new Menu();
				this.submenu = sub;
				return sub;
			};
		}
	}
	setTitle(title) { this.title = title; return this; }
	setIcon(icon) { this.icon = icon; return this; }
	onClick(cb) { this.clickHandler = cb; return this; }
	async triggerClick(evt = {}) {
		if (this.clickHandler) await this.clickHandler(evt);
	}
}
export class Menu {
	constructor() {
		this.entries = [];
		this.hidden = false;
		this.shownEvents = [];
		__menuTestState.instances.push(this);
	}
	addItem(cb) {
		const item = new MockMenuItem(__menuTestState.submenuSupported);
		this.entries.push({ kind: "item", item });
		cb(item);
		return this;
	}
	addSeparator() {
		this.entries.push({ kind: "separator" });
		return this;
	}
	hide() {
		this.hidden = true;
		return this;
	}
	showAtMouseEvent(evt) {
		this.shownEvents.push(evt);
		return this;
	}
}
`,
						}));
					},
				},
				sveltePlugin({ preprocess: sveltePreprocess(), compilerOptions: { css: "injected" } }),
			],
		});
		dom = new JSDOM('<body><main></main></body>', { url: "https://test.local" });
		dom.window.HTMLElement.prototype.empty = function () {
			this.innerHTML = "";
		};
		for (const key of ["window", "document", "navigator", "HTMLElement", "HTMLTextAreaElement", "Element", "Node"]) {
			vi.stubGlobal(key, dom.window[key]);
		}
		({ App, JotStore, tick, get, menuState } = createRequire(import.meta.url)(output));
	});

	beforeEach(async () => {
		menuState.reset();
		dom.window.moment = { locale: () => "ja" };
		let currentContent = INITIAL_DOC;
		let failNext = false;
		vault = {
			read: vi.fn(async () => currentContent),
			modify: vi.fn(async (_file, data) => {
				if (failNext) {
					failNext = false;
					throw new Error("save failed");
				}
				currentContent = data;
			}),
			on: vi.fn(() => ({})),
			offref: vi.fn(),
			getFiles: vi.fn(() => []),
			failNextModify: () => {
				failNext = true;
			},
			getContent: () => currentContent,
		};
		store = new JotStore({ vault }, { path: "_jotline.md", basename: "_jotline" });
		await store.init();
		component = new App({
			target: document.querySelector("main"),
			props: { store, app: { vault, workspace: { getLeaf: () => ({ openFile: vi.fn() }) } } },
		});
		await tick();
		await Promise.resolve();
	});

	afterEach(() => {
		component?.$destroy();
		document.querySelector("main").innerHTML = "";
	});

	afterAll(async () => {
		dom?.window.close();
		vi.unstubAllGlobals();
		await rm(directory, { recursive: true, force: true });
	});

	function cardElByText(text) {
		const cards = Array.from(document.querySelectorAll(".jotline-card"));
		const found = cards.find((el) => el.textContent.trim().includes(text));
		expect(found).toBeTruthy();
		return found;
	}

	function menuItems(menu) {
		return menu.entries.flatMap((entry) => (entry.kind === "item" ? [entry.item] : []));
	}

	function snapshot() {
		return get(store.doc).groups.map((g) => ({
			name: g.name,
			cards: g.cards.map((c) => c.content),
		}));
	}

	function selectedCardTexts() {
		return Array.from(document.querySelectorAll(".jotline-card.is-selected")).map((el) =>
			el.querySelector(".jotline-card-content").textContent.trim()
		);
	}

	async function openContextMenu(cardText) {
		menuState.instances = [];
		const el = cardElByText(cardText);
		const event = new dom.window.MouseEvent("contextmenu", { bubbles: true, cancelable: true, clientX: 50, clientY: 60 });
		el.dispatchEvent(event);
		await tick();
		return { menu: menuState.instances[0], event };
	}

	it("moves a single right-clicked card to a named group tail and keeps selection", async () => {
		const { menu } = await openContextMenu("U1");
		const sendItem = menuItems(menu).find((item) => item.title === "グループへ移動");
		expect(sendItem).toBeTruthy();

		const alphaItem = menuItems(sendItem.submenu).find((item) => item.title === "Alpha");
		await alphaItem.triggerClick();
		await tick();

		expect(vault.modify).toHaveBeenCalledTimes(1);
		expect(snapshot()).toEqual([
			{ name: "", cards: ["U2"] },
			{ name: "Alpha", cards: ["A1", "A2", "U1"] },
			{ name: "Beta", cards: ["B1"] },
		]);
		expect(document.querySelector(".jotline-selection-bar")).not.toBeNull();
		expect(selectedCardTexts()).toEqual(["U1"]);
	});

	it("moves multiple selected cards in document order even when selected in reverse, and targets only the clicked card when right-clicking an unselected card", async () => {
		// 逆順（B1 → A1 → U1）で複数選択
		for (const text of ["B1", "A1", "U1"]) {
			cardElByText(text).dispatchEvent(new dom.window.MouseEvent("click", { bubbles: true, ctrlKey: true }));
			await tick();
		}
		expect(document.querySelector(".jotline-selection-count").textContent).toContain("3");

		// 選択済みカード（A1）上で右クリック → 3枚すべてがドキュメント順で Alpha の末尾へ移動
		const { menu } = await openContextMenu("A1");
		const sendItem = menuItems(menu).find((item) => item.title === "グループへ移動");
		const alphaItem = menuItems(sendItem.submenu).find((item) => item.title === "Alpha");
		await alphaItem.triggerClick();
		await tick();

		expect(vault.modify).toHaveBeenCalledTimes(1);
		expect(snapshot()).toEqual([
			{ name: "", cards: ["U2"] },
			{ name: "Alpha", cards: ["A2", "U1", "A1", "B1"] },
		]);
		expect(document.querySelector(".jotline-selection-bar")).not.toBeNull();
		expect(selectedCardTexts()).toEqual(["U1", "A1", "B1"]);

		// 選択バーの解除ボタンで選択をクリアできる
		document.querySelector('.jotline-selection-header button[data-icon="x"]').dispatchEvent(
			new dom.window.MouseEvent("click", { bubbles: true })
		);
		await tick();
		expect(document.querySelector(".jotline-selection-bar")).toBeNull();
		expect(selectedCardTexts()).toEqual([]);

		// 複数選択中に未選択カードを右クリックした場合は、その1枚だけが対象になる
		for (const text of ["U2", "A2"]) {
			cardElByText(text).dispatchEvent(new dom.window.MouseEvent("click", { bubbles: true, ctrlKey: true }));
			await tick();
		}
		const { menu: singleMenu } = await openContextMenu("U1");
		const singleSend = menuItems(singleMenu).find((item) => item.title === "グループへ移動");
		// U1 だけを現在所属グループ Alpha の末尾へ移動
		await menuItems(singleSend.submenu).find((item) => item.title === "Alpha").triggerClick();
		await tick();

		expect(snapshot()).toEqual([
			{ name: "", cards: ["U2"] },
			{ name: "Alpha", cards: ["A2", "A1", "B1", "U1"] },
		]);
		expect(selectedCardTexts()).toEqual(["U1"]);
	});

	it("supports child menu fallback when setSubmenu is unavailable and does nothing when closed without selection", async () => {
		menuState.submenuSupported = false;
		const { menu, event } = await openContextMenu("A1");
		const sendItem = menuItems(menu).find((item) => item.title === "グループへ移動");
		expect(sendItem.submenu).toBeNull();

		// 何も選ばずに閉じただけでは保存されない
		expect(vault.modify).not.toHaveBeenCalled();

		// 親項目クリックで親を閉じて子メニューを表示
		await sendItem.triggerClick();
		expect(menu.hidden).toBe(true);
		const childMenu = menuState.instances[1];
		expect(childMenu.shownEvents).toEqual([event]);
		expect(vault.modify).not.toHaveBeenCalled();

		// 子メニューから Beta を選択して移動
		await menuItems(childMenu).find((item) => item.title === "Beta").triggerClick();
		await tick();

		expect(vault.modify).toHaveBeenCalledTimes(1);
		expect(snapshot()).toEqual([
			{ name: "", cards: ["U1", "U2"] },
			{ name: "Alpha", cards: ["A2"] },
			{ name: "Beta", cards: ["B1", "A1"] },
		]);
		expect(document.querySelector(".jotline-selection-bar")).not.toBeNull();
		expect(selectedCardTexts()).toEqual(["A1"]);
	});

	it("clears selection and restores card placement when saving fails", async () => {
		vault.failNextModify();
		const { menu } = await openContextMenu("U1");
		expect(document.querySelector(".jotline-selection-bar")).not.toBeNull();

		const sendItem = menuItems(menu).find((item) => item.title === "グループへ移動");
		await menuItems(sendItem.submenu).find((item) => item.title === "Beta").triggerClick();
		await tick();

		expect(snapshot()).toEqual([
			{ name: "", cards: ["U1", "U2"] },
			{ name: "Alpha", cards: ["A1", "A2"] },
			{ name: "Beta", cards: ["B1"] },
		]);
		expect(document.querySelector(".jotline-selection-bar")).toBeNull();
		expect(selectedCardTexts()).toEqual([]);

		// グループ解除の保存失敗時も復元後に存在しないカードIDが選択状態に残らない
		vault.failNextModify();
		const { menu: ungroupMenu } = await openContextMenu("A1");
		const ungroupItem = menuItems(ungroupMenu).find((item) => item.title === "グループ化を解除（未分類に戻す）");
		await ungroupItem.triggerClick();
		await tick();
		expect(snapshot()).toEqual([
			{ name: "", cards: ["U1", "U2"] },
			{ name: "Alpha", cards: ["A1", "A2"] },
			{ name: "Beta", cards: ["B1"] },
		]);
		expect(document.querySelector(".jotline-selection-bar")).toBeNull();
		expect(selectedCardTexts()).toEqual([]);
	});

	it("allows clearing maintained selection via card click, Escape key, and selection bar close button", async () => {
		// 1) 移動後にカードクリック（修飾キーなし）で選択解除
		const { menu: m1 } = await openContextMenu("U1");
		await menuItems(menuItems(m1).find((i) => i.title === "グループへ移動").submenu)
			.find((i) => i.title === "Alpha")
			.triggerClick();
		await tick();
		expect(selectedCardTexts()).toEqual(["U1"]);

		cardElByText("U1").dispatchEvent(new dom.window.MouseEvent("click", { bubbles: true }));
		await tick();
		expect(document.querySelector(".jotline-selection-bar")).toBeNull();
		expect(selectedCardTexts()).toEqual([]);

		// 2) 解除後に Escape キーで選択解除
		const { menu: m2 } = await openContextMenu("U1");
		await menuItems(m2).find((i) => i.title === "グループ化を解除（未分類に戻す）").triggerClick();
		await tick();
		expect(selectedCardTexts()).toEqual(["U1"]);

		document.querySelector(".jotline-app-container").dispatchEvent(
			new dom.window.KeyboardEvent("keydown", { key: "Escape", bubbles: true, cancelable: true })
		);
		await tick();
		expect(document.querySelector(".jotline-selection-bar")).toBeNull();
		expect(selectedCardTexts()).toEqual([]);

		// 3) 移動後に選択バーの解除ボタン（x）で選択解除
		const { menu: m3 } = await openContextMenu("B1");
		await menuItems(menuItems(m3).find((i) => i.title === "グループへ移動").submenu)
			.find((i) => i.title === "Alpha")
			.triggerClick();
		await tick();
		expect(selectedCardTexts()).toEqual(["B1"]);

		document.querySelector('.jotline-selection-header button[data-icon="x"]').dispatchEvent(
			new dom.window.MouseEvent("click", { bubbles: true })
		);
		await tick();
		expect(document.querySelector(".jotline-selection-bar")).toBeNull();
		expect(selectedCardTexts()).toEqual([]);
	});

	it("uses the same tail-placement ungroup flow from submenu Ungroup, existing single/multi context menu Ungroup, and selection bar Ungroup", async () => {
		// 1) 新サブメニューの「グループ解除」で A1 を末尾未分類へ移動
		const { menu: subMenuParent } = await openContextMenu("A1");
		const sendItem = menuItems(subMenuParent).find((item) => item.title === "グループへ移動");
		await menuItems(sendItem.submenu).find((item) => item.title === "グループ解除").triggerClick();
		await tick();
		expect(snapshot()).toEqual([
			{ name: "", cards: ["U1", "U2"] },
			{ name: "Alpha", cards: ["A2"] },
			{ name: "Beta", cards: ["B1"] },
			{ name: "", cards: ["A1"] },
		]);
		expect(selectedCardTexts()).toEqual(["A1"]);

		// 2) 既存の単一カード右クリック「グループ化を解除（未分類に戻す）」で A2 を末尾未分類へ移動（Alpha は空になり除去）
		const { menu: singleMenu } = await openContextMenu("A2");
		const existingSingleUngroup = menuItems(singleMenu).find((item) => item.title === "グループ化を解除（未分類に戻す）");
		expect(existingSingleUngroup).toBeTruthy();
		await existingSingleUngroup.triggerClick();
		await tick();
		expect(snapshot()).toEqual([
			{ name: "", cards: ["U1", "U2"] },
			{ name: "Beta", cards: ["B1"] },
			{ name: "", cards: ["A1", "A2"] },
		]);
		expect(selectedCardTexts()).toEqual(["A2"]);

		// 次の複数選択テストのため選択解除
		cardElByText("A2").dispatchEvent(new dom.window.MouseEvent("click", { bubbles: true }));
		await tick();

		// 3) 既存の複数選択右クリック「選択した2枚のグループ化を解除」で U1 と B1 を末尾未分類へ移動
		for (const text of ["B1", "U1"]) {
			cardElByText(text).dispatchEvent(new dom.window.MouseEvent("click", { bubbles: true, ctrlKey: true }));
			await tick();
		}
		const { menu: multiMenu } = await openContextMenu("B1");
		const existingMultiUngroup = menuItems(multiMenu).find((item) => item.title === "選択した2枚のグループ化を解除");
		expect(existingMultiUngroup).toBeTruthy();
		await existingMultiUngroup.triggerClick();
		await tick();
		expect(snapshot()).toEqual([
			{ name: "", cards: ["U2"] },
			{ name: "", cards: ["A1", "A2", "U1", "B1"] },
		]);
		expect(selectedCardTexts()).toEqual(["U1", "B1"]);

		// 選択を解除してから 4) の検証へ
		cardElByText("U1").dispatchEvent(new dom.window.MouseEvent("click", { bubbles: true }));
		await tick();

		// 4) 選択アクションバーのグループ解除ボタンも同じ末尾配置を使う（名前付きグループを作ってから解除）
		await store.groupSelectedCards(
			[get(store.doc).groups[0].cards[0].id, get(store.doc).groups[1].cards[0].id],
			"Temp"
		);
		await tick();
		// Temp に属する U2 を選択してアクションバーから解除
		cardElByText("U2").dispatchEvent(new dom.window.MouseEvent("click", { bubbles: true, ctrlKey: true }));
		await tick();
		const barUngroupBtn = document.querySelector('.jotline-selection-actions button[data-icon="folder-minus"]');
		expect(barUngroupBtn).not.toBeNull();
		barUngroupBtn.dispatchEvent(new dom.window.MouseEvent("click", { bubbles: true }));
		await new Promise((resolve) => setTimeout(resolve, 0));
		await tick();
		expect(snapshot().at(-1)).toEqual({ name: "", cards: ["A2", "U1", "B1", "U2"] });
		expect(document.querySelector(".jotline-selection-bar")).not.toBeNull();
		expect(selectedCardTexts()).toEqual(["U2"]);
		expect(document.querySelector('.jotline-selection-actions button[data-icon="folder-minus"]')).toBeNull();
	});

	it("keeps anySelectedInGroup, Shift+Click range anchor, and no-op move/ungroup selection state consistent", async () => {
		// 1) 未分類カード U1 を名前付きグループ Alpha へ移動すると、選択維持のまま選択バーの解除ボタンが表示される
		const { menu: m1 } = await openContextMenu("U1");
		expect(document.querySelector('.jotline-selection-actions button[data-icon="folder-minus"]')).toBeNull();
		await menuItems(menuItems(m1).find((i) => i.title === "グループへ移動").submenu)
			.find((i) => i.title === "Alpha")
			.triggerClick();
		await tick();
		expect(selectedCardTexts()).toEqual(["U1"]);
		expect(document.querySelector('.jotline-selection-actions button[data-icon="folder-minus"]')).not.toBeNull();

		// 2) すでに Alpha 末尾にある U1 を再度 Alpha へ移動（no-op）しても保存されず選択状態は維持される
		vault.modify.mockClear();
		const { menu: mNoop } = await openContextMenu("U1");
		await menuItems(menuItems(mNoop).find((i) => i.title === "グループへ移動").submenu)
			.find((i) => i.title === "Alpha")
			.triggerClick();
		await tick();
		expect(vault.modify).not.toHaveBeenCalled();
		expect(selectedCardTexts()).toEqual(["U1"]);

		// 3) 移動後の新しい並び順（U2, A1, A2, U1, B1）で U1 を起点に B1 を Shift+Click すると [U1, B1] が範囲選択される
		cardElByText("B1").dispatchEvent(new dom.window.MouseEvent("click", { bubbles: true, shiftKey: true }));
		await tick();
		expect(selectedCardTexts()).toEqual(["U1", "B1"]);

		// 4) [U1, B1] をグループ解除すると、選択維持のまま全選択カードが未分類になり解除ボタンが消える
		const barUngroup = document.querySelector('.jotline-selection-actions button[data-icon="folder-minus"]');
		barUngroup.dispatchEvent(new dom.window.MouseEvent("click", { bubbles: true }));
		await new Promise((resolve) => setTimeout(resolve, 0));
		await tick();
		expect(selectedCardTexts()).toEqual(["U1", "B1"]);
		expect(document.querySelector('.jotline-selection-actions button[data-icon="folder-minus"]')).toBeNull();

		// 5) すでに末尾未分類に同じ順で並んでいる [U1, B1] を再解除（no-op）しても保存されず選択維持
		vault.modify.mockClear();
		const { menu: mUngroupNoop } = await openContextMenu("U1");
		await menuItems(menuItems(mUngroupNoop).find((i) => i.title === "グループへ移動").submenu)
			.find((i) => i.title === "グループ解除")
			.triggerClick();
		await tick();
		expect(vault.modify).not.toHaveBeenCalled();
		expect(selectedCardTexts()).toEqual(["U1", "B1"]);

		// 6) 保存失敗でモデル復元後、古い lastSelectedCardId が残らず Shift+Click で誤った範囲選択にならない
		vault.failNextModify();
		const { menu: mFail } = await openContextMenu("U1");
		await menuItems(menuItems(mFail).find((i) => i.title === "グループへ移動").submenu)
			.find((i) => i.title === "Alpha")
			.triggerClick();
		await tick();
		expect(selectedCardTexts()).toEqual([]);
		expect(document.querySelector(".jotline-selection-bar")).toBeNull();

		cardElByText("A2").dispatchEvent(new dom.window.MouseEvent("click", { bubbles: true, shiftKey: true }));
		await tick();
		expect(selectedCardTexts()).toEqual([]);
	});
});
