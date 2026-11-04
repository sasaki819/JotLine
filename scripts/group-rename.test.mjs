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

describe("group rename focus and confirmation", () => {
	let directory, dom, GroupView, JotStore, tick, component, unsubscribe, vault;

	beforeAll(async () => {
		directory = await mkdtemp(join(tmpdir(), "jotline-group-test-"));
		const output = join(directory, "group.cjs");
		// Compile with the production Svelte plugin so focus is tested on the real component.
		await build({
			stdin: {
				contents: 'export {default as GroupView} from "./src/ui/GroupView.svelte"; export {JotStore} from "./src/store.ts"; export {tick} from "svelte";',
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
							contents: "export class Notice {} export class Component {} export const MarkdownRenderer = {}; export const Platform = {}; export function setIcon() {}",
						}));
					},
				},
				sveltePlugin({ preprocess: sveltePreprocess(), compilerOptions: { css: "injected" } }),
			],
		});
		dom = new JSDOM('<body><main></main><button id="outside">Outside</button></body>', { url: "https://test.local" });
		for (const key of ["window", "document", "navigator", "HTMLElement", "Element", "Node"]) {
			vi.stubGlobal(key, dom.window[key]);
		}
		({ GroupView, JotStore, tick } = createRequire(import.meta.url)(output));
	});

	beforeEach(async () => {
		vault = {
			read: vi.fn(async () => "<!-- group: Old name -->\n<!-- card -->\nContent\n"),
			modify: vi.fn(async () => {}),
			on: vi.fn(() => ({})),
		};
		const store = new JotStore({ vault }, { path: "test.md" });
		await store.init();
		let group;
		const readGroup = store.doc.subscribe(doc => { group = doc.groups[0]; });
		readGroup();
		// Cards are irrelevant to header editing; the real store still preserves them.
		component = new GroupView({ target: document.querySelector("main"), props: { group: { ...group, cards: [] }, store, app: {} } });
		unsubscribe = store.doc.subscribe(doc => component.$set({ group: { ...doc.groups[0], cards: [] } }));
		await tick();
	});

	afterEach(() => {
		unsubscribe?.();
		component?.$destroy();
	});
	afterAll(async () => {
		dom?.window.close();
		vi.unstubAllGlobals();
		await rm(directory, { recursive: true, force: true });
	});

	async function edit(viaButton = false) {
		const selector = viaButton ? ".jotline-thread-name + button" : ".jotline-thread-name";
		document.querySelector(selector).dispatchEvent(new dom.window.MouseEvent(viaButton ? "click" : "dblclick", { bubbles: true }));
		await tick();
		const input = document.querySelector(".jotline-rename-input");
		// Do not call focus here: editing must move focus without another click.
		expect(document.activeElement).toBe(input);
		expect(input.selectionStart).toBe(0);
		expect(input.selectionEnd).toBe(input.value.length);
		return input;
	}
	function type(input, value) {
		input.value = value;
		input.dispatchEvent(new dom.window.Event("input", { bubbles: true }));
	}
	function key(key, options = {}) {
		document.activeElement.dispatchEvent(new dom.window.KeyboardEvent("keydown", { key, bubbles: true, ...options }));
	}

	it.each([false, true])("selects the existing name for replacement (edit button: %s)", async (viaButton) => {
		const input = await edit(viaButton);
		input.setRangeText("Replacement", input.selectionStart, input.selectionEnd, "end");
		input.dispatchEvent(new dom.window.Event("input", { bubbles: true }));
		key("Enter");
		await tick();
		expect(vault.modify).toHaveBeenCalledTimes(1);
		expect(vault.modify.mock.calls[0][1]).toContain("<!-- group: Replacement -->");
	});

	it("focuses on double-click and saves with Enter without a second click", async () => {
		const input = await edit();
		type(input, "  New name  ");
		key("Enter");
		await tick();
		expect(document.querySelector(".jotline-rename-input")).toBeNull();
		expect(vault.modify).toHaveBeenCalledTimes(1);
		expect(vault.modify.mock.calls[0][1]).toContain("<!-- group: New name -->");
	});

	it("focuses from the edit button and saves when focus moves outside", async () => {
		const input = await edit(true);
		type(input, "New name");
		document.querySelector("#outside").focus();
		await tick();
		expect(document.querySelector(".jotline-rename-input")).toBeNull();
		expect(vault.modify).toHaveBeenCalledTimes(1);
	});

	it("cancels with Escape immediately after double-click", async () => {
		await edit();
		key("Escape");
		await tick();
		document.querySelector("#outside").focus();
		expect(document.querySelector(".jotline-rename-input")).toBeNull();
		expect(vault.modify).not.toHaveBeenCalled();
	});

	it("discards changes with Escape and does not save on the following blur", async () => {
		type(await edit(), "Discard this");
		key("Escape");
		document.querySelector("#outside").focus();
		await tick();
		expect(vault.modify).not.toHaveBeenCalled();
		expect(document.querySelector(".jotline-thread-name").textContent.trim()).toBe("Old name");
	});

	it("does not duplicate a pending save when Enter is followed by blur", async () => {
		let finish;
		vault.modify.mockImplementationOnce(() => new Promise(resolve => { finish = resolve; }));
		const input = await edit();
		type(input, "New name");
		key("Enter");
		input.dispatchEvent(new dom.window.FocusEvent("blur"));
		await tick();
		expect(vault.modify).toHaveBeenCalledTimes(1);
		finish();
	});

	it("keeps editing during IME composition", async () => {
		const input = await edit();
		type(input, "変換中");
		key("Enter", { isComposing: true });
		key("Escape", { isComposing: true });
		await tick();
		expect(document.activeElement).toBe(input);
		expect(vault.modify).not.toHaveBeenCalled();
	});
});
