import { Plugin, Notice, TFile, WorkspaceLeaf, Menu, Platform, MarkdownView, type Editor, type MarkdownFileInfo } from "obsidian";
import { get } from "svelte/store";
import { DEFAULT_SETTINGS, JotLineSettings } from "./types";
import { JotLineSettingTab } from "./settings";
import { JotLineView, VIEW_TYPE_JOTLINE } from "./ui/JotLineView";
import { JOTLINE_README_CONTENT } from "./templates/readmeTemplate";
import { t } from "./i18n";
import { getDragSource, startDrag, endDrag, isCopyDrop, JOTLINE_DRAG_MIME, type DragSource } from "./dnd";

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

		// コマンド登録: アクティブなJotLineビューでアンドゥ／リドゥ（既定のホットキーは設定しない）
		this.addCommand({
			id: "jotline-undo",
			name: t("CMD_UNDO"),
			checkCallback: (checking: boolean) => this.runHistoryCommand("undo", checking),
		});
		this.addCommand({
			id: "jotline-redo",
			name: t("CMD_REDO"),
			checkCallback: (checking: boolean) => this.runHistoryCommand("redo", checking),
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

		// JotLineのカード・スレッドがエディタへドロップされたときの処理（同じファイルの禁止、移動時の元の削除）
		this.registerEvent(
			this.app.workspace.on("editor-drop", (evt, editor, info) => {
				this.handleEditorDrop(evt, editor, info);
			})
		);

		// エディタからのドラッグの開始・終了を監視（ドラッグセッションの記録・破棄）。
		// キャプチャ段階で受けるため、JotLineのカード・スレッドのドラッグ開始処理（バブリング段階）より先に実行される。
		this.registerDomEvent(document, "dragstart", (evt) => this.handleDocumentDragStart(evt), { capture: true });
		this.registerDomEvent(document, "dragend", () => endDrag(), { capture: true });

		console.log("JotLine plugin loaded");
	}

	/**
	 * プラグイン無効化時の終了処理。
	 */
	onunload() {
		console.log("JotLine plugin unloaded");
	}

	/**
	 * アンドゥ／リドゥコマンドの checkCallback。
	 * アクティブなビューがJotLineビューで、実行できる履歴がある場合だけ有効にします。
	 *
	 * @param action "undo" または "redo"
	 * @param checking true の場合は実行可否の判定のみ
	 * @returns コマンドを実行可能な場合は true
	 */
	private runHistoryCommand(action: "undo" | "redo", checking: boolean): boolean {
		const store = this.app.workspace.getActiveViewOfType(JotLineView)?.store;
		if (!store) return false;
		const state = get(store.historyState);
		if (!(action === "undo" ? state.canUndo : state.canRedo)) return false;
		if (!checking) {
			if (action === "undo") {
				store.undo();
			} else {
				store.redo();
			}
		}
		return true;
	}

	/**
	 * ドラッグの開始を監視し、エディタ（ソースモード／ライブプレビュー）で選択したテキストのドラッグであれば、
	 * ドラッグセッションを開始します。
	 *
	 * まず前のセッションを破棄します。JotLineのカード・スレッドのドラッグの場合は、
	 * この後に各コンポーネントがセッションを開始します。
	 */
	private handleDocumentDragStart(evt: DragEvent) {
		endDrag();
		const target = evt.target;
		if (!(target instanceof Node)) return;

		for (const leaf of this.app.workspace.getLeavesOfType("markdown")) {
			const view = leaf.view;
			if (!(view instanceof MarkdownView) || !view.containerEl.contains(target)) continue;
			// 読み取りビューからのドラッグは対象外
			if (view.getMode() !== "source" || !view.file) return;

			const editor = view.editor;
			const from = editor.getCursor("from");
			const to = editor.getCursor("to");
			const text = editor.getRange(from, to);
			// 選択範囲が空（リンクやファイルのドラッグなど）は対象外
			if (!text) return;

			startDrag({ kind: "editor", editor, filePath: view.file.path, from, to, text });
			return;
		}
	}

	/**
	 * JotLineのカード・スレッドがエディタへドロップされたときの処理。
	 *
	 * - 挿入そのものは、エディタの標準動作（`text/plain` の挿入）に任せます。
	 * - ドロップ先がドラッグ元と同じファイルなら、挿入を止めて通知します。
	 * - 移動（修飾キーなし）の場合は、エディタの挿入が終わった後で挿入を確かめ、元のJotLineビューから削除します。
	 */
	private handleEditorDrop(evt: DragEvent, editor: Editor, info: MarkdownView | MarkdownFileInfo) {
		if (evt.defaultPrevented) return;
		const source = getDragSource();
		if (!source || source.kind === "editor") return;
		if (!evt.dataTransfer?.types.includes(JOTLINE_DRAG_MIME)) return;

		if (info.file?.path === source.filePath) {
			evt.preventDefault();
			new Notice(t("NOTICE_DROP_SAME_FILE"));
			return;
		}

		if (isCopyDrop(evt, Platform.isMacOS)) return;

		// エディタの挿入処理が終わった後で、挿入を確かめてから元を削除する
		window.setTimeout(() => {
			this.removeMovedSource(source, editor);
		}, 0);
	}

	/**
	 * エディタへ移動したJotLineのカード・スレッドを、元のJotLineビューから削除します。
	 * 挿入したテキストが空の場合（何も挿入されない）や、エディタの内容に含まれていない場合は、元を削除しません。
	 */
	private async removeMovedSource(source: Exclude<DragSource, { kind: "editor" }>, editor: Editor) {
		if (!source.text || !editor.getValue().includes(source.text)) {
			new Notice(t("NOTICE_DROP_INSERT_UNCONFIRMED"));
			return;
		}
		const removed =
			source.kind === "cards"
				? await source.store.removeCards(source.cardIds)
				: await source.store.removeGroup(source.groupId);
		if (!removed) {
			new Notice(t("NOTICE_MOVE_SOURCE_NOT_REMOVED"));
		}
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

