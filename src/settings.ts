import { App, PluginSettingTab, Setting } from "obsidian";
import type JotLinePlugin from "./main";
import { t } from "./i18n";

/**
 * JotLine プラグインの設定画面（Settings Tab）クラス。
 * 
 * Obsidian の「設定」→「コミュニティプラグイン」→「JotLine」から開かれ、
 * ユーザーがスクラッチパッドのファイルパスや自動生成挙動をカスタマイズできるようにします。
 */
export class JotLineSettingTab extends PluginSettingTab {
	plugin: JotLinePlugin;

	constructor(app: App, plugin: JotLinePlugin) {
		super(app, plugin);
		this.plugin = plugin;
	}

	/**
	 * 設定タブのUIを描画します。
	 */
	display(): void {
		const { containerEl } = this;
		containerEl.empty();

		containerEl.createEl("h2", { text: t("APP_TITLE") + " Settings" });

		// 1. スクラッチパッド用ファイルパス設定
		new Setting(containerEl)
			.setName(t("SETTING_SCRATCHPAD_TITLE"))
			.setDesc(t("SETTING_SCRATCHPAD_DESC"))
			.addText((text) =>
				text
					.setPlaceholder("_jotline.md")
					.setValue(this.plugin.settings.scratchpadPath)
					.onChange(async (value) => {
						// 空白の場合はデフォルトの _jotline.md を適用
						this.plugin.settings.scratchpadPath = value.trim() || "_jotline.md";
						await this.plugin.saveSettings();
					})
			);

		// 2. スクラッチパッド非存在時の自動生成トグル
		new Setting(containerEl)
			.setName(t("SETTING_AUTO_CREATE_TITLE"))
			.setDesc(t("SETTING_AUTO_CREATE_DESC"))
			.addToggle((toggle) =>
				toggle
					.setValue(this.plugin.settings.autoCreateScratchpad)
					.onChange(async (value) => {
						this.plugin.settings.autoCreateScratchpad = value;
						await this.plugin.saveSettings();
					})
			);
	}
}

