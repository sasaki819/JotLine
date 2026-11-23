/**
 * @file parser.test.ts
 * @description JotLineパーサー・シリアライザー・カード操作ロジックの単体テスト（Vitest）。
 * 
 * 【検証項目】
 * - 空文字やマーカーなし通常Markdownのセーフパース（Failsafe）
 * - 要件定義サンプルのパースと往復シリアライズ（等価性検証）
 * - 純粋Markdownエクスポート
 * - Splitの完全な逆操作としての直前カード統合（mergeCardWithPrevious）
 * - 複数カードのグループ化（groupSelectedCards）、一括移動（moveCardsToGroupInDoc）、グループ解除（ungroupCards）、スレッド解散（dissolveGroupInDoc）、名前変更（renameGroup）
 */

import { describe, it, expect } from "vitest";
import {
	parseJotDocument,
	serializeJotDocument,
	exportToPureMarkdown,
	mergeCardWithPrevious,
	groupSelectedCards,
	moveCardsToGroupInDoc,
	ungroupCards,
	dissolveGroupInDoc,
	renameGroup,
	deleteGroupDoc,
	moveCardInDoc,
	insertCardsInDoc,
	insertGroupAfterInDoc,
	removeCardsFromDoc,
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

	it("merges card with previous card in the same group with a newline separator", () => {
		const doc = {
			groups: [
				{
					id: "g1",
					name: "",
					cards: [
						{ id: "c1", content: "Part 1" },
						{ id: "c2", content: "Part 2" },
					],
				},
			],
		};

		const result = mergeCardWithPrevious(doc, "c2");
		expect(result).toBe(true);
		expect(doc.groups[0].cards).toHaveLength(1);
		expect(doc.groups[0].cards[0].content).toBe("Part 1\nPart 2");
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

	it("ungroups all cards from a thread into a new unclassified group at the tail", () => {
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
				{
					id: "g2",
					name: "thread-2",
					cards: [{ id: "c3", content: "Card 3" }],
				},
			],
		};

		const result = ungroupCards(doc, ["c1", "c2"]);
		expect(result).toBe(true);
		expect(doc.groups.map((g) => g.name)).toEqual(["thread-2", ""]);
		expect(doc.groups[0].cards.map((c) => c.id)).toEqual(["c3"]);
		expect(doc.groups[1].cards.map((c) => c.id)).toEqual(["c1", "c2"]);
		expect(doc.groups[1].cards.map((c) => c.content)).toEqual(["Card 1", "Card 2"]);
	});

	it("ungroups a single card from a multi-card thread group into a new unclassified group at the tail when the last group is named", () => {
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
		expect(doc.groups.map((g) => g.name)).toEqual(["", "thread-1", ""]);
		expect(doc.groups[0].cards.map((c) => c.id)).toEqual(["c0"]);
		expect(doc.groups[1].cards.map((c) => c.id)).toEqual(["c1"]);
		expect(doc.groups[2].cards.map((c) => c.id)).toEqual(["c2"]);
	});

	it("dissolves a thread group in place without moving cards to the tail", () => {
		const doc = {
			groups: [
				{
					id: "g1",
					name: "",
					cards: [{ id: "c0", content: "Top" }],
				},
				{
					id: "g2",
					name: "thread-1",
					cards: [
						{ id: "c1", content: "Card 1" },
						{ id: "c2", content: "Card 2" },
					],
				},
				{
					id: "g3",
					name: "thread-2",
					cards: [{ id: "c3", content: "Card 3" }],
				},
			],
		};

		const result = dissolveGroupInDoc(doc, "g2");
		expect(result).toBe(true);
		expect(doc.groups.map((g) => g.name)).toEqual(["", "", "thread-2"]);
		expect(doc.groups[1].id).toBe("g2");
		expect(doc.groups[1].cards.map((c) => c.id)).toEqual(["c1", "c2"]);
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

	it("deletes a group and preserves at least one default group", () => {
		const doc = {
			groups: [
				{
					id: "g1",
					name: "thread-1",
					cards: [{ id: "c1", content: "Card 1" }],
				},
			],
		};

		const result = deleteGroupDoc(doc, "g1");
		expect(result).toBe(true);
		expect(doc.groups).toHaveLength(1);
		expect(doc.groups[0].name).toBe("");
		expect(doc.groups[0].cards).toHaveLength(0);
	});

	it("moves card up and down within its group", () => {
		const doc = {
			groups: [
				{
					id: "g1",
					name: "",
					cards: [
						{ id: "c1", content: "Card 1" },
						{ id: "c2", content: "Card 2" },
						{ id: "c3", content: "Card 3" },
					],
				},
			],
		};

		// c1 cannot move up (already top)
		expect(moveCardInDoc(doc, "c1", "up")).toBe(false);

		// c2 moves up -> [c2, c1, c3]
		expect(moveCardInDoc(doc, "c2", "up")).toBe(true);
		expect(doc.groups[0].cards.map((c) => c.id)).toEqual(["c2", "c1", "c3"]);

		// c2 moves down -> [c1, c2, c3]
		expect(moveCardInDoc(doc, "c2", "down")).toBe(true);
		expect(doc.groups[0].cards.map((c) => c.id)).toEqual(["c1", "c2", "c3"]);

		// c3 cannot move down (already bottom)
		expect(moveCardInDoc(doc, "c3", "down")).toBe(false);
	});
});

describe("Batch move, ungroup and thread dissolve operations", () => {
	function createSampleDoc() {
		return {
			groups: [
				{
					id: "g-unclassified",
					name: "",
					cards: [
						{ id: "c1", content: "U1" },
						{ id: "c2", content: "U2" },
					],
				},
				{
					id: "g-alpha",
					name: "shared",
					cards: [
						{ id: "c3", content: "A1" },
						{ id: "c4", content: "A2" },
					],
				},
				{
					id: "g-beta",
					name: "shared",
					cards: [
						{ id: "c5", content: "B1" },
						{ id: "c6", content: "B2" },
					],
				},
			],
		};
	}

	it("moves a card from unclassified to a named group tail and preserves ID and content", () => {
		const doc = createSampleDoc();
		expect(moveCardsToGroupInDoc(doc, ["c1"], "g-alpha")).toBe(true);
		expect(doc.groups[0].cards.map((c) => c.id)).toEqual(["c2"]);
		expect(doc.groups[1].cards.map((c) => ({ id: c.id, content: c.content }))).toEqual([
			{ id: "c3", content: "A1" },
			{ id: "c4", content: "A2" },
			{ id: "c1", content: "U1" },
		]);
		expect(doc.groups[2].cards.map((c) => c.id)).toEqual(["c5", "c6"]);
	});

	it("targets the exact group by ID even when multiple groups share the same name", () => {
		const doc = createSampleDoc();
		expect(moveCardsToGroupInDoc(doc, ["c3"], "g-beta")).toBe(true);
		expect(doc.groups[1].id).toBe("g-alpha");
		expect(doc.groups[1].cards.map((c) => c.id)).toEqual(["c4"]);
		expect(doc.groups[2].id).toBe("g-beta");
		expect(doc.groups[2].cards.map((c) => c.id)).toEqual(["c5", "c6", "c3"]);
	});

	it("moves cards to the tail of their current group and keeps the group name", () => {
		const doc = createSampleDoc();
		expect(moveCardsToGroupInDoc(doc, ["c3"], "g-alpha")).toBe(true);
		expect(doc.groups[1].name).toBe("shared");
		expect(doc.groups[1].cards.map((c) => c.id)).toEqual(["c4", "c3"]);
	});

	it("moves multiple cards across groups in document order regardless of selection order and removes emptied named sources", () => {
		const doc = createSampleDoc();
		// 選択順を逆にして、移動先内外が混在する複数カードを指定
		expect(moveCardsToGroupInDoc(doc, ["c6", "c3", "c1", "c5"], "g-beta")).toBe(true);
		expect(doc.groups.map((g) => g.id)).toEqual(["g-unclassified", "g-alpha", "g-beta"]);
		expect(doc.groups[0].cards.map((c) => c.id)).toEqual(["c2"]);
		expect(doc.groups[1].cards.map((c) => c.id)).toEqual(["c4"]);
		expect(doc.groups[2].cards.map((c) => c.id)).toEqual(["c1", "c3", "c5", "c6"]);

		// 元の名前付きグループが空になったら除去される
		expect(moveCardsToGroupInDoc(doc, ["c4"], "g-beta")).toBe(true);
		expect(doc.groups.map((g) => g.id)).toEqual(["g-unclassified", "g-beta"]);
		expect(doc.groups[1].cards.map((c) => c.id)).toEqual(["c1", "c3", "c5", "c6", "c4"]);
	});

	it("reuses an existing tail unclassified group on ungroup and keeps document order for mixed selections", () => {
		const doc = {
			groups: [
				{ id: "g0", name: "", cards: [{ id: "c0", content: "U0" }] },
				{ id: "g1", name: "t1", cards: [{ id: "c1", content: "T1" }, { id: "c2", content: "T2" }] },
				{ id: "g2", name: "", cards: [{ id: "c3", content: "Tail0" }] },
			],
		};

		expect(ungroupCards(doc, ["c3", "c1", "c0"])).toBe(true);
		expect(doc.groups.map((g) => g.id)).toEqual(["g0", "g1", "g2"]);
		expect(doc.groups[0].cards).toEqual([]);
		expect(doc.groups[1].cards.map((c) => c.id)).toEqual(["c2"]);
		expect(doc.groups[2].cards.map((c) => c.id)).toEqual(["c0", "c1", "c3"]);
	});

	it("creates a new tail unclassified group even if removing an emptied named group exposes an earlier unclassified group", () => {
		const doc = {
			groups: [
				{ id: "g0", name: "", cards: [{ id: "c0", content: "U0" }] },
				{ id: "g1", name: "t1", cards: [{ id: "c1", content: "T1" }] },
			],
		};

		expect(ungroupCards(doc, ["c1"])).toBe(true);
		expect(doc.groups.map((g) => g.name)).toEqual(["", ""]);
		expect(doc.groups[0].id).toBe("g0");
		expect(doc.groups[0].cards.map((c) => c.id)).toEqual(["c0"]);
		expect(doc.groups[1].id).not.toBe("g0");
		expect(doc.groups[1].cards.map((c) => c.id)).toEqual(["c1"]);
	});

	it("returns false without mutating when target or cards are invalid, empty, or already in place", () => {
		const doc = createSampleDoc();
		const snapshot = structuredClone(doc);

		expect(moveCardsToGroupInDoc(doc, [], "g-alpha")).toBe(false);
		expect(moveCardsToGroupInDoc(doc, ["c1"], "missing")).toBe(false);
		expect(moveCardsToGroupInDoc(doc, ["c1"], "g-unclassified")).toBe(false);
		expect(moveCardsToGroupInDoc(doc, ["c1", "missing"], "g-alpha")).toBe(false);
		expect(moveCardsToGroupInDoc(doc, ["c4", "c3"], "g-alpha")).toBe(false);
		expect(moveCardsToGroupInDoc(doc, ["c4", "c4"], "g-alpha")).toBe(false);
		expect(ungroupCards(doc, [])).toBe(false);
		expect(ungroupCards(doc, ["missing"])).toBe(false);
		expect(dissolveGroupInDoc(doc, "missing")).toBe(false);
		expect(dissolveGroupInDoc(doc, "g-unclassified")).toBe(false);
		expect(doc).toEqual(snapshot);

		const tailUnclassified = {
			groups: [
				{ id: "g1", name: "t1", cards: [{ id: "c1", content: "A" }] },
				{ id: "g2", name: "", cards: [{ id: "c2", content: "B" }, { id: "c3", content: "C" }] },
			],
		};
		const tailSnapshot = structuredClone(tailUnclassified);
		expect(ungroupCards(tailUnclassified, ["c3", "c2"])).toBe(false);
		expect(tailUnclassified).toEqual(tailSnapshot);
	});
});

describe("D&D document operations", () => {
	/** 未分類（A, B）とスレッド「topic」（C, D）のドキュメント */
	function sampleDoc() {
		return parseJotDocument(
			"<!-- group -->\n<!-- card -->\nA\n\n<!-- card -->\nB\n\n<!-- group: topic -->\n<!-- card -->\nC\n\n<!-- card -->\nD\n"
		);
	}
	const contentsOf = (cards: { content: string }[]) => cards.map((c) => c.content);

	it("inserts cards at the head, middle and tail of a group", () => {
		const doc = sampleDoc();
		const gid = doc.groups[0].id;
		expect(insertCardsInDoc(doc, gid, 0, ["head"])).toBe(true);
		expect(insertCardsInDoc(doc, gid, 2, ["mid1", "mid2"])).toBe(true);
		expect(insertCardsInDoc(doc, gid, 99, ["tail"])).toBe(true);
		expect(contentsOf(doc.groups[0].cards)).toEqual(["head", "A", "mid1", "mid2", "B", "tail"]);
	});

	it("trims contents and ignores empty ones when inserting cards", () => {
		const doc = sampleDoc();
		const gid = doc.groups[1].id;
		expect(insertCardsInDoc(doc, gid, 0, ["  x  ", "   "])).toBe(true);
		expect(contentsOf(doc.groups[1].cards)).toEqual(["x", "C", "D"]);
		expect(insertCardsInDoc(doc, gid, 0, ["", "  "])).toBe(false);
	});

	it("returns false when inserting cards into a missing group", () => {
		const doc = sampleDoc();
		expect(insertCardsInDoc(doc, "missing", 0, ["x"])).toBe(false);
	});

	it("inserts a thread right after the given group", () => {
		const doc = sampleDoc();
		expect(insertGroupAfterInDoc(doc, doc.groups[0].id, " moved ", ["E", "F"])).toBe(true);
		expect(doc.groups.map((g) => g.name)).toEqual(["", "moved", "topic"]);
		expect(contentsOf(doc.groups[1].cards)).toEqual(["E", "F"]);
	});

	it("returns false when inserting a thread after a missing group, without a name, or without cards", () => {
		const doc = sampleDoc();
		expect(insertGroupAfterInDoc(doc, "missing", "x", ["E"])).toBe(false);
		expect(insertGroupAfterInDoc(doc, doc.groups[0].id, "  ", ["E"])).toBe(false);
		expect(insertGroupAfterInDoc(doc, doc.groups[0].id, "x", ["  "])).toBe(false);
		expect(doc.groups.length).toBe(2);
	});

	it("removes cards, drops emptied threads and keeps the unclassified group", () => {
		const doc = sampleDoc();
		const [a, b] = doc.groups[0].cards.map((c) => c.id);
		const [c, d] = doc.groups[1].cards.map((c) => c.id);
		expect(removeCardsFromDoc(doc, [a, b, c, d])).toBe(true);
		expect(doc.groups.length).toBe(1);
		expect(doc.groups[0].name).toBe("");
		expect(doc.groups[0].cards).toEqual([]);
	});

	it("returns false when none of the cards exist", () => {
		const doc = sampleDoc();
		expect(removeCardsFromDoc(doc, ["missing"])).toBe(false);
		expect(doc.groups.length).toBe(2);
	});
});
