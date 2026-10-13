/**
 * Japanese localization dictionary for JotLine
 */
import type en from "./en";

const ja: typeof en = {
	// App Header
	APP_TITLE: "JotLine",
	COPY_ALL: "全件コピー",
	COPY_ALL_TOOLTIP: "すべてのメモをMarkdownとしてコピー",
	OPEN_IN_EDITOR: "エディタ",
	OPEN_IN_EDITOR_TOOLTIP: "通常のMarkdownエディタで開く",

	// Empty State
	EMPTY_WELCOME_TITLE: "まだメモがありません",
	EMPTY_WELCOME_DESC: "下の入力欄に考えを入力して、すばやく記録しましょう。",

	// Selection Bar & Context Menu
	SELECTED_COUNT: (count: number) => `${count}件を選択中`,
	CLEAR_SELECTION: "選択を解除",
	GROUP_SELECTION: "選択したカードをグループ化",
	GROUP_SELECTION_DISABLED: "グループ化（2枚以上選択）",
	UNGROUP_SELECTION: "グループ化を解除（未分類に戻す）",
	COPY_SELECTION: "選択したカードをコピー",
	COPY_SELECTION_TOOLTIP: "選択したカードをMarkdownとしてコピー",
	DELETE_SELECTION: "選択したカードを削除",

	// Context Menu items
	MENU_GROUP_MULTI: (count: number) => `選択した${count}枚をグループ化`,
	MENU_UNGROUP_MULTI: (count: number) => `選択した${count}枚のグループ化を解除`,
	MENU_COPY_MULTI: (count: number) => `選択した${count}枚をMarkdownコピー`,
	MENU_DELETE_MULTI: (count: number) => `選択した${count}枚を削除`,
	MENU_CLEAR_SELECTION: "選択を解除",
	MENU_CARD_GROUP: "このカードをグループ化",
	MENU_CARD_UNGROUP: "グループ化を解除（未分類に戻す）",
	MENU_CARD_COPY: "Markdownとしてコピー",
	MENU_CARD_DELETE: "カードを削除",

	// Thread / Group
	COLLAPSE_THREAD: "スレッドを折りたたむ",
	EXPAND_THREAD: "スレッドを展開する",
	RENAME_THREAD: "スレッド名を変更",
	DOUBLE_CLICK_TO_RENAME: "ダブルクリックで名前変更",
	SAVE: "保存",
	CANCEL: "キャンセル",
	UNGROUP_THREAD_TOOLTIP: "グループ化を解除（未分類に戻す）",
	COPY_THREAD_TOOLTIP: "スレッドをMarkdownとしてコピー",
	DELETE_THREAD_TOOLTIP: "グループを削除（所属カードもすべて削除）",
	DROP_CARDS_HERE: "ここにカードをドロップして追加",

	// Card Actions
	DRAG_TO_REORDER: "ドラッグして並べ替え",
	MOVE_UP: "上へ移動",
	MOVE_DOWN: "下へ移動",
	MERGE_UP: "上のカードと統合",
	REPLY_THREAD: "返信してスレッド化",
	EDIT_CARD: "編集",
	COPY_CARD: "Markdownとしてコピー",
	DELETE_CARD: "カードを削除",

	// Inline Edit & Reply
	SPLIT_CARD: "カーソル位置で分割",
	SAVE_EDIT: "保存 (Ctrl/Cmd+Enter)",
	CANCEL_EDIT: "キャンセル (Esc)",
	REPLY_PLACEHOLDER: "返信を入力... (Enterで送信)",
	REPLY_SEND: "返信",

	// Input Bar
	INPUT_PLACEHOLDER: "メモを入力... (Enterで送信、Shift+Enterで改行)",
	SEND_BUTTON: "送信 (Enter)",
	RESIZE_HANDLE_TOOLTIP: "ドラッグして入力欄の高さを変更",

	// Notices
	NOTICE_COPIED_ALL: (count: number) => `全${count}件のメモをコピーしました`,
	NOTICE_NO_NOTES_TO_COPY: "コピーするメモがありません",
	NOTICE_COPIED_SELECTION: (count: number) => `選択した${count}件のメモをコピーしました`,
	NOTICE_COPIED_CARD: "カードをクリップボードにコピーしました",
	NOTICE_COPIED_GROUP: (name: string) => `スレッド「${name}」をコピーしました`,
	NOTICE_GROUP_DELETED: (name: string) => `グループ「${name}」を削除しました`,
	NOTICE_MERGED: "上のカードと統合しました",
	NOTICE_NO_CARD_ABOVE: "統合できる上のカードがありません",
	NOTICE_CARD_SPLIT: "カードを2つに分割しました",
	NOTICE_SPLIT_HINT: "分割するにはテキスト内にカーソルを置いてください",
	NOTICE_IMAGE_ATTACHED: "画像をノートに添付しました",
	NOTICE_IMAGE_FAIL: "画像の保存に失敗しました",

	// Settings & Commands
	CMD_OPEN_SCRATCHPAD: "JotLine スクラッチパッドを開く",
	CMD_OPEN_CURRENT: "現在のノートをJotLineとして開く",
	SETTING_SCRATCHPAD_TITLE: "スクラッチパッド用ファイルパス",
	SETTING_SCRATCHPAD_DESC: "デフォルトのJotLineスクラッチパッドとして使用するMarkdownファイルのパス。",
	SETTING_SEND_SHORTCUT_TITLE: "送信ショートカット",
	SETTING_SEND_SHORTCUT_DESC: "入力欄からメモを送信するためのキーボードショートカット。",
	SETTING_AUTO_CREATE_TITLE: "ファイルの自動生成",
	SETTING_AUTO_CREATE_DESC: "スクラッチパッド用ファイルが存在しない場合に自動生成します。",
	SETTING_RECREATE_README_TITLE: "AI向けREADMEの再生成",
	SETTING_RECREATE_README_DESC: "Vaultルートに _jotline.readme.md を生成または上書きします。",
	SETTING_RECREATE_README_BTN: "READMEを生成",
	NOTICE_README_CREATED: "_jotline.readme.md をVault直下に生成しました。",
};

export default ja;
