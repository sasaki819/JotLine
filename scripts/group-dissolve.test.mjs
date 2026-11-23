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

describe("thread header dissolve action", () => {
	let directory, dom, GroupView, JotStore, tick, get, component, unsubscribe, vault, store;

	beforeAll(async () => {
		directory = await mkdtemp(join(tmpdir(), "jotline-dissolve-test-"));
		const output = join(directory, "group.cjs");
		await build({
			stdin: {
				contents:
					'export {default as GroupView} from "./src/ui/GroupView.svelte"; export {JotStore} from "./src/store.ts"; export {tick} from "svelte"; export {get} from "svelte/store";',
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
							contents:
								"export class Notice {} export class Component {} export const MarkdownRenderer = {}; export const Platform = {}; export function setIcon(el, name) { el.dataset.icon = name; }",
						}));
					},
				},
				sveltePlugin({ preprocess: sveltePreprocess(), compilerOptions: { css: "injected" } }),
			],
		});
		dom = new JSDOM('<body><main></main></body>', { url: "https://test.local" });
		for (const key of ["window", "document", "navigator", "HTMLElement", "Element", "Node"]) {
			vi.stubGlobal(key, dom.window[key]);
		}
		({ GroupView, JotStore, tick, get } = createRequire(import.meta.url)(output));
	});

	beforeEach(async () => {
		const initial = `<!-- group -->
<!-- card -->
Top

<!-- group: mid -->
<!-- card -->
Mid 1

<!-- card -->
Mid 2

<!-- group: last -->
<!-- card -->
Last
`;
		vault = {
			read: vi.fn(async () => initial),
			modify: vi.fn(async () => {}),
			on: vi.fn(() => ({})),
		};
		store = new JotStore({ vault }, { path: "test.md" });
		await store.init();
		const midGroup = get(store.doc).groups[1];
		component = new GroupView({
			target: document.querySelector("main"),
			props: { group: { ...midGroup, cards: [] }, store, app: {} },
		});
		unsubscribe = store.doc.subscribe((doc) => {
			const current = doc.groups.find((g) => g.id === midGroup.id);
			if (current) {
				component.$set({ group: { ...current, cards: [] } });
			}
		});
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

	it("dissolves the thread in place via store.dissolveGroup and keeps cards before later groups", async () => {
		const dissolveButton = document.querySelector('.jotline-group-actions button[data-icon="folder-minus"]');
		expect(dissolveButton).not.toBeNull();

		dissolveButton.dispatchEvent(new dom.window.MouseEvent("click", { bubbles: true }));
		await tick();
		await Promise.resolve();

		expect(vault.modify).toHaveBeenCalledTimes(1);
		expect(get(store.doc).groups.map((g) => ({ name: g.name, cards: g.cards.map((c) => c.content) }))).toEqual([
			{ name: "", cards: ["Top"] },
			{ name: "", cards: ["Mid 1", "Mid 2"] },
			{ name: "last", cards: ["Last"] },
		]);
		expect(vault.modify.mock.calls[0][1]).toBe(`<!-- group -->
<!-- card -->
Top

<!-- group -->
<!-- card -->
Mid 1

<!-- card -->
Mid 2

<!-- group: last -->
<!-- card -->
Last
`);
	});
});
