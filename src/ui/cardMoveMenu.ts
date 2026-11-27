/**
 * @file cardMoveMenu.ts
 * @description カードの右クリックメニューへ「グループへ移動（Send to group）」を追加するヘルパー。
 *
 * 【互換性方針】
 * - 公開型定義にない `MenuItem.setSubmenu()` はこのファイル内だけで狭く型付けし、
 *   実行時に関数として提供される環境ではネイティブのサブメニューを使用する。
 * - 提供されない環境では、親項目クリック時に親メニューを閉じ、同じ候補と「グループ解除」を持つ
 *   子 `Menu` を初回右クリック位置（`showAtMouseEvent()`）へ表示する。
 */

import { Menu, type MenuItem } from "obsidian";
import type { JotGroup } from "../types";
import { t } from "../i18n";

export interface CardMoveMenuCallbacks {
	onMoveToGroup: (cardIds: string[], targetGroupId: string) => void | Promise<void>;
	onUngroup: (cardIds: string[]) => void | Promise<void>;
}

type MenuItemWithSubmenu = MenuItem & {
	setSubmenu?: () => Menu;
};

/**
 * カードの右クリックメニューに「グループへ移動（Send to group）」と移動先候補を追加します。
 *
 * @param menu 追加先の親メニュー
 * @param groups 現在のドキュメント上のグループ一覧（表示順）
 * @param cardIds 移動対象となるカードIDの配列
 * @param callbacks 移動先・グループ解除選択時のコールバック
 * @param event 元の右クリック MouseEvent（サブメニュー未対応環境で子メニュー位置に利用）
 */
export function addCardMoveMenu(
	menu: Menu,
	groups: readonly JotGroup[],
	cardIds: readonly string[],
	callbacks: CardMoveMenuCallbacks,
	event: MouseEvent
): void {
	if (cardIds.length === 0) return;

	const targetIds = [...cardIds];
	const namedGroups = groups
		.filter((group) => group.name !== "")
		.map((group) => ({ id: group.id, name: group.name }));

	const populateTargetMenu = (targetMenu: Menu) => {
		for (const group of namedGroups) {
			targetMenu.addItem((subItem) =>
				subItem
					.setTitle(group.name)
					.setIcon("folder")
					.onClick(async () => {
						await callbacks.onMoveToGroup([...targetIds], group.id);
					})
			);
		}
		if (namedGroups.length > 0) {
			targetMenu.addSeparator();
		}
		targetMenu.addItem((subItem) =>
			subItem
				.setTitle(t("MENU_SEND_TO_GROUP_UNGROUP"))
				.setIcon("folder-minus")
				.onClick(async () => {
					await callbacks.onUngroup([...targetIds]);
				})
		);
	};

	menu.addItem((item) => {
		item.setTitle(t("MENU_SEND_TO_GROUP")).setIcon("folder-input");

		const submenuItem = item as MenuItemWithSubmenu;
		if (typeof submenuItem.setSubmenu === "function") {
			try {
				const submenu = submenuItem.setSubmenu();
				if (submenu && typeof submenu.addItem === "function") {
					populateTargetMenu(submenu);
					return;
				}
			} catch (err) {
				console.error("JotLine: Failed to build card move submenu", err);
			}
		}

		item.onClick(() => {
			try {
				menu.hide();
				const childMenu = new Menu();
				populateTargetMenu(childMenu);
				childMenu.showAtMouseEvent(event);
			} catch (err) {
				console.error("JotLine: Failed to open card move menu", err);
			}
		});
	});
}
