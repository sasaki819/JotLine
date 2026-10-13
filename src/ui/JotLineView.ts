import { ItemView, WorkspaceLeaf, TFile } from "obsidian";
import type JotLinePlugin from "../main";
import { JotStore } from "../store";
import App from "./App.svelte";

/** JotLineカスタムビューの一意なタイプ識別子 */
export const VIEW_TYPE_JOTLINE = "jotline-view";

/**
 * Obsidian の Workspace 上で JotLine UI を表示するためのカスタム ItemView。
 * 
 * 【仕組みと役割】:
 * 1. Obsidian の `ItemView` を継承し、ペイン（メインタブやサイドバー）のDOMライフサイクルを管理。
 * 2. 表示対象の Markdown ファイル（`TFile`）ごとに `JotStore` を初期化。
 * 3. `contentEl` 内にルートの Svelte アプリケーション（`App.svelte`）をマウント。
 * 4. ファイル切り替えやビュークローズ時に Svelte アプリとストアを安全にアンマウント/破棄。
 */
export class JotLineView extends ItemView {
	plugin: JotLinePlugin;
	store: JotStore | null = null;
	svelteApp: App | null = null;
	file: TFile | null = null;

	constructor(leaf: WorkspaceLeaf, plugin: JotLinePlugin) {
		super(leaf);
		this.plugin = plugin;
	}

	/**
	 * ビューの識別タイプ名を返します。
	 */
	getViewType(): string {
		return VIEW_TYPE_JOTLINE;
	}

	/**
	 * タブヘッダー等に表示される表示名。開いているノートのファイル名を表示します。
	 */
	getDisplayText(): string {
		return this.file ? `JotLine: ${this.file.basename}` : "JotLine";
	}

	/**
	 * タブアイコン（吹き出しメッセージアイコン）。
	 */
	getIcon(): string {
		return "message-square";
	}

	/**
	 * 表示対象のMarkdownファイルを設定し、ストアとSvelteアプリを初期化・マウントします。
	 * 既存のコンポーネントがある場合は安全にクリーンアップした上で再生成します。
	 * 
	 * @param file 表示対象のTFile
	 */
	async setFile(file: TFile) {
		this.file = file;

		// 既存のSvelteコンポーネントとストアをクリーンアップ
		if (this.svelteApp) {
			this.svelteApp.$destroy();
			this.svelteApp = null;
		}
		if (this.store) {
			this.store.destroy();
			this.store = null;
		}

		// 新しいストアを初期化してファイル読み込み
		this.store = new JotStore(this.app, file);
		await this.store.init();

		// コンテナ要素をクリアしてSvelteアプリをマウント
		this.contentEl.empty();
		this.svelteApp = new App({
			target: this.contentEl,
			props: {
				store: this.store,
				app: this.app,
			},
		});
	}

	/**
	 * ビューが閉じられた際のクリーンアップ処理。
	 */
	async onClose() {
		if (this.svelteApp) {
			this.svelteApp.$destroy();
			this.svelteApp = null;
		}
		if (this.store) {
			this.store.destroy();
			this.store = null;
		}
	}
}

