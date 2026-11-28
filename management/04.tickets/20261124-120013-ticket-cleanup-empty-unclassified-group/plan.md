# 作業計画

## 合意した仕様

* 他にカードまたはグループが存在する状態で未分類グループ（`group.name === ""`）のカードが 0 枚になった場合、メモリ上の `JotDocument.groups` から不要な空未分類グループを除去し、画面上に空のドロップ枠（`DROP_CARDS_HERE`）を残さない。
* 名前付きグループ（`group.name !== ""`）が空の状態で独立して存在する場合（例：他操作で影響を受けない既存の空スレッド）は従来どおり維持する。
* 除去後にグループが 0 件となる場合（ドキュメント全体でカードも名前付きグループも 0 件の状態）は、空の未分類グループを 1 つだけ確保し（既存の先頭空未分類グループがあればその ID を維持）、既存の初期表示（ウェルカム表示＋ドロップ領域）を維持する。
* 共通ヘルパー `cleanupEmptyUnclassifiedGroups(doc)` を `src/parser.ts` に導入し、パース処理およびカード移動・グループ化・解除・解散・削除・結合・返信・D&D 並べ替え・スレッド挿入の全経路へ適用することで、操作直後の表示構成と保存・再読み込み（`parseJotDocument(serializeJotDocument(doc))`）後の表示構成を一致させる。
* `docs/architecture/03.UI-UX-Specification.md` のグループ移動・解除時の空グループ扱いの記述を新仕様へ整合させる。

## ステップ一覧

* [x] `docs/architecture/03.UI-UX-Specification.md` のグループ移動・解除時の空グループ除去仕様を更新する
* [x] `src/parser.ts` に `cleanupEmptyUnclassifiedGroups(doc)` を実装し、`parseJotDocument`・`mergeCardWithPrevious`・`groupSelectedCards`・`moveCardsInDoc`・`dissolveGroupInDoc`・`deleteGroupDoc`・`insertGroupAfterInDoc`・`removeCardsFromDoc` へ適用する
* [x] `src/store.ts` の `addCard`・`replyToCard`・`deleteCard`・`deleteMultipleCards`・`reorderCard` へ `cleanupEmptyUnclassifiedGroups` を適用する
* [x] 既存テスト（`src/parser.test.ts`・`src/store.test.ts`）の旧期待値を新仕様へ更新し、全操作経路と保存・再読み込み一致・0 枚ウェルカム維持・UI 表示（空ドロップ枠が残らないこと）の自動テストを追加する
* [x] `npm test`・`npm run build`・`npx tsc --noEmit`・`./tools/aico.sh doctor --strict` の通過を確認する
* [x] 独立レビュー（`aico-review`）を実施し、指摘解消のうえクローズする

## 検証方針

* `src/parser.test.ts`・`src/store.test.ts` で、カード移動・グループ解除・グループ化・返信・単一／一括削除・直前カード結合・D&D 並べ替え・空スレッド解散・外部ファイルパースの各経路において、不要な空未分類グループが残らないこと、および `parseJotDocument(serializeJotDocument(doc))` と構造が一致することを検証する。
* JSDOM + esbuild-svelte の UI テストを追加し、(1) 他グループ存在時に未分類グループが空になっても `.jotline-empty-group` が画面に残らないこと、(2) ドキュメント全体のカードが 0 枚になった場合に `.jotline-welcome-empty` が維持されること、(3) 保存・再読み込み前後でグループ構成・DOM 構成が一致することを検証する。
* `npm test`、`npm run build`、`npx tsc --noEmit`、`./tools/aico.sh doctor --strict` を実行する。
* 対象外：Obsidian 実機での目視確認（事前合意のとおり自動テストで代替し DoD へ明記する）。

## 判断ログ

* 表示層（`GroupView.svelte`）で空の未分類グループを隠すのではなく、モデル層（`src/parser.ts`・`src/store.ts`）で `cleanupEmptyUnclassifiedGroups` により不要な空未分類グループを除去する方針を採用した。理由は、AC 3（操作直後と保存・再読み込み後の構成一致）を構造的に保証でき、保存前後でのグループ ID／配列長／`isFirstGroup` 判定などの不整合も同時に解消できるため。
* 既存の `src/parser.test.ts`（ungroup で空になった先頭未分類グループ `g0` が残る前提）および `src/store.test.ts`（末尾空未分類グループがメモリに残る前提で `unchanged` 経路を検証していたテスト）は、本チケットの仕様変更に合わせて更新する（`unchanged` 経路の検証自体はメモリへ空グループを明示注入して維持する）。
