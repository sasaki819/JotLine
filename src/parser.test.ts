/**
 * @file parser.test.ts
 * @description JotLineパーサー・シリアライザー・カード操作ロジックの単体テスト（Vitest）。
 * 
 * 【検証項目】
 * - 空文字やマーカーなし通常Markdownのセーフパース（Failsafe）
 * - 要件定義サンプルのパースと往復シリアライズ（等価性検証）
 * - 純粋Markdownエクスポート
 * - Splitの完全な逆操作としての直前カード統合（mergeCardWithPrevious）
 * - 複数カードのグループ化（groupSelectedCards）、グループ解除（ungroupCards）、名前変更（renameGroup）
 */

import { describe, it, expect } from "vitest";
import {
	parseJotDocument,
	serializeJotDocument,
	exportToPureMarkdown,
	mergeCardWithPrevious,
	groupSelectedCards,
	ungroupCards,
	renameGroup,
} from "./parser";

describe("JotLine Parser & Serializer", () => {
	it("parses empty string into an empty default group", () => {
		const doc = parseJotDocument("");
		expect(doc.groups).toHaveLength(1);
		expect(doc.groups[0].name).toBe("");
		expect(doc.groups[0].cards).toHaveLength(0);
	});

	it("parses sample format from requirements doc", () => {
		const input = `<!-- group -->
<!-- card -->
単発で送信したメモ1（未分類扱い）

<!-- card -->
単発で送信したメモ2

<!-- group: 20261012-215501 -->
<!-- card -->
親となるカード（スレッドの起点）
### メモ内見出し
水平線や見出しも自由に記述可能
---

<!-- card -->
親カードへの「返信」として追加されたメモ`;

		const doc = parseJotDocument(input);
		expect(doc.groups).toHaveLength(2);

		// Group 1: Default
		expect(doc.groups[0].name).toBe("");
		expect(doc.groups[0].cards).toHaveLength(2);
		expect(doc.groups[0].cards[0].content).toBe("単発で送信したメモ1（未分類扱い）");
		expect(doc.groups[0].cards[1].content).toBe("単発で送信したメモ2");

		// Group 2: Thread
		expect(doc.groups[1].name).toBe("20261012-215501");
		expect(doc.groups[1].cards).toHaveLength(2);
		expect(doc.groups[1].cards[0].content).toContain("親となるカード（スレッドの起点）");
		expect(doc.groups[1].cards[0].content).toContain("### メモ内見出し");
		expect(doc.groups[1].cards[0].content).toContain("---");
		expect(doc.groups[1].cards[1].content).toBe("親カードへの「返信」として追加されたメモ");
	});

	it("failsafe: parses standard markdown without markers into a single card", () => {
		const normalMarkdown = `# Meeting Notes
- Discuss project scope
- Set deadlines

Some other text.`;

		const doc = parseJotDocument(normalMarkdown);
		expect(doc.groups).toHaveLength(1);
		expect(doc.groups[0].name).toBe("");
		expect(doc.groups[0].cards).toHaveLength(1);
		expect(doc.groups[0].cards[0].content).toBe(normalMarkdown.trim());
	});

	it("failsafe: handles card right after group without explicit card marker", () => {
		const input = `<!-- group: my-group -->
Direct card text without card marker
<!-- card -->
Second card`;

		const doc = parseJotDocument(input);
		expect(doc.groups).toHaveLength(1);
		expect(doc.groups[0].name).toBe("my-group");
		expect(doc.groups[0].cards).toHaveLength(2);
		expect(doc.groups[0].cards[0].content).toBe("Direct card text without card marker");
		expect(doc.groups[0].cards[1].content).toBe("Second card");
	});

	it("serializes and round-trips document", () => {
		const doc = {
			groups: [
				{
					id: "g1",
					name: "",
					cards: [
						{ id: "c1", content: "Card 1" },
						{ id: "c2", content: "Card 2" },
					],
				},
				{
					id: "g2",
					name: "topic-1",
					cards: [{ id: "c3", content: "Card 3 in topic" }],
				},
			],
		};

		const serialized = serializeJotDocument(doc);
		expect(serialized).toContain("<!-- group -->");
		expect(serialized).toContain("<!-- card -->\nCard 1");
		expect(serialized).toContain("<!-- group: topic-1 -->");
		expect(serialized).toContain("<!-- card -->\nCard 3 in topic");

		const roundTrip = parseJotDocument(serialized);
		expect(roundTrip.groups).toHaveLength(2);
		expect(roundTrip.groups[0].cards[0].content).toBe("Card 1");
		expect(roundTrip.groups[0].cards[1].content).toBe("Card 2");
		expect(roundTrip.groups[1].name).toBe("topic-1");
		expect(roundTrip.groups[1].cards[0].content).toBe("Card 3 in topic");
	});

	it("exports pure markdown without any markers", () => {
		const cards = [
			{ id: "c1", content: "Point 1: Research" },
			{ id: "c2", content: "Point 2: Architecture\n- Detail A\n- Detail B" },
		];

		const exported = exportToPureMarkdown(cards);
		expect(exported).not.toContain("<!-- group");
		expect(exported).not.toContain("<!-- card -->");
		expect(exported).toBe(`Point 1: Research\n\nPoint 2: Architecture\n- Detail A\n- Detail B`);
	});

	it("merges card with previous card in the same group as exact reverse of split", () => {
		const doc = {
			groups: [
				{
					id: "g1",
					name: "",
					cards: [
						{ id: "c1", content: "Part 1 " },
						{ id: "c2", content: "Part 2" },
					],
				},
			],
		};

		const result = mergeCardWithPrevious(doc, "c2");
		expect(result).toBe(true);
		expect(doc.groups[0].cards).toHaveLength(1);
		expect(doc.groups[0].cards[0].content).toBe("Part 1 Part 2");
	});

	it("merges first card of thread group with previous group's last card without extra newlines", () => {
		const doc = {
			groups: [
				{
					id: "g1",
					name: "",
					cards: [{ id: "c1", content: "Card 1\n" }],
				},
				{
					id: "g2",
					name: "thread-1",
					cards: [{ id: "c2", content: "Card 2 in thread" }],
				},
			],
		};

		const result = mergeCardWithPrevious(doc, "c2");
		expect(result).toBe(true);
		expect(doc.groups[0].cards[0].content).toBe("Card 1\nCard 2 in thread");
		// Thread group was empty so it should be cleaned up
		expect(doc.groups).toHaveLength(1);
	});

	it("returns false when attempting to merge the very first card", () => {
		const doc = {
			groups: [
				{
					id: "g1",
					name: "",
					cards: [{ id: "c1", content: "Only card" }],
				},
			],
		};

		const result = mergeCardWithPrevious(doc, "c1");
		expect(result).toBe(false);
		expect(doc.groups[0].cards).toHaveLength(1);
		expect(doc.groups[0].cards[0].content).toBe("Only card");
	});

	it("groups selected cards into a new thread group", () => {
		const doc = {
			groups: [
				{
					id: "g1",
					name: "",
					cards: [
						{ id: "c1", content: "Card 1" },
						{ id: "c2", content: "Card 2 (selected)" },
						{ id: "c3", content: "Card 3 (selected)" },
						{ id: "c4", content: "Card 4" },
					],
				},
			],
		};

		const result = groupSelectedCards(doc, ["c2", "c3"], "my-new-group");
		expect(result).toBe(true);

		// Group 0: Card 1 (name: "")
		// Group 1: Card 2, Card 3 (name: "my-new-group")
		// Group 2: Card 4 (name: "")
		expect(doc.groups).toHaveLength(3);
		expect(doc.groups[0].cards.map((c) => c.id)).toEqual(["c1"]);
		expect(doc.groups[1].name).toBe("my-new-group");
		expect(doc.groups[1].cards.map((c) => c.id)).toEqual(["c2", "c3"]);
		expect(doc.groups[2].cards.map((c) => c.id)).toEqual(["c4"]);
	});

	it("groups cards across different groups into a single thread group", () => {
		const doc = {
			groups: [
				{
					id: "g1",
					name: "",
					cards: [
						{ id: "c1", content: "Card 1" },
						{ id: "c2", content: "Card 2" },
					],
				},
				{
					id: "g2",
					name: "thread-a",
					cards: [
						{ id: "c3", content: "Card 3" },
					],
				},
			],
		};

		const result = groupSelectedCards(doc, ["c2", "c3"], "merged-thread");
		expect(result).toBe(true);

		// Group 0: Card 1
		// Group 1: Card 2, Card 3 (name: "merged-thread")
		// Old thread-a was empty so removed
		expect(doc.groups).toHaveLength(2);
		expect(doc.groups[0].cards.map((c) => c.id)).toEqual(["c1"]);
		expect(doc.groups[1].name).toBe("merged-thread");
		expect(doc.groups[1].cards.map((c) => c.id)).toEqual(["c2", "c3"]);
	});

	it("ungroups cards completely dissolving a thread group in place", () => {
		const doc = {
			groups: [
				{
					id: "g1",
					name: "thread-1",
					cards: [
						{ id: "c1", content: "Card 1" },
						{ id: "c2", content: "Card 2" },
					],
				},
			],
		};

		const result = ungroupCards(doc, ["c1", "c2"]);
		expect(result).toBe(true);
		expect(doc.groups).toHaveLength(1);
		expect(doc.groups[0].name).toBe("");
		expect(doc.groups[0].cards).toHaveLength(2);
	});

	it("ungroups a single card from a multi-card thread group into default group", () => {
		const doc = {
			groups: [
				{
					id: "g1",
					name: "",
					cards: [{ id: "c0", content: "Base" }],
				},
				{
					id: "g2",
					name: "thread-1",
					cards: [
						{ id: "c1", content: "Stay" },
						{ id: "c2", content: "Leave" },
					],
				},
			],
		};

		const result = ungroupCards(doc, ["c2"]);
		expect(result).toBe(true);
		expect(doc.groups[1].cards.map((c) => c.id)).toEqual(["c1"]);
		expect(doc.groups[0].cards.map((c) => c.id)).toEqual(["c0", "c2"]);
	});

	it("renames a group", () => {
		const doc = {
			groups: [
				{
					id: "g1",
					name: "old-name",
					cards: [{ id: "c1", content: "Card" }],
				},
			],
		};

		const result = renameGroup(doc, "g1", "new-awesome-name");
		expect(result).toBe(true);
		expect(doc.groups[0].name).toBe("new-awesome-name");
	});
});
