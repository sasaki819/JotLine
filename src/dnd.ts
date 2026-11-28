/**
 * @file dnd.ts
 * @description JotLineビューとエディタ（およびJotLineビュー同士）の間のドラッグ＆ドロップで使う、
 * ドラッグ中の情報（ドラッグセッション）・ドロップ位置プレビュー状態・判定ユーティリティ。
 *
 * 【仕組み】:
 * - すべてのビューは同じJavaScript環境で動くため、「今ドラッグされているもの」と「現在のドロップ先プレビュー」を
 *   このモジュールで一元共有します。
 * - ドラッグの開始時（JotLineのカード・スレッドの dragstart、エディタからの dragstart）に `startDrag()` で記録し、
 *   ドラッグの終了時（dragend）に `endDrag()` でドラッグ状態とプレビュー状態をまとめて破棄します。
 * - ドロップ先は `getDragSource()` で元の情報（元のファイル、元を削除するための参照）を取得し、
 *   `dropPreview` ストアを通じてタイムライン上の挿入位置プレビューを単一箇所に追従表示します。
 */

import { writable, type Readable } from "svelte/store";
import type { Editor, EditorPosition } from "obsidian";
import type { JotStore } from "./store";

/**
 * JotLineからのドラッグであることを示す DataTransfer のデータ形式。
 * dragover の時点では中身を読めないため、種類の判定にだけ使います（中身はドラッグセッション側に持ちます）。
 */
export const JOTLINE_DRAG_MIME = "application/x-jotline-drag";

/**
 * ドラッグされているもの。
 * - cards: JotLineのカード（1枚、または複数選択した全カード）
 * - thread: JotLineのスレッド（スレッド名と所属カード）
 * - editor: エディタで選択したテキスト
 *
 * `text` はエディタ・メイン入力欄にドロップされたときに挿入されるテキスト（`text/plain` と同じ内容）。
 * `contents` は別のJotLineビューへ追加するときの、カードごとの本文。
 * `draggedCardId` はドラッグ操作の起点となったカード1枚のID（同一ビュー内の並び替え・ドラッグ中表示に使用）。
 */
export type DragSource =
	| {
			kind: "cards";
			store: JotStore;
			filePath: string;
			cardIds: string[];
			draggedCardId?: string;
			text: string;
			contents: string[];
	  }
	| {
			kind: "thread";
			store: JotStore;
			filePath: string;
			groupId: string;
			name: string;
			text: string;
			contents: string[];
	  }
	| {
			kind: "editor";
			editor: Editor;
			filePath: string;
			from: EditorPosition;
			to: EditorPosition;
			text: string;
	  };

/**
 * タイムライン上に表示するドロップ位置プレビュー。
 * - card: 指定ストア・指定グループ内の `index` 番目スロット（0 .. group.cards.length）へカードを挿入する
 * - thread-after: 指定ストア・指定グループの直後へ新規スレッドを挿入する
 */
export type DropPreview =
	| {
			kind: "card";
			store: JotStore;
			groupId: string;
			index: number;
	  }
	| {
			kind: "thread-after";
			store: JotStore;
			groupId: string;
	  };

/** 現在のドラッグセッション（ドラッグ中でなければ null） */
let currentSource: DragSource | null = null;
/** 現在のドロップ位置プレビュー（表示中でなければ null） */
let currentPreview: DropPreview | null = null;

const dragSourceStore = writable<DragSource | null>(null);
const dropPreviewStore = writable<DropPreview | null>(null);

/** 現在のドラッグセッションを購読するための読み取り専用ストア */
export const activeDragSource: Readable<DragSource | null> = {
	subscribe: dragSourceStore.subscribe,
};

/** 現在のドロップ位置プレビューを購読するための読み取り専用ストア */
export const dropPreview: Readable<DropPreview | null> = {
	subscribe: dropPreviewStore.subscribe,
};

function isSameDropPreview(a: DropPreview | null, b: DropPreview | null): boolean {
	if (a === b) return true;
	if (!a || !b || a.kind !== b.kind) return false;
	if (a.store !== b.store || a.groupId !== b.groupId) return false;
	if (a.kind === "card" && b.kind === "card") {
		return a.index === b.index;
	}
	return true;
}

/**
 * ドラッグセッションを開始します（既存のセッション・プレビューは初期化・上書きします）。
 */
export function startDrag(source: DragSource): void {
	currentSource = source;
	dragSourceStore.set(source);
	setDropPreview(null);
}

/**
 * ドラッグセッションとドロップ位置プレビューを終了します。
 */
export function endDrag(): void {
	currentSource = null;
	dragSourceStore.set(null);
	setDropPreview(null);
}

/**
 * 現在のドラッグセッションを返します（ドラッグ中でなければ null）。
 */
export function getDragSource(): DragSource | null {
	return currentSource;
}

/**
 * 現在のドロップ位置プレビューを返します（表示中でなければ null）。
 */
export function getDropPreview(): DropPreview | null {
	return currentPreview;
}

/**
 * ドロップ位置プレビューを更新します（現在と同一内容であれば通知を省略します）。
 */
export function setDropPreview(preview: DropPreview | null): void {
	if (isSameDropPreview(currentPreview, preview)) return;
	currentPreview = preview;
	dropPreviewStore.set(preview);
}

/**
 * ドロップ位置プレビューを消去します。
 * `filter` を指定した場合は、一致するストア／グループのプレビューが表示中のときだけ消去します。
 */
export function clearDropPreview(filter?: { store: JotStore; groupId?: string }): void {
	if (!currentPreview) return;
	if (filter) {
		if (currentPreview.store !== filter.store) return;
		if (filter.groupId !== undefined && currentPreview.groupId !== filter.groupId) return;
	}
	setDropPreview(null);
}

/**
 * カード要素上のポインタY座標から、カードの直前（`cardIndex`）または直後（`cardIndex + 1`）の挿入スロットを算出します。
 * 要素の高さが 0 以下の場合はフォールバックとして `cardIndex`（直前）を返します。
 */
export function getCardDropSlotIndex(
	clientY: number,
	rect: { top: number; height: number },
	cardIndex: number,
): number {
	if (rect.height <= 0) return cardIndex;
	return clientY < rect.top + rect.height / 2 ? cardIndex : cardIndex + 1;
}

/**
 * ドラッグソースとドロップ先情報から、有効なドロップ位置プレビューを解決します。
 * 無効なドロップ先（ドラッグセッションなし、同一ビューのスレッド、同一ファイルの別ビュー／エディタ）では `null` を返します。
 */
export function resolveDropPreview(
	source: DragSource | null,
	targetStore: JotStore,
	targetGroupId: string,
	targetIndex: number,
): DropPreview | null {
	if (!source) return null;

	if (source.kind === "thread") {
		if (source.store === targetStore || source.filePath === targetStore.file.path) {
			return null;
		}
		return {
			kind: "thread-after",
			store: targetStore,
			groupId: targetGroupId,
		};
	}

	if (source.kind === "cards") {
		if (source.store !== targetStore && source.filePath === targetStore.file.path) {
			return null;
		}
		return {
			kind: "card",
			store: targetStore,
			groupId: targetGroupId,
			index: targetIndex,
		};
	}

	// editor
	if (source.filePath === targetStore.file.path) {
		return null;
	}
	return {
		kind: "card",
		store: targetStore,
		groupId: targetGroupId,
		index: targetIndex,
	};
}

/**
 * ドロップ時の修飾キーから、コピー（元を残す）かどうかを判定します。
 * 既定は移動で、macOS では Option（altKey）、それ以外では Ctrl（ctrlKey）を押していればコピーです。
 *
 * @param event ドロップ時のイベント（修飾キーの状態）
 * @param isMacOS macOS かどうか（呼び出し側は Obsidian の `Platform.isMacOS` を渡す）
 * @returns コピーの場合は true、移動の場合は false
 */
export function isCopyDrop(event: { ctrlKey: boolean; altKey: boolean }, isMacOS: boolean): boolean {
	return isMacOS ? event.altKey : event.ctrlKey;
}
