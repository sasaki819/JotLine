/**
 * @file dnd.ts
 * @description JotLineビューとエディタ（およびJotLineビュー同士）の間のドラッグ＆ドロップで使う、
 * ドラッグ中の情報（ドラッグセッション）の保持と判定ユーティリティ。
 *
 * 【仕組み】:
 * - すべてのビューは同じJavaScript環境で動くため、「今ドラッグされているもの」をこのモジュールの変数1つで共有します。
 * - ドラッグの開始時（JotLineのカード・スレッドの dragstart、エディタからの dragstart）に `startDrag()` で記録し、
 *   ドラッグの終了時（dragend）に `endDrag()` で破棄します。
 * - ドロップ先は `getDragSource()` で元の情報（元のファイル、元を削除するための参照）を取得します。
 */

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
 */
export type DragSource =
	| {
			kind: "cards";
			store: JotStore;
			filePath: string;
			cardIds: string[];
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

/** 現在のドラッグセッション（ドラッグ中でなければ null） */
let currentSource: DragSource | null = null;

/**
 * ドラッグセッションを開始します（既存のセッションは上書きします）。
 */
export function startDrag(source: DragSource): void {
	currentSource = source;
}

/**
 * ドラッグセッションを終了します。
 */
export function endDrag(): void {
	currentSource = null;
}

/**
 * 現在のドラッグセッションを返します（ドラッグ中でなければ null）。
 */
export function getDragSource(): DragSource | null {
	return currentSource;
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
