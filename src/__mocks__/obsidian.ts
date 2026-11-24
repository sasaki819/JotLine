/**
 * @file obsidian.ts
 * @description テスト用の `obsidian` モジュールの代替実装。
 *
 * `obsidian` パッケージは型定義のみで実行時コードを持たないため、
 * Vitest 実行時は vitest.config.mjs の alias でこのファイルに差し替えます。
 * テスト対象が実行時に使うものだけを最小限に定義します。
 */

/** 通知（テストでは何も表示しない） */
export class Notice {
	constructor(_message?: string | DocumentFragment, _duration?: number) {}
}

export type MockMenuEntry =
	| { kind: "item"; item: MockMenuItem }
	| { kind: "separator" };

export const __menuTestState = {
	submenuSupported: true,
	throwOnSubmenu: false,
	throwOnShow: false,
	instances: [] as Menu[],
	reset() {
		this.submenuSupported = true;
		this.throwOnSubmenu = false;
		this.throwOnShow = false;
		this.instances = [];
	},
};

export class MockMenuItem {
	title: string | DocumentFragment = "";
	icon: string | null = null;
	clickHandler: ((evt: MouseEvent | KeyboardEvent) => unknown) | null = null;
	submenu: Menu | null = null;
	setSubmenu?: () => Menu;

	constructor(enableSubmenu: boolean) {
		if (enableSubmenu) {
			this.setSubmenu = () => {
				if (__menuTestState.throwOnSubmenu) {
					throw new Error("submenu failed");
				}
				const sub = new Menu();
				this.submenu = sub;
				return sub;
			};
		}
	}

	setTitle(title: string | DocumentFragment): this {
		this.title = title;
		return this;
	}

	setIcon(icon: string | null): this {
		this.icon = icon;
		return this;
	}

	onClick(cb: (evt: MouseEvent | KeyboardEvent) => unknown): this {
		this.clickHandler = cb;
		return this;
	}

	async triggerClick(evt = {} as MouseEvent): Promise<void> {
		if (this.clickHandler) {
			await this.clickHandler(evt);
		}
	}
}

export class Menu {
	entries: MockMenuEntry[] = [];
	hidden = false;
	shownEvents: MouseEvent[] = [];

	constructor() {
		__menuTestState.instances.push(this);
	}

	addItem(cb: (item: MockMenuItem) => unknown): this {
		const item = new MockMenuItem(__menuTestState.submenuSupported);
		this.entries.push({ kind: "item", item });
		cb(item);
		return this;
	}

	addSeparator(): this {
		this.entries.push({ kind: "separator" });
		return this;
	}

	hide(): this {
		this.hidden = true;
		return this;
	}

	showAtMouseEvent(evt: MouseEvent): this {
		if (__menuTestState.throwOnShow) {
			throw new Error("show failed");
		}
		this.shownEvents.push(evt);
		return this;
	}
}
