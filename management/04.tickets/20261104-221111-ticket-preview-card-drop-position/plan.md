# 作業計画

## 合意した仕様

* **目的**：カード（および別ファイルからのカード／テキスト／スレッド）をドラッグしている間、現在のポインタ位置でドロップしたときにどこへ挿入されるかを明確にプレビュー表示し、プレビュー位置と実際のドロップ結果を厳密に一致させる。
* **有効なドロップ対象とプレビュー種別**：
  * **カード挿入（同一ビュー内のカード並び替え、別ファイル JotLine ビューからのカード、別ファイルのエディタ選択テキスト）**：
    * カード要素（`.jotline-card-wrapper`）上でポインタが上半分（`clientY < rect.top + rect.height / 2`）にあるときはそのカードの直前（スロット `index`）、下半分（`clientY >= rect.top + rect.height / 2`）にあるときはそのカードの直後（スロット `index + 1`）に挿入位置インジケーター（アクセントカラーの水平ライン）を表示する。高さ 0 等のフォールバック時は `index` とする。
    * グループコンテナ余白（カード外・ヘッダー・空グループ・折りたたみスレッド）上ではグループ末尾（`group.cards.length`、空グループ時は `0`）への挿入位置インジケーターおよびグループハイライトを表示する。
  * **スレッド挿入（別ファイル JotLine ビューからのスレッド）**：
    * 実際のドロップ処理（`store.insertThreadAfter(group.id, ...)`）に合わせて、対象グループの直後に挿入位置インジケーターを表示する（グループ内のカード間インジケーターは表示しない）。
  * **無効なドロップ対象**：
    * ドラッグセッションがない場合、同一ビュー内でのスレッドドラッグ、および同一ファイルの別ビュー／同ファイルエディタからのドラッグ（ドロップ時は通知のみで挿入しない）では挿入プレビューを表示しない。
* **プレビュー位置と実ドロップ結果の一致**：
  * `dragover`（プレビュー算出）と `drop`（挿入先インデックス算出）で同一のスロット計算ロジック（`getCardDropSlotIndex`）を使用する。
  * `JotStore.reorderCard(cardId, targetGroupId, targetIndex)` は「移動前配列に対する挿入スロットインデックス（`0 .. cards.length`）」を受け取る仕様へ統一し、同一グループ内での下方移動（`targetIndex > sourceIndex`）時に元カード除去による 1 つ分のインデックスずれを補正する。また、1 枚だけの名前付きスレッドに自分自身のカードをドロップした場合にスレッドが消失しないよう保護する。
* **プレビューの追従と確実な消去**：
  * プレビュー状態（`dropPreview`）およびドラッグ中ソース（`activeDragSource`）を `src/dnd.ts` の共有 Svelte ストアで一元管理し、常に最大 1 箇所のみプレビュー表示されるようにする（グループ間移動時の古いプレビュー残留を防止）。
  * ドラッグ中のカード本体は `.is-dragging` で視覚的に薄く表示する。
  * インジケーターは `position: absolute` かつ `pointer-events: none` とし、レイアウトシフトや `dragleave` ちらつきを起こさない。
  * `drop` 実行時、グループ外への `dragleave`（`!currentTarget.contains(relatedTarget)` の場合のみ）、および `dragend`（`endDrag()` 経由・キャンセル含む）で確実にプレビューを消去する。
* **対象外**：
  * Obsidian 実機上での目視・操作確認（Linux 環境のため自動テスト・型チェック・ビルドで代替する事前合意あり）。
  * 同一ビュー内での複数カード一括 D&D 並び替えやスレッド自体の同一ビュー内並び替え（既存仕様のまま維持）。

## ステップ一覧

* [x] `docs/architecture/03.UI-UX-Specification.md` にドラッグ中ドロップ位置プレビューおよびカード上半分／下半分ドロップ仕様を反映する
* [x] `src/dnd.ts` に共有ストア（`dropPreview` / `activeDragSource`）と純粋関数（`getCardDropSlotIndex` / `resolveDropPreview` / `setDropPreview` / `clearDropPreview`）を追加し、`startDrag` / `endDrag` と連動させる
* [x] `src/store.ts` の `reorderCard` で同一グループ下方移動のインデックス補正および単一カード名前付きスレッドの自己ドロップ保護を行う
* [x] `src/ui/CardView.svelte` と `src/ui/GroupView.svelte` にドロップ位置プレビュー表示・ドラッグ中スタイル・確実なクリア処理・スロット一致ドロップ処理を実装する
* [x] 単体テスト（`src/dnd.test.ts`、`src/store.test.ts`）および JSDOM UI テスト（`scripts/drop-preview.test.mjs`）を追加し、全テスト・型チェック・ビルド・`aico doctor --strict` を通過させる
* [x] 独立レビューおよび必要に応じた修正・再確認を実施し、チケットをクローズする

## 検証方針

* **単体テスト（Vitest）**：
  * `src/dnd.test.ts`: `getCardDropSlotIndex`（上半分／下半分／境界／高さ 0）、`resolveDropPreview`（同一ビューカード・別ファイルカード・別ファイルエディタ・別ファイルスレッド・同一ビュースレッド・同一ファイル別ビュー・セッションなし）、`setDropPreview` / `clearDropPreview` / `startDrag` / `endDrag` によるクリア。
  * `src/store.test.ts`: `reorderCard` の同一グループ内全スロット移動（上方向・下方向・自己位置 no-op・1 枚名前付きスレッドへの自己ドロップ）およびグループ間移動の検証。
* **UI 結合テスト（JSDOM + Svelte + Vitest）**：
  * `scripts/drop-preview.test.mjs`: カード上半分／下半分への `dragover` でのインジケーター位置・追従・実際の `drop` 結果との一致（同一グループ上下・別グループ・末尾余白・空グループ・折りたたみスレッド・別ファイルスレッド）、無効対象（同一ビュースレッド・同一ファイル別ビュー）で非表示、`dragleave` / `dragend`（キャンセル）/ `drop` でのプレビュー消去。
* **機械検証**：`npm test`、`npx tsc --noEmit`、`npm run build`、`./tools/aico.sh doctor --strict`。
* **対象環境**：Linux（Node.js + Vitest + JSDOM）。Obsidian 実機目視確認は対象外（事前合意済み）。

## 判断ログ

* **共有ストアによるプレビュー一元管理**：各 `GroupView` のローカル `isDragOver` 状態ではグループ間高速移動時の残留やウィンドウ外キャンセル（`dragend` のみ発火）時の消し残りが起こり得るため、`src/dnd.ts` の共有 `dropPreview` ストアに一本化した。
* **カード上半分／下半分判定と `reorderCard` スロット統一**：カード上半分＝直前、下半分＝直後とすることで先頭〜末尾のすべてのスロットへ直感的にドロップでき、かつ `reorderCard` 側で同一グループ下方移動時の 1 つずれを吸収することでプレビュー位置とドロップ結果の完全一致を保証する。
