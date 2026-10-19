import { Plugin, Notice, TFile, WorkspaceLeaf, Menu } from "obsidian";
import { DEFAULT_SETTINGS, JotLineSettings } from "./types";
import { JotLineSettingTab } from "./settings";
import { JotLineView, VIEW_TYPE_JOTLINE } from "./ui/JotLineView";
import { JOTLINE_README_CONTENT } from "./templates/readmeTemplate";
import { t } from "./i18n";

/**
 * JotLine プラグインのメインクラス。
 * 
 * 【主な責務】:
 * 1. プラグインのライフサイクル管理（ロード時の設定初期化、ビュー登録、イベント登録）。
 * 2. コマンドパレット・リボンアイコン・ファイルコンテキストメニューへのアクション登録。
 * 3. スクラッチパッド（`_jotline.md`）およびAI向け仕様書（`_jotline.readme.md`）の自動生成。
 * 4. 任意ノートおよびスクラッチパッドのJotLineビュー（ItemView）起動・切り替え。
 */
export default class JotLinePlugin extends Plugin {
	/** プラグインの設定状態 */
	settings: JotLineSettings = DEFAULT_SETTINGS;

	/**
	 * プラグイン有効化時の初期化処理。
	 */
	async onload() {
		// 保存された設定データを読み込み
		await this.loadSettings();

		// Vaultレイアウトの準備完了時に初期ファイル（_jotline.md, _jotline.readme.md）を自動生成
		if (this.settings.autoCreateScratchpad) {
			this.app.workspace.onLayoutReady(() => {
				this.initDefaultFiles();
			});
		}

		// 設定画面タブを登録
		this.addSettingTab(new JotLineSettingTab(this.app, this));

		// JotLine専用のカスタムItemView（Svelteアプリをホスト）を登録
		this.registerView(VIEW_TYPE_JOTLINE, (leaf) => new JotLineView(leaf, this));

		// 左側リボンにクイックアクセス用アイコン（吹き出しアイコン）を追加
		this.addRibbonIcon("message-square", t("CMD_OPEN_SCRATCHPAD"), () => {
			this.openScratchpad();
		});

		// コマンド登録: デフォルトスクラッチパッドを開く
		this.addCommand({
			id: "open-scratchpad",
			name: t("CMD_OPEN_SCRATCHPAD"),
			callback: () => {
				this.openScratchpad();
			},
		});

		// コマンド登録: 現在アクティブなMarkdownノートをJotLineビューとして開く
		this.addCommand({
			id: "open-active-as-jotline",
			name: t("CMD_OPEN_CURRENT"),
			checkCallback: (checking: boolean) => {
				const activeFile = this.app.workspace.getActiveFile();
				if (activeFile && activeFile.extension === "md") {
					if (!checking) {
						this.openFileAsJotLine(activeFile, false);
					}
					return true;
				}
				return false;
			},
		});

		// ファイルツリーやタブヘッダーの右クリックメニューに「Open as JotLine」を追加
		this.registerEvent(
			this.app.workspace.on("file-menu", (menu: Menu, file) => {
				if (file instanceof TFile && file.extension === "md") {
					menu.addItem((item) => {
						item
							.setTitle(t("CMD_OPEN_CURRENT"))
							.setIcon("message-square")
							.onClick(() => {
								this.openFileAsJotLine(file, false);
							});
					});
				}
			})
		);

		console.log("JotLine plugin loaded");
	}

	/**
	 * プラグイン無効化時の終了処理。
	 */
	onunload() {
		console.log("JotLine plugin unloaded");
	}

	/**
	 * 保存された設定を読み込み、デフォルト設定とマージします。
	 */
	async loadSettings() {
		this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
	}

	/**
	 * 現在の設定をストレージへ保存します。
	 */
	async saveSettings() {
		await this.saveData(this.settings);
	}

	/**
	 * Vault内にスクラッチパッド（`_jotline.md`）およびAI向け仕様書（`_jotline.readme.md`）が
	 * 存在しない場合、初期テンプレートを自動作成します。
	 */
	async initDefaultFiles() {
		// 1. スクラッチパッドファイルの初期生成
		const scratchPath = this.settings.scratchpadPath.trim() || "_jotline.md";
		const scratchFile = this.app.vault.getAbstractFileByPath(scratchPath);
		if (!scratchFile) {
			try {
				await this.app.vault.create(scratchPath, "<!-- group -->\n");
				console.log(`JotLine: Created default scratchpad ${scratchPath}`);
			} catch (err) {
				console.error("JotLine: Failed to auto-create scratchpad", err);
			}
		}

		// 2. AI・LLMエージェント向け仕様ガイドファイルの初期生成
		const readmePath = "_jotline.readme.md";
		const readmeFile = this.app.vault.getAbstractFileByPath(readmePath);
		if (!readmeFile) {
			try {
				await this.app.vault.create(readmePath, JOTLINE_README_CONTENT);
				console.log(`JotLine: Created specification readme ${readmePath}`);
			} catch (err) {
				console.error("JotLine: Failed to auto-create readme", err);
			}
		}
	}

	/**
	 * スクラッチパッドのTFileを取得し、存在しなければ設定に応じて自動作成します。
	 */
	async getOrCreateScratchpadFile(): Promise<TFile | null> {
		if (this.settings.autoCreateScratchpad) {
			await this.initDefaultFiles();
		}
		const path = this.settings.scratchpadPath.trim() || "_jotline.md";
		const abstractFile = this.app.vault.getAbstractFileByPath(path);

		if (abstractFile instanceof TFile) {
			return abstractFile;
		}

		if (this.settings.autoCreateScratchpad) {
			try {
				const newFile = await this.app.vault.create(path, "<!-- group -->\n");
				new Notice(`Created scratchpad: ${path}`);
				return newFile;
			} catch (err) {
				console.error("Failed to create scratchpad file", err);
				new Notice(`Failed to create scratchpad file: ${path}`);
				return null;
			}
		} else {
			new Notice(`Scratchpad file "${path}" does not exist. Enable auto-create in settings.`);
			return null;
		}
	}

	/**
	 * スクラッチパッドを右サイドバー（または既存のタブ）で開きます。
	 */
	async openScratchpad() {
		const file = await this.getOrCreateScratchpadFile();
		if (!file) return;

		// 既に同一ファイルを開いているJotLineビューがあれば再利用
		let leaf: WorkspaceLeaf | null | undefined = this.app.workspace.getLeavesOfType(VIEW_TYPE_JOTLINE).find((l) => {
			const view = l.view as JotLineView;
			return view.file?.path === file.path;
		});

		if (!leaf) {
			// 右サイドバーに新しいリーフを確保
			leaf = this.app.workspace.getRightLeaf(false);
			if (leaf) {
				await leaf.setViewState({
					type: VIEW_TYPE_JOTLINE,
					active: true,
				});
			}
		}

		if (leaf) {
			this.app.workspace.revealLeaf(leaf);
			const view = leaf.view as JotLineView;
			await view.setFile(file);
		}
	}

	/**
	 * 任意のMarkdownファイルをJotLineビューとして開きます。
	 * 
	 * @param file 対象のTFile
	 * @param inSidebar true の場合は右サイドバー、false の場合はメインエディタ領域で開く
	 */
	async openFileAsJotLine(file: TFile, inSidebar = false) {
		let leaf: WorkspaceLeaf | null = null;

		if (inSidebar) {
			leaf = this.app.workspace.getRightLeaf(false);
		} else {
			// 現在のアクティブなペイン（または新しいタブ）を使用
			leaf = this.app.workspace.getLeaf(false);
		}

		if (leaf) {
			await leaf.setViewState({
				type: VIEW_TYPE_JOTLINE,
				active: true,
			});
			this.app.workspace.revealLeaf(leaf);
			const view = leaf.view as JotLineView;
			await view.setFile(file);
		}
	}
}

