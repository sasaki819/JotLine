import { setIcon } from "obsidian";

/**
 * Obsidian / Lucide の SVG アイコンを任意の HTML 要素に描画する Svelte Action。
 * 
 * 【仕組みと背景】:
 * - Obsidian は `setIcon(element, iconId)` という公式ヘルパーを提供しており、
 *   指定した親要素の中に Lucide アイコンの `<svg>` 要素をレンダリングします。
 * - Svelte の action (`use:icon={"folder-plus"}`) としてラップすることで、
 *   コンポーネントのマウント時、アイコン名変更時、アンマウント時の要素クリーンアップを
 *   宣言的かつ安全に管理できます。
 * 
 * @param node アイコンを挿入する対象のHTMLElement
 * @param iconName ObsidianのIconName（例: "folder-plus", "folder-minus", "copy", "trash", "x" 等）
 */
export function icon(node: HTMLElement, iconName: string) {
	// 初回マウント時にアイコンを描画
	setIcon(node, iconName);

	return {
		/**
		 * Svelte 側で iconName が動的に変更された場合の更新処理
		 */
		update(newIcon: string) {
			if (typeof (node as any).empty === "function") {
				(node as any).empty();
			} else {
				node.innerHTML = "";
			}
			setIcon(node, newIcon);
		},
		/**
		 * コンポーネント破棄時のクリーンアップ処理
		 */
		destroy() {
			if (typeof (node as any).empty === "function") {
				(node as any).empty();
			} else {
				node.innerHTML = "";
			}
		}
	};
}

