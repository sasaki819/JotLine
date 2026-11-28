import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { build } from "esbuild";
import sveltePlugin from "esbuild-svelte";
import sveltePreprocess from "svelte-preprocess";
import { JSDOM } from "jsdom";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

describe("App drag-and-drop position preview", () => {
	let directory, dom, AppComponent, JotStore, tick, get, startDrag, endDrag, getDragSource, getDropPreview, setDropPreview, JOTLINE_DRAG_MIME, notices, component;

	beforeAll(async () => {
		directory = await mkdtemp(join(tmpdir(), "jotline-drop-preview-test-"));
		const output = join(directory, "app.cjs");
		await build({
			stdin: {
				contents: `
					export { default as AppComponent } from "./src/ui/App.svelte";
					export { JotStore } from "./src/store.ts";
					export { startDrag, endDrag, getDragSource, getDropPreview, setDropPreview, JOTLINE_DRAG_MIME } from "./src/dnd.ts";
					export { tick } from "svelte";
					export { get } from "svelte/store";
					export { __notices } from "obsidian";
				`,
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
								export const __notices = [];
								export class Notice { constructor(msg) { __notices.push(msg); } }
								export class Component { load() {} unload() {} }
								export class Menu { addItem() { return this; } addSeparator() { return this; } showAtMouseEvent() {} }
								export const MarkdownRenderer = {
									async render(_app, md, el) { el.textContent = md; },
								};
								export const Platform = { isMacOS: false };
								export function setIcon(el, name) { el.dataset.icon = name; }
							`,
						}));
					},
				},
				sveltePlugin({ preprocess: sveltePreprocess(), compilerOptions: { css: "injected" } }),
			],
		});
		dom = new JSDOM("<body><main></main></body>", { url: "https://test.local" });
		dom.window.HTMLElement.prototype.empty = function () { this.innerHTML = ""; };
		for (const key of ["window", "document", "navigator", "HTMLElement", "HTMLTextAreaElement", "Element", "Node", "MouseEvent", "KeyboardEvent", "Event"]) {
			vi.stubGlobal(key, dom.window[key]);
		}
		({
			AppComponent,
			JotStore,
			tick,
			get,
			startDrag,
			endDrag,
			getDragSource,
			getDropPreview,
			setDropPreview,
			JOTLINE_DRAG_MIME,
			__notices: notices,
		} = createRequire(import.meta.url)(output));
	});

	afterEach(() => {
		endDrag();
		notices.length = 0;
		component?.$destroy();
		component = null;
		document.querySelector("main").innerHTML = "";
	});

	afterAll(async () => {
		dom?.window.close();
		vi.unstubAllGlobals();
		await rm(directory, { recursive: true, force: true });
	});

	function createDataTransfer() {
		const map = new Map();
		return {
			dropEffect: "none",
			effectAllowed: "all",
			get types() {
				return Array.from(map.keys());
			},
			setData(type, val) {
				map.set(type, String(val));
			},
			getData(type) {
				return map.get(type) ?? "";
			},
		};
	}

	function dispatchDragEvent(target, type, { dataTransfer, clientY = 0, relatedTarget = null, ctrlKey = false, altKey = false } = {}) {
		const evt = new dom.window.Event(type, { bubbles: true, cancelable: true });
		Object.defineProperty(evt, "dataTransfer", { value: dataTransfer ?? createDataTransfer() });
		Object.defineProperty(evt, "clientY", { value: clientY });
		Object.defineProperty(evt, "relatedTarget", { value: relatedTarget });
		Object.defineProperty(evt, "ctrlKey", { value: ctrlKey });
		Object.defineProperty(evt, "altKey", { value: altKey });
		target.dispatchEvent(evt);
		return evt;
	}

	function mockCardRects(wrappers) {
		wrappers.forEach((wrapper, idx) => {
			wrapper.getBoundingClientRect = () => ({
				top: idx * 100,
				bottom: (idx + 1) * 100,
				height: 100,
				left: 0,
				right: 300,
				width: 300,
			});
		});
	}

	async function mountWithMarkdown(markdown, path = "test.md") {
		let fileContent = markdown;
		const vault = {
			read: vi.fn(async () => fileContent),
			modify: vi.fn(async (_file, next) => { fileContent = next; }),
			on: vi.fn(() => ({})),
		};
		const app = { vault, workspace: { getActiveViewOfType: () => null } };
		const store = new JotStore(app, { path, basename: path.replace(/\.md$/, "") });
		await store.init();
		component = new AppComponent({
			target: document.querySelector("main"),
			props: { store, app },
		});
		await tick();
		return { store, vault, getFileContent: () => fileContent };
	}

	it("tracks upper/lower card dragover preview and matches actual drop result within the same group", async () => {
		const md = "<!-- card -->\nA\n\n<!-- card -->\nB\n\n<!-- card -->\nC\n";
		const { store } = await mountWithMarkdown(md);

		let wrappers = Array.from(document.querySelectorAll(".jotline-card-wrapper"));
		mockCardRects(wrappers);

		const dt = createDataTransfer();
		dispatchDragEvent(wrappers[0].querySelector(".jotline-card"), "dragstart", { dataTransfer: dt });
		await tick();

		// Dragged card gets dimmed class
		expect(wrappers[0].querySelector(".jotline-card").classList.contains("is-dragging")).toBe(true);

		// Hover upper half of C (top=200, height=100, clientY=220 -> before index 2)
		dispatchDragEvent(wrappers[2], "dragover", { dataTransfer: dt, clientY: 220 });
		await tick();

		let indicators = document.querySelectorAll(".jotline-drop-indicator");
		expect(indicators).toHaveLength(1);
		expect(indicators[0].dataset.dropPosition).toBe("before");
		expect(indicators[0].dataset.dropIndex).toBe("2");
		expect(wrappers[2].contains(indicators[0])).toBe(true);
		expect(document.querySelector(".jotline-group").classList.contains("is-dragover")).toBe(true);

		// Move to lower half of C (clientY=280 -> after C = slot 3)
		dispatchDragEvent(wrappers[2], "dragover", { dataTransfer: dt, clientY: 280 });
		await tick();

		indicators = document.querySelectorAll(".jotline-drop-indicator");
		expect(indicators).toHaveLength(1);
		expect(indicators[0].dataset.dropPosition).toBe("after");
		expect(indicators[0].dataset.dropIndex).toBe("3");
		expect(wrappers[2].contains(indicators[0])).toBe(true);

		// Move back to upper half of C and drop -> [B, A, C]
		dispatchDragEvent(wrappers[2], "dragover", { dataTransfer: dt, clientY: 220 });
		await tick();
		dispatchDragEvent(wrappers[2], "drop", { dataTransfer: dt, clientY: 220 });
		await new Promise((r) => setTimeout(r, 0));
		await tick();

		expect(document.querySelectorAll(".jotline-drop-indicator")).toHaveLength(0);
		expect(getDragSource()).toBeNull();
		expect(getDropPreview()).toBeNull();
		expect(document.querySelectorAll(".jotline-card.is-dragging")).toHaveLength(0);
		expect(get(store.doc).groups[0].cards.map((c) => c.content)).toEqual(["B", "A", "C"]);

		// Now drag new first card B (index 0) to lower half of C (slot 3) -> [A, C, B]
		wrappers = Array.from(document.querySelectorAll(".jotline-card-wrapper"));
		mockCardRects(wrappers);
		const dt2 = createDataTransfer();
		dispatchDragEvent(wrappers[0].querySelector(".jotline-card"), "dragstart", { dataTransfer: dt2 });
		dispatchDragEvent(wrappers[2], "dragover", { dataTransfer: dt2, clientY: 280 });
		await tick();
		expect(document.querySelector(".jotline-drop-indicator").dataset.dropIndex).toBe("3");
		dispatchDragEvent(wrappers[2], "drop", { dataTransfer: dt2, clientY: 280 });
		await new Promise((r) => setTimeout(r, 0));
		await tick();

		expect(get(store.doc).groups[0].cards.map((c) => c.content)).toEqual(["A", "C", "B"]);
		expect(document.querySelectorAll(".jotline-drop-indicator")).toHaveLength(0);
	});

	it("keeps only one preview across groups, supports group tail and collapsed thread drops, and clears on cancel", async () => {
		const md = `<!-- group: Alpha -->
<!-- card -->
A1

<!-- card -->
A2

<!-- group: Beta -->
<!-- card -->
B1
`;
		const { store } = await mountWithMarkdown(md);
		const groups = Array.from(document.querySelectorAll(".jotline-group"));
		const alphaWrappers = Array.from(groups[0].querySelectorAll(".jotline-card-wrapper"));
		const betaWrappers = Array.from(groups[1].querySelectorAll(".jotline-card-wrapper"));
		mockCardRects(alphaWrappers);
		mockCardRects(betaWrappers);

		const dt = createDataTransfer();
		dispatchDragEvent(alphaWrappers[0].querySelector(".jotline-card"), "dragstart", { dataTransfer: dt });
		await tick();

		// Hover Alpha card 1 -> preview in Alpha
		dispatchDragEvent(alphaWrappers[1], "dragover", { dataTransfer: dt, clientY: 110 });
		await tick();
		expect(groups[0].querySelectorAll(".jotline-drop-indicator")).toHaveLength(1);
		expect(groups[1].querySelectorAll(".jotline-drop-indicator")).toHaveLength(0);

		// Move directly to Beta without dragleave on Alpha -> only Beta has preview
		dispatchDragEvent(groups[1], "dragover", { dataTransfer: dt, clientY: 150 });
		await tick();
		expect(groups[0].querySelectorAll(".jotline-drop-indicator")).toHaveLength(0);
		expect(groups[0].classList.contains("is-dragover")).toBe(false);
		expect(groups[1].querySelectorAll(".jotline-drop-indicator")).toHaveLength(1);
		expect(groups[1].querySelector(".jotline-drop-indicator").dataset.dropPosition).toBe("after");
		expect(groups[1].querySelector(".jotline-drop-indicator").dataset.dropIndex).toBe("1");

		// dragleave into a child element does NOT clear preview
		dispatchDragEvent(groups[1], "dragleave", { dataTransfer: dt, relatedTarget: betaWrappers[0] });
		await tick();
		expect(groups[1].querySelectorAll(".jotline-drop-indicator")).toHaveLength(1);

		// dragleave outside group clears preview
		dispatchDragEvent(groups[1], "dragleave", { dataTransfer: dt, relatedTarget: document.body });
		await tick();
		expect(document.querySelectorAll(".jotline-drop-indicator")).toHaveLength(0);

		// Re-hover Beta, then cancel via dragend (without drop) -> clears preview and is-dragging
		dispatchDragEvent(groups[1], "dragover", { dataTransfer: dt, clientY: 150 });
		await tick();
		expect(document.querySelectorAll(".jotline-drop-indicator")).toHaveLength(1);
		dispatchDragEvent(alphaWrappers[0].querySelector(".jotline-card"), "dragend", { dataTransfer: dt });
		await tick();
		expect(document.querySelectorAll(".jotline-drop-indicator")).toHaveLength(0);
		expect(alphaWrappers[0].querySelector(".jotline-card").classList.contains("is-dragging")).toBe(false);
		expect(getDropPreview()).toBeNull();

		// Collapse Beta, drag A1 onto collapsed Beta -> shows collapsed-tail preview and appends on drop
		groups[1].querySelector(".jotline-collapse-toggle").click();
		await tick();
		const dt2 = createDataTransfer();
		dispatchDragEvent(alphaWrappers[0].querySelector(".jotline-card"), "dragstart", { dataTransfer: dt2 });
		dispatchDragEvent(groups[1], "dragover", { dataTransfer: dt2 });
		await tick();
		const collapsedIndicator = groups[1].querySelector(".jotline-drop-indicator");
		expect(collapsedIndicator).not.toBeNull();
		expect(collapsedIndicator.dataset.dropPosition).toBe("collapsed-tail");

		dispatchDragEvent(groups[1], "drop", { dataTransfer: dt2 });
		await new Promise((r) => setTimeout(r, 0));
		await tick();
		expect(document.querySelectorAll(".jotline-drop-indicator")).toHaveLength(0);
		expect(get(store.doc).groups[1].cards.map((c) => c.content)).toEqual(["B1", "A1"]);
	});

	it("shows thread-after preview for cross-file thread drag, empty preview for empty group, and hides preview for invalid targets", async () => {
		const md = `<!-- group: First -->
<!-- card -->
F1
`;
		const { store } = await mountWithMarkdown(md, "dest.md");
		const groupEl = document.querySelector(".jotline-group");
		const cardWrapper = groupEl.querySelector(".jotline-card-wrapper");
		mockCardRects([cardWrapper]);

		// 1. Same-view thread drag -> invalid target -> no preview
		const dtSameThread = createDataTransfer();
		dispatchDragEvent(groupEl.querySelector(".jotline-group-header"), "dragstart", { dataTransfer: dtSameThread });
		dispatchDragEvent(groupEl, "dragover", { dataTransfer: dtSameThread });
		await tick();
		expect(document.querySelectorAll(".jotline-drop-indicator")).toHaveLength(0);
		expect(groupEl.classList.contains("is-dragover")).toBe(false);
		endDrag();

		// 2. Same-file different-view cards drag -> invalid target -> no preview, drop shows notice
		const otherViewSameFileStore = { file: { path: "dest.md" } };
		const dtSameFile = createDataTransfer();
		dtSameFile.setData(JOTLINE_DRAG_MIME, "cards");
		startDrag({
			kind: "cards",
			store: otherViewSameFileStore,
			filePath: "dest.md",
			cardIds: ["x1"],
			text: "X",
			contents: ["X"],
		});
		dispatchDragEvent(cardWrapper, "dragover", { dataTransfer: dtSameFile, clientY: 20 });
		await tick();
		expect(document.querySelectorAll(".jotline-drop-indicator")).toHaveLength(0);
		expect(groupEl.classList.contains("is-dragover")).toBe(false);
		dispatchDragEvent(cardWrapper, "drop", { dataTransfer: dtSameFile, clientY: 20 });
		await new Promise((r) => setTimeout(r, 0));
		expect(notices.length).toBe(1);
		expect(get(store.doc).groups).toHaveLength(1);
		endDrag();

		// 3. Cross-file thread drag -> shows thread-after preview and inserts thread after group on drop
		const otherStore = { file: { path: "source.md" }, removeGroup: vi.fn(async () => true) };
		const dtCrossThread = createDataTransfer();
		dtCrossThread.setData(JOTLINE_DRAG_MIME, "thread");
		startDrag({
			kind: "thread",
			store: otherStore,
			filePath: "source.md",
			groupId: "src-g",
			name: "Imported",
			text: "T1",
			contents: ["T1"],
		});
		dispatchDragEvent(cardWrapper, "dragover", { dataTransfer: dtCrossThread, clientY: 20 });
		await tick();
		const threadIndicator = groupEl.querySelector(".jotline-drop-indicator");
		expect(threadIndicator).not.toBeNull();
		expect(threadIndicator.dataset.dropPosition).toBe("thread-after");
		expect(groupEl.classList.contains("is-dragover")).toBe(false);

		dispatchDragEvent(cardWrapper, "drop", { dataTransfer: dtCrossThread, clientY: 20 });
		await new Promise((r) => setTimeout(r, 0));
		await tick();
		expect(document.querySelectorAll(".jotline-drop-indicator")).toHaveLength(0);
		expect(get(store.doc).groups.map((g) => g.name)).toEqual(["First", "Imported"]);
		endDrag();

		// 4. Empty document -> cross-file editor drag shows empty target preview and inserts at index 0
		component.$destroy();
		document.querySelector("main").innerHTML = "";
		const emptyMount = await mountWithMarkdown("", "empty.md");
		const emptyGroupEl = document.querySelector(".jotline-group");
		const dtEditor = createDataTransfer();
		dtEditor.setData("text/plain", "From editor");
		startDrag({
			kind: "editor",
			editor: { getRange: () => "From editor", replaceRange: vi.fn() },
			filePath: "note.md",
			from: { line: 0, ch: 0 },
			to: { line: 0, ch: 11 },
			text: "From editor",
		});
		dispatchDragEvent(emptyGroupEl, "dragover", { dataTransfer: dtEditor });
		await tick();
		expect(emptyGroupEl.querySelector(".jotline-empty-group").classList.contains("is-dragover")).toBe(true);
		expect(emptyGroupEl.querySelector(".jotline-drop-indicator").dataset.dropPosition).toBe("empty");

		dispatchDragEvent(emptyGroupEl, "drop", { dataTransfer: dtEditor });
		await new Promise((r) => setTimeout(r, 0));
		await tick();
		expect(document.querySelectorAll(".jotline-drop-indicator")).toHaveLength(0);
		expect(get(emptyMount.store.doc).groups[0].cards.map((c) => c.content)).toEqual(["From editor"]);
	});

	it("ends drag session and removes .is-dragging on cross-group drop even without dragend", async () => {
		const md = `<!-- group: Alpha -->
<!-- card -->
A1

<!-- card -->
A2

<!-- group: Beta -->
<!-- card -->
B1
`;
		const { store } = await mountWithMarkdown(md);
		const groups = Array.from(document.querySelectorAll(".jotline-group"));
		const alphaWrappers = Array.from(groups[0].querySelectorAll(".jotline-card-wrapper"));
		const betaWrappers = Array.from(groups[1].querySelectorAll(".jotline-card-wrapper"));
		mockCardRects(alphaWrappers);
		mockCardRects(betaWrappers);

		const dt = createDataTransfer();
		dispatchDragEvent(alphaWrappers[0].querySelector(".jotline-card"), "dragstart", { dataTransfer: dt });
		await tick();
		expect(alphaWrappers[0].querySelector(".jotline-card").classList.contains("is-dragging")).toBe(true);

		// Drop A1 onto expanded Beta before B1 without firing dragend
		dispatchDragEvent(betaWrappers[0], "dragover", { dataTransfer: dt, clientY: 10 });
		await tick();
		expect(groups[1].querySelector(".jotline-drop-indicator").dataset.dropIndex).toBe("0");

		dispatchDragEvent(betaWrappers[0], "drop", { dataTransfer: dt, clientY: 10 });
		await new Promise((r) => setTimeout(r, 0));
		await tick();

		expect(getDragSource()).toBeNull();
		expect(getDropPreview()).toBeNull();
		expect(document.querySelectorAll(".jotline-drop-indicator")).toHaveLength(0);
		expect(document.querySelectorAll(".jotline-card.is-dragging")).toHaveLength(0);
		expect(get(store.doc).groups[0].cards.map((c) => c.content)).toEqual(["A2"]);
		expect(get(store.doc).groups[1].cards.map((c) => c.content)).toEqual(["A1", "B1"]);
	});

	it("clears stale preview from another view when hovering an invalid target without dragleave", async () => {
		const md = `<!-- group: Source -->
<!-- card -->
S1
`;
		const { store } = await mountWithMarkdown(md, "source.md");
		const groupEl = document.querySelector(".jotline-group");
		const otherViewStore = { file: { path: "other.md" } };

		// 1. Start thread drag from this view, simulate active preview in another view, then hover back over this view
		const dtThread = createDataTransfer();
		dispatchDragEvent(groupEl.querySelector(".jotline-group-header"), "dragstart", { dataTransfer: dtThread });
		setDropPreview({ kind: "thread-after", store: otherViewStore, groupId: "other-g" });
		expect(getDropPreview()).not.toBeNull();

		dispatchDragEvent(groupEl, "dragover", { dataTransfer: dtThread });
		await tick();
		expect(getDropPreview()).toBeNull();
		endDrag();

		// 2. Non-JotLine MIME dragover with active JotLine session also clears another view's preview
		startDrag({
			kind: "cards",
			store,
			filePath: "source.md",
			cardIds: ["c1"],
			text: "S1",
			contents: ["S1"],
		});
		setDropPreview({ kind: "card", store: otherViewStore, groupId: "other-g", index: 0 });
		const dtWithoutMime = createDataTransfer();
		dtWithoutMime.setData("text/plain", "unrelated");
		dispatchDragEvent(groupEl, "dragover", { dataTransfer: dtWithoutMime });
		await tick();
		expect(getDropPreview()).toBeNull();
	});
});
