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

describe("App unclassified group card spacing", () => {
	let directory, dom, AppComponent, JotStore, tick, component;

	beforeAll(async () => {
		directory = await mkdtemp(join(tmpdir(), "jotline-spacing-test-"));
		const output = join(directory, "app.cjs");
		await build({
			stdin: {
				contents:
					'export {default as AppComponent} from "./src/ui/App.svelte"; export {JotStore} from "./src/store.ts"; export {tick} from "svelte";',
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
		dom.window.HTMLElement.prototype.empty = function () { this.innerHTML = ""; };
		for (const key of ["window", "document", "navigator", "HTMLElement", "HTMLTextAreaElement", "Element", "Node", "MouseEvent", "KeyboardEvent", "Event"]) {
			vi.stubGlobal(key, dom.window[key]);
		}
		({ AppComponent, JotStore, tick } = createRequire(import.meta.url)(output));
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

	async function mountWithMarkdown(markdown) {
		const vault = {
			read: vi.fn(async () => markdown),
			modify: vi.fn(async () => {}),
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
		return { store, vault };
	}

	it("sets margin-bottom to 0px between consecutive unclassified groups while keeping named-group and card spacing", async () => {
		const md = `<!-- group -->
<!-- card -->
U1-A

<!-- card -->
U1-B

<!-- group -->
<!-- card -->
U2-A

<!-- group -->
<!-- card -->
U3-A

<!-- group: Alpha -->
<!-- card -->
Alpha-1

<!-- group -->
<!-- card -->
U4-A
`;
		await mountWithMarkdown(md);

		const groups = Array.from(document.querySelectorAll(".jotline-group"));
		expect(groups).toHaveLength(5);

		// U1 -> U2 (both unclassified with cards): 0px group margin so card margin-bottom (8px) matches in-group spacing
		expect(groups[0].classList.contains("is-default")).toBe(true);
		expect(groups[0].classList.contains("is-followed-by-default")).toBe(true);
		expect(dom.window.getComputedStyle(groups[0]).marginBottom).toBe("0px");

		// U2 -> U3: also consecutive unclassified
		expect(groups[1].classList.contains("is-default")).toBe(true);
		expect(groups[1].classList.contains("is-followed-by-default")).toBe(true);
		expect(dom.window.getComputedStyle(groups[1]).marginBottom).toBe("0px");

		// U3 -> Alpha (named thread): keeps 16px boundary margin
		expect(groups[2].classList.contains("is-default")).toBe(true);
		expect(groups[2].classList.contains("is-followed-by-default")).toBe(false);
		expect(dom.window.getComputedStyle(groups[2]).marginBottom).toBe("16px");

		// Alpha (named thread) -> U4: keeps 16px boundary margin
		expect(groups[3].classList.contains("is-thread")).toBe(true);
		expect(groups[3].classList.contains("is-followed-by-default")).toBe(false);
		expect(dom.window.getComputedStyle(groups[3]).marginBottom).toBe("16px");

		// U4 (last group): keeps 16px bottom margin
		expect(groups[4].classList.contains("is-default")).toBe(true);
		expect(groups[4].classList.contains("is-followed-by-default")).toBe(false);
		expect(dom.window.getComputedStyle(groups[4]).marginBottom).toBe("16px");

		// Card spacing remains 8px
		const firstCard = document.querySelector(".jotline-card");
		expect(dom.window.getComputedStyle(firstCard).marginBottom).toBe("8px");
	});

	it("updates spacing reactively when dissolving a thread creates consecutive unclassified groups", async () => {
		const md = `<!-- group -->
<!-- card -->
Top

<!-- group: Mid -->
<!-- card -->
Mid 1

<!-- group: Last -->
<!-- card -->
Last 1
`;
		await mountWithMarkdown(md);

		let groups = Array.from(document.querySelectorAll(".jotline-group"));
		expect(groups[0].classList.contains("is-followed-by-default")).toBe(false);
		expect(dom.window.getComputedStyle(groups[0]).marginBottom).toBe("16px");

		// Dissolve "Mid" thread
		const midDissolveBtn = groups[1].querySelector('.jotline-group-actions button[data-icon="folder-minus"]');
		midDissolveBtn.dispatchEvent(new dom.window.MouseEvent("click", { bubbles: true }));
		await tick();
		await Promise.resolve();
		await tick();

		groups = Array.from(document.querySelectorAll(".jotline-group"));
		expect(groups).toHaveLength(3);
		expect(groups[0].classList.contains("is-followed-by-default")).toBe(true);
		expect(dom.window.getComputedStyle(groups[0]).marginBottom).toBe("0px");
		expect(groups[1].classList.contains("is-default")).toBe(true);
		expect(groups[1].classList.contains("is-followed-by-default")).toBe(false);
		expect(dom.window.getComputedStyle(groups[1]).marginBottom).toBe("16px");

		const cardTexts = Array.from(document.querySelectorAll(".jotline-card-content")).map((el) => el.textContent);
		expect(cardTexts).toEqual(["Top", "Mid 1", "Last 1"]);
	});

	it("does not apply compact spacing when an adjacent unclassified group is empty", async () => {
		const md = `<!-- group -->
<!-- card -->
Only
`;
		const { store } = await mountWithMarkdown(md);
		// Force empty unclassified groups before and after in memory to test guard condition
		store.doc.update((d) => ({
			...d,
			groups: [
				{ id: "empty-before", name: "", cards: [] },
				...d.groups,
				{ id: "empty-after", name: "", cards: [] },
			],
		}));
		await tick();

		const groups = Array.from(document.querySelectorAll(".jotline-group"));
		expect(groups).toHaveLength(3);
		expect(groups[0].classList.contains("is-followed-by-default")).toBe(false);
		expect(dom.window.getComputedStyle(groups[0]).marginBottom).toBe("16px");
		expect(groups[1].classList.contains("is-followed-by-default")).toBe(false);
		expect(dom.window.getComputedStyle(groups[1]).marginBottom).toBe("16px");
	});
});
