/**
 * @file tableConverter.test.ts
 * @description クリップボードから貼り付けられたTSV/表データのMarkdown表変換単体テスト（Vitest）。
 */

import { describe, it, expect } from "vitest";
import { tsvToMarkdownTable } from "./tableConverter";

describe("tableConverter", () => {
	it("converts TSV text to Markdown table", () => {
		const tsv = `Name\tAge\tCity\nAlice\t30\nBob\t25\tTokyo`;
		const markdownTable = tsvToMarkdownTable(tsv);

		expect(markdownTable).toContain("| Name | Age | City |");
		expect(markdownTable).toContain("| --- | --- | --- |");
		expect(markdownTable).toContain("| Alice | 30 |  |");
		expect(markdownTable).toContain("| Bob | 25 | Tokyo |");
	});

	it("returns unchanged text if it has no tabs", () => {
		const text = "Just a single line of text";
		expect(tsvToMarkdownTable(text)).toBe(text);
	});
});
