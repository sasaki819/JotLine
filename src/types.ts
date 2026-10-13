/**
 * JotLine プラグインのデータモデルおよび設定の型定義ファイル。
 * 
 * JotLine は Markdown ファイル内の HTML コメントマーカー（<!-- group -->, <!-- card -->）
 * を境界として扱い、カードとグループ（スレッド）の階層構造を表現します。
 */

/**
 * タイムライン上に表示される最小単位のメモカード。
 */
export interface JotCard {
	/** カードの一意な識別子（ランダム文字列 + タイムスタンプ） */
	id: string;
	/** カードの本文テキスト（Markdown形式） */
	content: string;
}

/**
 * 複数のカードをまとめるグループ（スレッド）。
 * 
 * - `name === ""` の場合: 未分類（デフォルト）のグループとして扱われ、ヘッダーなしのストリーム表示となります。
 * - `name !== ""` の場合: スレッドグループとして扱われ、ヘッダーにスレッド名・各種アクションが表示されます。
 */
export interface JotGroup {
	/** グループの一意な識別子 */
	id: string;
	/** グループ名（スレッド名）。未分類グループの場合は空文字列 "" */
	name: string;
	/** このグループに属するカードのリスト（表示順） */
	cards: JotCard[];
}

/**
 * 1つのMarkdownファイル全体に対応するJotLineドキュメントのルートデータ構造。
 */
export interface JotDocument {
	/** ドキュメントに含まれるグループのリスト（上から順に表示） */
	groups: JotGroup[];
}

/**
 * プラグイン全体の設定項目。
 */
export interface JotLineSettings {
	/** デフォルトのスクラッチパッドとして使用するMarkdownファイルのパス */
	scratchpadPath: string;
	/** スクラッチパッド起動時に対象ファイルが存在しない場合、自動生成するかどうか */
	autoCreateScratchpad: boolean;
}

/**
 * プラグインのデフォルト設定値。
 */
export const DEFAULT_SETTINGS: JotLineSettings = {
	scratchpadPath: "_jotline.md",
	autoCreateScratchpad: true,
};

