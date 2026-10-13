import { JotCard, JotDocument, JotGroup } from "./types";

/**
 * カードおよびグループ用のユニークIDを生成します。
 * ランダム文字列とタイムスタンプのBase36表現を結合して一意性を確保します。
 */
export function generateId(): string {
	return Math.random().toString(36).substring(2, 10) + Date.now().toString(36);
}

/**
 * HTMLコメントマーカーを含む生のMarkdown文字列をパースし、構造化されたJotDocumentオブジェクトに変換します。
 * 
 * 【認識マーカー仕様】:
 * - グループマーカー: `<!-- group -->`（未分類）または `<!-- group: [グループ名] -->`（名前付きスレッド）
 * - カードマーカー: `<!-- card -->`（各カードの境界）
 * 
 * 【フェイルセーフ設計】:
 * - 空ファイルまたは空白のみの場合: 未分類グループ（空カード配列）を生成して返します。
 * - マーカーが一切存在しない通常Markdownファイルの場合: ファイル全体の内容を破壊せず、未分類グループの1枚のカードとして安全に読み込みます。
 * - カード内のMarkdown構文（見出し `#`、リスト `-`、水平線 `---`、コードブロック等）を制限なくそのまま保持します。
 * 
 * @param markdown パース対象のMarkdownテキスト
 * @returns 構造化されたJotDocument
 */
export function parseJotDocument(markdown: string): JotDocument {
	const trimmed = markdown.trim();
	// ファイルが空の場合は初期状態の未分類グループを返却
	if (!trimmed) {
		return {
			groups: [
				{
					id: generateId(),
					name: "",
					cards: [],
				},
			],
		};
	}

	// 各行を順次走査してマーカーを判定する（正規表現の一括置換よりも改行構造や本文の欠損を防ぎやすい）
	const lines = markdown.split(/\r?\n/);
	const groups: JotGroup[] = [];

	let hasSeenGroup = false;
	let currentGroupName = "";
	let currentGroupCards: JotCard[] = [];
	let currentCardLines: string[] = [];
	let hasCardStarted = false;

	// 現在蓄積されている行を1枚のカードとして確定する内部ヘルパー
	function commitCard() {
		if (hasCardStarted || currentCardLines.length > 0) {
			const content = currentCardLines.join("\n").trim();
			// 本文が存在する場合のみカードとして登録（空マーカー連続による空カード生成を防止）
			if (content.length > 0) {
				currentGroupCards.push({
					id: generateId(),
					content,
				});
			}
			currentCardLines = [];
			hasCardStarted = false;
		}
	}

	// 現在蓄積されているカード群を1つのグループとして確定する内部ヘルパー
	function commitGroup() {
		commitCard();
		if (hasSeenGroup || currentGroupCards.length > 0) {
			groups.push({
				id: generateId(),
				name: currentGroupName,
				cards: currentGroupCards,
			});
			currentGroupCards = [];
			hasSeenGroup = false;
		}
	}

	// 行単位のスキャンループ
	for (const line of lines) {
		// グループ宣言マーカー判定: <!-- group --> または <!-- group: [name] -->
		const groupMatch = line.trim().match(/^<!--\s*group(?::\s*(.*?))?\s*-->$/i);
		if (groupMatch) {
			// 前のカードとグループが存在すれば確定
			if (hasSeenGroup || currentGroupCards.length > 0 || currentCardLines.length > 0) {
				commitGroup();
			}
			hasSeenGroup = true;
			currentGroupName = (groupMatch[1] || "").trim();
			continue;
		}

		// カード境界マーカー判定: <!-- card -->
		const cardMatch = line.trim().match(/^<!--\s*card\s*-->$/i);
		if (cardMatch) {
			// 前のカードがあれば確定し、新しいカードを開始
			commitCard();
			hasCardStarted = true;
			continue;
		}

		// マーカー以外の行はカードの本文テキストとして蓄積
		currentCardLines.push(line);
	}

	// ファイル末尾に残ったカードおよびグループを確定
	commitGroup();

	// グループが1つも生成されなかった場合のフォールバック（未分類空グループ）
	if (groups.length === 0) {
		groups.push({
			id: generateId(),
			name: "",
			cards: [],
		});
	}

	return { groups };
}

/**
 * JotDocument を HTML コメントマーカーを含む標準の Markdown 文字列へシリアライズ（復元）します。
 * 
 * - 出力されたMarkdownは通常のエディタでも安全に閲覧・編集可能。
 * - 空の未分類グループは不要な空白マーカーを作らないよう出力からスキップします。
 * - 各グループは空行を挟んで出力され、ObsidianのMarkdownパーサーとの親和性を保ちます。
 * 
 * @param doc シリアライズ対象のJotDocument
 * @returns HTMLコメントマーカー付きMarkdown文字列
 */
export function serializeJotDocument(doc: JotDocument): string {
	const groupBlocks: string[] = [];

	for (const group of doc.groups) {
		// カードがなく名前もないデフォルトグループは出力不要
		if (group.cards.length === 0 && !group.name) {
			continue;
		}

		// グループヘッダーの構築（名前付きなら <!-- group: name -->、未分類なら <!-- group -->）
		const groupHeader = group.name ? `<!-- group: ${group.name} -->` : `<!-- group -->`;
		const cardBlocks = group.cards.map((card) => `<!-- card -->\n${card.content.trim()}`);

		if (cardBlocks.length > 0) {
			groupBlocks.push(`${groupHeader}\n${cardBlocks.join("\n\n")}`);
		} else if (group.name) {
			// カードが空でもスレッド名が存在する場合はグループ宣言のみ残す
			groupBlocks.push(groupHeader);
		}
	}

	return groupBlocks.join("\n\n") + (groupBlocks.length > 0 ? "\n" : "");
}

/**
 * カードリストからHTMLコメントマーカーを除去し、純粋なMarkdownテキストとして結合してエクスポートします。
 * クリップボードコピー機能や外部ノートへの貼り付け時に使用されます。
 * 
 * @param cards エクスポート対象のカードリスト
 * @returns マーカーが完全に除去された整形済みMarkdown文字列
 */
export function exportToPureMarkdown(cards: JotCard[]): string {
	return cards
		.map((card) => card.content.trim())
		.filter((text) => text.length > 0)
		.join("\n\n");
}

/**
 * 対象カードをその直前にあるカードと直接結合（マージ）します。
 * 
 * 【結合仕様】:
 * - 行単位・メモ単位での分割や独立したメモの統合を考慮し、改行1つ（`\n`）を挟んで結合します。
 *   （すでに直前カード末尾または対象カード先頭に改行が含まれている場合は二重改行を防止）
 * - 直前のカードと結合後、元の対象カードは安全に削除されます。
 * - もし対象カードがグループの先頭だった場合、直前のグループの末尾カードを探索して結合します。
 *   結合後に空になったスレッドグループは自動的に削除されます。
 * 
 * @param doc JotDocument ドキュメント
 * @param cardId 結合元のカードID（このカードが直前のカードに吸収されます）
 * @returns 結合が成功した場合は true、直前にカードが存在しない（最上位カード）場合は false
 */
export function mergeCardWithPrevious(doc: JotDocument, cardId: string): boolean {
	for (let g = 0; g < doc.groups.length; g++) {
		const group = doc.groups[g];
		const cIdx = group.cards.findIndex((c) => c.id === cardId);
		if (cIdx !== -1) {
			if (cIdx > 0) {
				// 同一グループ内の直前カードと結合
				const prevCard = group.cards[cIdx - 1];
				const currentCard = group.cards[cIdx];
				const separator = prevCard.content.endsWith("\n") || currentCard.content.startsWith("\n") ? "" : "\n";
				prevCard.content = prevCard.content + separator + currentCard.content;
				group.cards.splice(cIdx, 1);
				return true;
			} else if (g > 0) {
				// グループ先頭カードの場合: カードを持つ直前のグループを遡って探索
				for (let prevG = g - 1; prevG >= 0; prevG--) {
					const prevGroup = doc.groups[prevG];
					if (prevGroup.cards.length > 0) {
						const prevCard = prevGroup.cards[prevGroup.cards.length - 1];
						const currentCard = group.cards[cIdx];
						const separator = prevCard.content.endsWith("\n") || currentCard.content.startsWith("\n") ? "" : "\n";
						prevCard.content = prevCard.content + separator + currentCard.content;
						group.cards.splice(cIdx, 1);
						// カードが空になったスレッドグループ（名前付き）は自動除去
						if (group.cards.length === 0 && group.name !== "") {
							doc.groups.splice(g, 1);
						}
						return true;
					}
				}
			}
			return false; // 直前にカードが存在しない（ドキュメント全体の先頭カード）
		}
	}
	return false;
}

/**
 * スレッドグループ生成用のタイムスタンプ文字列（YYYYMMDD-HHmmss）を生成します。
 * 例: `20261013-094500`
 */
export function generateGroupTimestamp(): string {
	const now = new Date();
	const pad = (n: number) => n.toString().padStart(2, "0");
	const yyyy = now.getFullYear();
	const mm = pad(now.getMonth() + 1);
	const dd = pad(now.getDate());
	const hh = pad(now.getHours());
	const min = pad(now.getMinutes());
	const ss = pad(now.getSeconds());
	return `${yyyy}${mm}${dd}-${hh}${min}${ss}`;
}

/**
 * 複数選択されたカード群を、最初の選択カードの位置を起点として新しいスレッドグループにまとめます。
 * 
 * 【アルゴリズム仕様】:
 * 1. ドキュメント内での出現順序を厳密に保持して選択カードを抽出。
 * 2. 最初に選択されたカードが存在したグループ内の位置に、新グループをインライン挿入。
 * 3. 選択カードが抜けた前後のカード配列を壊さず維持し、ドキュメントの文脈を崩さない。
 * 
 * @param doc JotDocument ドキュメント
 * @param cardIds グループ化対象のカードIDリスト
 * @param groupName 作成するグループ名（省略時は YYYYMMDD-HHmmss タイムスタンプ）
 * @returns 処理が成功した場合は true
 */
export function groupSelectedCards(
	doc: JotDocument,
	cardIds: string[],
	groupName?: string
): boolean {
	if (cardIds.length === 0) return false;
	const idSet = new Set(cardIds);

	// ドキュメント上の出現順序通りに選択カードを収集
	const selectedCards: JotCard[] = [];
	let firstOccurrence: { groupIndex: number; cardIndex: number } | null = null;

	for (let g = 0; g < doc.groups.length; g++) {
		for (let c = 0; c < doc.groups[g].cards.length; c++) {
			const card = doc.groups[g].cards[c];
			if (idSet.has(card.id)) {
				selectedCards.push(card);
				if (!firstOccurrence) {
					firstOccurrence = { groupIndex: g, cardIndex: c };
				}
			}
		}
	}

	if (selectedCards.length === 0 || !firstOccurrence) return false;

	// 新しいスレッドグループの生成
	const newGroup: JotGroup = {
		id: generateId(),
		name: groupName || generateGroupTimestamp(),
		cards: selectedCards,
	};

	const newGroups: JotGroup[] = [];

	for (let g = 0; g < doc.groups.length; g++) {
		const group = doc.groups[g];
		const hasAnySelected = group.cards.some((c) => idSet.has(c.id));

		if (!hasAnySelected) {
			newGroups.push(group);
			continue;
		}

		const remainingCards = group.cards.filter((c) => !idSet.has(c.id));

		// 最初の選択カードが存在した位置のグループでの処理
		if (g === firstOccurrence.groupIndex) {
			const beforeCards = group.cards.slice(0, firstOccurrence.cardIndex).filter((c) => !idSet.has(c.id));
			const afterCards = group.cards.slice(firstOccurrence.cardIndex).filter((c) => !idSet.has(c.id));

			// 起点より前のカード群があれば既存グループとして残す
			if (beforeCards.length > 0 || (group.name === "" && afterCards.length === 0 && newGroups.length === 0)) {
				newGroups.push({
					id: generateId(),
					name: group.name,
					cards: beforeCards,
				});
			}

			// 新しいグループを挿入
			newGroups.push(newGroup);

			// 起点より後ろの残存カード群があれば新しいグループとして保持
			if (afterCards.length > 0) {
				newGroups.push({
					id: generateId(),
					name: group.name,
					cards: afterCards,
				});
			}
		} else {
			// 他のグループは未選択カードのみ残す
			if (remainingCards.length > 0) {
				newGroups.push({
					id: group.id,
					name: group.name,
					cards: remainingCards,
				});
			}
		}
	}

	doc.groups = newGroups;

	// ドキュメントが空にならないようフォールバック
	if (doc.groups.length === 0) {
		doc.groups.push({
			id: generateId(),
			name: "",
			cards: [],
		});
	}

	return true;
}

/**
 * 選択されたカードのグループ所属を解除（Ungroup）します。
 * 
 * 【解除仕様】:
 * - スレッド内のすべてのカードが選択解除された場合: スレッドの配置位置を崩さず、その場でスレッド名のみを空文字（未分類）にクリアします。
 * - 一部のカードのみ解除された場合: 対象カードをスレッドから除外して、未分類（デフォルト）グループへと移動します。
 * 
 * @param doc JotDocument ドキュメント
 * @param cardIds グループ解除対象のカードIDリスト
 * @returns 変更があった場合は true
 */
export function ungroupCards(doc: JotDocument, cardIds: string[]): boolean {
	if (cardIds.length === 0) return false;
	const idSet = new Set(cardIds);
	let modified = false;

	for (let g = doc.groups.length - 1; g >= 0; g--) {
		const group = doc.groups[g];
		if (group.name === "") continue; // 未分類グループは対象外

		const matchingCards = group.cards.filter((c) => idSet.has(c.id));
		if (matchingCards.length === 0) continue;

		modified = true;

		if (matchingCards.length === group.cards.length) {
			// スレッド内の全カードが対象の場合: 位置を移動させずその場でスレッド名のみクリア（解散）
			group.name = "";
		} else {
			// スレッド内の一部カードのみ解除: スレッドから抜き出して未分類グループへ追加
			group.cards = group.cards.filter((c) => !idSet.has(c.id));

			let defaultGroup = doc.groups.find((gr) => gr.name === "");
			if (!defaultGroup) {
				defaultGroup = { id: generateId(), name: "", cards: [] };
				doc.groups.unshift(defaultGroup);
			}
			defaultGroup.cards.push(...matchingCards);
		}
	}

	return modified;
}

/**
 * スレッドグループの名前を変更します。
 * 
 * @param doc JotDocument ドキュメント
 * @param groupId リネーム対象のグループID
 * @param newName 新しいグループ名（前後の空白は自動トリム、空文字列は拒否）
 * @returns 変更が成功した場合は true
 */
export function renameGroup(doc: JotDocument, groupId: string, newName: string): boolean {
	const group = doc.groups.find((g) => g.id === groupId);
	if (!group) return false;
	const trimmed = newName.trim();
	if (!trimmed) return false;
	group.name = trimmed;
	return true;
}

/**
 * 指定したグループを所属カードごと削除します。
 * 全グループがなくなった場合は空のデフォルトグループを1つ確保します。
 * 
 * @param doc JotDocument ドキュメント
 * @param groupId 削除対象のグループID
 * @returns 削除が実行された場合は true
 */
export function deleteGroupDoc(doc: JotDocument, groupId: string): boolean {
	const idx = doc.groups.findIndex((g) => g.id === groupId);
	if (idx === -1) return false;
	doc.groups.splice(idx, 1);
	if (doc.groups.length === 0) {
		doc.groups.push({
			id: generateId(),
			name: "",
			cards: [],
		});
	}
	return true;
}

/**
 * カードを所属グループ内で1つ上または下へ移動（隣接カードと位置を交換）します。
 * 
 * @param doc JotDocument ドキュメント
 * @param cardId 対象カードID
 * @param direction 移動方向 ("up" または "down")
 * @returns 移動できた場合は true
 */
export function moveCardInDoc(doc: JotDocument, cardId: string, direction: "up" | "down"): boolean {
	for (const group of doc.groups) {
		const idx = group.cards.findIndex((c) => c.id === cardId);
		if (idx !== -1) {
			if (direction === "up" && idx > 0) {
				const [card] = group.cards.splice(idx, 1);
				group.cards.splice(idx - 1, 0, card);
				return true;
			} else if (direction === "down" && idx < group.cards.length - 1) {
				const [card] = group.cards.splice(idx, 1);
				group.cards.splice(idx + 1, 0, card);
				return true;
			}
			return false;
		}
	}
	return false;
}




