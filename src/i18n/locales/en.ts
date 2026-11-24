/**
 * English localization dictionary for JotLine
 */
export default {
	// App Header
	APP_TITLE: "JotLine",
	COPY_ALL: "Copy All",
	COPY_ALL_TOOLTIP: "Copy all notes as Markdown",
	OPEN_IN_EDITOR: "Markdown",
	OPEN_IN_EDITOR_TOOLTIP: "Open in standard Markdown editor",
	UNDO_TOOLTIP: "Undo (Ctrl/Cmd+Z)",
	REDO_TOOLTIP: "Redo (Ctrl/Cmd+Shift+Z)",

	// Empty State
	EMPTY_WELCOME_TITLE: "No notes yet",
	EMPTY_WELCOME_DESC: "Type a thought below to quickly capture it.",

	// Selection Bar & Context Menu
	SELECTED_COUNT: (count: number) => `${count} selected`,
	CLEAR_SELECTION: "Clear selection",
	GROUP_SELECTION: "Group selected cards",
	UNGROUP_SELECTION: "Ungroup (move to unclassified)",
	COPY_SELECTION_TOOLTIP: "Copy selected cards as Markdown",
	DELETE_SELECTION: "Delete selected cards",

	// Context Menu items
	MENU_SEND_TO_GROUP: "Send to group",
	MENU_SEND_TO_GROUP_UNGROUP: "Ungroup",
	MENU_GROUP_MULTI: (count: number) => `Group ${count} selected cards`,
	MENU_UNGROUP_MULTI: (count: number) => `Ungroup ${count} selected cards`,
	MENU_COPY_MULTI: (count: number) => `Copy ${count} selected cards`,
	MENU_DELETE_MULTI: (count: number) => `Delete ${count} selected cards`,
	MENU_CLEAR_SELECTION: "Clear selection",
	MENU_CARD_GROUP: "Group this card",
	MENU_CARD_UNGROUP: "Ungroup (move to unclassified)",
	MENU_CARD_COPY: "Copy as Markdown",
	MENU_CARD_DELETE: "Delete card",

	// Thread / Group
	COLLAPSE_THREAD: "Collapse thread",
	EXPAND_THREAD: "Expand thread",
	RENAME_THREAD: "Rename thread",
	DOUBLE_CLICK_TO_RENAME: "Double-click to rename",
	SAVE: "Save",
	CANCEL: "Cancel",
	UNGROUP_THREAD_TOOLTIP: "Ungroup thread (move to unclassified)",
	COPY_THREAD_TOOLTIP: "Copy thread as Markdown",
	DELETE_THREAD_TOOLTIP: "Delete group and all its cards",
	DROP_CARDS_HERE: "Drop cards here to add to this group",

	// Card Actions
	DRAG_TO_REORDER: "Drag to reorder",
	MOVE_UP: "Move up",
	MOVE_DOWN: "Move down",
	MERGE_UP: "Merge with card above",
	REPLY_THREAD: "Reply in thread",
	EDIT_CARD: "Edit card",
	COPY_CARD: "Copy as Markdown",
	DELETE_CARD: "Delete card",

	// Inline Edit & Reply
	SPLIT_CARD: "Split at cursor",
	SAVE_EDIT: "Save (Ctrl/Cmd+Enter)",
	CANCEL_EDIT: "Cancel (Esc)",
	REPLY_PLACEHOLDER: "Reply in thread... (Enter to send)",
	REPLY_SEND: "Reply",

	// Input Bar
	INPUT_PLACEHOLDER: "Type a memo... (Enter to send, Shift+Enter for new line)",
	SEND_BUTTON: "Send (Enter)",
	RESIZE_HANDLE_TOOLTIP: "Drag to resize input height",

	// Notices
	NOTICE_COPIED_ALL: (count: number) => `Copied all ${count} notes as Markdown`,
	NOTICE_NO_NOTES_TO_COPY: "No notes to copy",
	NOTICE_COPIED_SELECTION: (count: number) => `Copied ${count} cards as Markdown`,
	NOTICE_COPIED_CARD: "Card copied to clipboard",
	NOTICE_COPIED_GROUP: (name: string) => `Group "${name}" copied as Markdown`,
	NOTICE_GROUP_DELETED: (name: string) => `Group "${name}" deleted`,
	NOTICE_MERGED: "Merged with card above",
	NOTICE_NO_CARD_ABOVE: "No card above to merge with",
	NOTICE_CARD_SPLIT: "Card split into two",
	NOTICE_SPLIT_HINT: "Place cursor inside text to split",
	NOTICE_IMAGE_ATTACHED: "Image attached to note",
	NOTICE_IMAGE_FAIL: "Failed to save image attachment",
	NOTICE_DROP_SAME_FILE: "Cannot drop onto the same file",
	NOTICE_MOVE_SOURCE_NOT_REMOVED: "Copied, but could not remove the original",
	NOTICE_DROP_INSERT_UNCONFIRMED: "Could not confirm the insertion; the original was kept",

	// Settings & Commands
	CMD_OPEN_SCRATCHPAD: "Open JotLine scratchpad",
	CMD_OPEN_CURRENT: "Open current note as JotLine",
	CMD_UNDO: "Undo",
	CMD_REDO: "Redo",
	SETTING_SCRATCHPAD_TITLE: "Scratchpad file path",
	SETTING_SCRATCHPAD_DESC: "Path to the Markdown file used as the default JotLine scratchpad.",
	SETTING_AUTO_CREATE_TITLE: "Auto-create scratchpad file",
	SETTING_AUTO_CREATE_DESC: "Automatically create the scratchpad file if it does not exist.",
};
