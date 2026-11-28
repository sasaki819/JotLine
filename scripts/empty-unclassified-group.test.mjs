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

describe("App empty unclassified group cleanup and welcome display", () => {
	let directory, dom, AppComponent, JotStore, tick, get, component;

	beforeAll(async () => {
		directory = await mkdtemp(join(tmpdir(), "jotline-empty-group-test-"));
		const output = join(directory, "app.cjs");
		await build({
			stdin: {
				contents:
					'export {default as AppComponent} from "./src/ui/App.svelte"; export {JotStore} from "./src/store.ts"; export {tick} from "svelte"; export {get} from "svelte/store";',
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
		dom.window.HTMLElement.prototype.empty = function () {
			this.innerHTML = "";
		};
		for (const key of ["window", "document", "navigator", "HTMLElement", "HTMLTextAreaElement", "Element", "Node", "MouseEvent", "KeyboardEvent", "Event"]) {
			vi.stubGlobal(key, dom.window[key]);
		}
		({ AppComponent, JotStore, tick, get } = createRequire(import.meta.url)(output));
	});

	afterEach(() => {
		component?.$destroy();
		component = null;
		document.querySelector("main").innerHTML = "";
	});

	afterAll(async () => {
		dom?.window.close();
		vi.unstubAllGlobals();
		await rm(directory, { recursive: true, force: true });
	});

	async function mountWithMarkdown(initialMarkdown) {
		let content = initialMarkdown;
		const vault = {
			read: vi.fn(async () => content),
			modify: vi.fn(async (_file, next) => {
				content = next;
			}),
			on: vi.fn(() => ({})),
		};
		const app = { vault, workspace: { getActiveViewOfType: () => null } };
		const store = new JotStore(app, { path: "test.md", basename: "test" });
		await store.init();
		component = new AppComponent({
			target: document.querySelector("main"),
			props: { store, app },
		});
		await tick();
		return { store, app, getContent: () => content };
	}

	function domSummary() {
		return {
			groups: Array.from(document.querySelectorAll(".jotline-group")).map((g) => ({
				isThread: g.classList.contains("is-thread"),
				cards: Array.from(g.querySelectorAll(".jotline-card-content")).map((c) => c.textContent),
			})),
			emptyDropBoxes: document.querySelectorAll(".jotline-empty-group").length,
			hasWelcome: document.querySelector(".jotline-welcome-empty") !== null,
		};
	}

	it("does not leave an empty drop box when moving all unclassified cards into a named group and matches reload", async () => {
		const md = `<!-- group -->
<!-- card -->
U1

<!-- group: Alpha -->
<!-- card -->
A1
`;
		const { store, getContent } = await mountWithMarkdown(md);
		const doc = get(store.doc);
		await store.moveCardsToGroup([doc.groups[0].cards[0].id], doc.groups[1].id);
		await tick();

		const afterMove = domSummary();
		expect(afterMove).toEqual({
			groups: [{ isThread: true, cards: ["A1", "U1"] }],
			emptyDropBoxes: 0,
			hasWelcome: false,
		});

		// Reload from saved markdown and verify identical DOM structure
		component.$destroy();
		component = null;
		document.querySelector("main").innerHTML = "";
		await mountWithMarkdown(getContent());
		expect(domSummary()).toEqual(afterMove);
	});

	it("keeps the welcome display when deleting the last card in the document and matches reload", async () => {
		const md = `<!-- group: Alpha -->
<!-- card -->
Only card
`;
		const { store, getContent } = await mountWithMarkdown(md);
		const cardId = get(store.doc).groups[0].cards[0].id;
		await store.deleteCard(cardId);
		await tick();

		const afterDelete = domSummary();
		expect(afterDelete).toEqual({
			groups: [{ isThread: false, cards: [] }],
			emptyDropBoxes: 1,
			hasWelcome: true,
		});

		component.$destroy();
		component = null;
		document.querySelector("main").innerHTML = "";
		await mountWithMarkdown(getContent());
		expect(domSummary()).toEqual(afterDelete);
	});
});
