/**
 * 表データ（TSV / HTML テーブル）をMarkdownテーブル構文に自動変換するユーティリティ。
 * Excel、Googleスプレッドシート、ウェブページ等からコピー＆ペーストされたデータを
 * 即座にObsidian標準のMarkdownテーブルへ整形して入力欄に挿入できるようにします。
 */

/**
 * TSV文字列（タブ区切りテキスト、ExcelやGoogleスプレッドシートからコピーしたデータ）をMarkdownテーブルに変換します。
 * 
 * 【変換ルール】:
 * - 行数が1行未満、または全行で複数列が存在しない（単なるテキストの改行）場合は変換せず元の文字列を返します。
 * - 各行の列数が不揃いな場合、最大列数に合わせて空文字セルでパディングします。
 * - 1行目をヘッダーとし、2行目に `| --- | --- |` の区切り線を自動生成します。
 * 
 * @param tsv タブ区切りの生テキスト
 * @returns 整形されたMarkdownテーブル文字列（条件を満たさない場合は元のtsv）
 */
export function tsvToMarkdownTable(tsv: string): string {
	const lines = tsv.trim().split(/\r?\n/);
	if (lines.length < 1) return tsv;

	const rows = lines.map((line) => line.split("\t").map((cell) => cell.trim()));
	// 少なくとも1行で複数列（タブ文字）が含まれている場合のみテーブルとして判定
	const hasMultipleCols = rows.some((row) => row.length > 1);
	if (!hasMultipleCols) return tsv;

	const maxCols = Math.max(...rows.map((r) => r.length));
	// 全行の列数を最大列数に揃えるパディング処理
	const normalizedRows = rows.map((r) => {
		const padded = [...r];
		while (padded.length < maxCols) padded.push("");
		return padded;
	});

	const header = normalizedRows[0];
	const separator = header.map(() => "---");
	const dataRows = normalizedRows.slice(1);

	// Markdownテーブル構文（| ヘッダー | ... |）を組み立て
	const markdownLines = [
		`| ${header.join(" | ")} |`,
		`| ${separator.join(" | ")} |`,
		...dataRows.map((row) => `| ${row.join(" | ")} |`),
	];

	return markdownLines.join("\n");
}

/**
 * クリップボードのHTMLデータ（`text/html`）に含まれる `<table>` 要素をMarkdownテーブルに変換します。
 * ウェブブラウザ等からテーブルを範囲選択してコピー＆ペーストした場合に対応します。
 * 
 * 【変換ルール】:
 * - HTML内の `<table>` をDOMParserで抽出し、`<tr>` および `<th>`/`<td>` を走査。
 * - セル内に含まれるパイプ記号 `|` はMarkdownテーブル破損防止のためエスケープ（`\|`）します。
 * - 有効なテーブル構造が存在しない場合は null を返します。
 * 
 * @param html クリップボードから取得したHTML文字列
 * @returns 整形されたMarkdownテーブル文字列、またはテーブル非該当の場合は null
 */
export function htmlTableToMarkdownTable(html: string): string | null {
	const parser = new DOMParser();
	const doc = parser.parseFromString(html, "text/html");
	const table = doc.querySelector("table");
	if (!table) return null;

	const rows: string[][] = [];
	const trElements = Array.from(table.querySelectorAll("tr"));

	for (const tr of trElements) {
		const cells = Array.from(tr.querySelectorAll("th, td"));
		if (cells.length > 0) {
			// Markdownの区切り文字であるパイプ記号（|）をエスケープ
			rows.push(cells.map((c) => (c.textContent || "").trim().replace(/\|/g, "\\|")));
		}
	}

	if (rows.length === 0) return null;

	const maxCols = Math.max(...rows.map((r) => r.length));
	// 単一セルのみの場合は通常のテキスト貼り付けとするため除外
	if (maxCols <= 1 && rows.length <= 1) return null;

	// 列数の正規化パディング
	const normalizedRows = rows.map((r) => {
		const padded = [...r];
		while (padded.length < maxCols) padded.push("");
		return padded;
	});

	const header = normalizedRows[0];
	const separator = header.map(() => "---");
	const dataRows = normalizedRows.slice(1);

	const markdownLines = [
		`| ${header.join(" | ")} |`,
		`| ${separator.join(" | ")} |`,
		...dataRows.map((row) => `| ${row.join(" | ")} |`),
	];

	return markdownLines.join("\n");
}

