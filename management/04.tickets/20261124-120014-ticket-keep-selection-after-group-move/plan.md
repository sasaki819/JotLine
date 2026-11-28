# 作業計画

## 合意した仕様

* `src/ui/App.svelte` の `handleMoveCardsToGroup()` および `handleUngroupCards()` 完了時に `clearSelection()` を呼ばず、移動先（名前付きグループ末尾または末尾の未分類グループ）にある対象カードの選択状態を維持する。
* 移動・解除後に保存失敗等でモデルが復元されカード ID が振り直された場合は、存在しないカード ID（および `lastSelectedCardId`）が選択状態に残らないよう `pruneSelection` で確実に除外する。
* 選択維持後も、カードクリック（修飾キーなし）・`Escape` キー・選択バーの解除ボタン（`x`）等で選択を解除できる。
* `docs/architecture/03.UI-UX-Specification.md` の右クリックコンテキストメニュー「移動・解除後の選択扱い」の記述を新仕様（選択維持＋復元時除外）へ更新する。

## ステップ一覧

* [x] `docs/architecture/03.UI-UX-Specification.md` の移動・解除後の選択状態仕様を更新する
* [x] `src/ui/App.svelte` の `handleMoveCardsToGroup()`・`handleUngroupCards()`・`pruneSelection()` を修正し、移動／解除後の選択維持と復元時の無効 ID 除外を実現する
* [x] `scripts/card-context-menu.test.mjs` を更新・拡充し、単一／複数移動・解除後の選択維持（AC 1）、カードクリック・Escape・選択バーでの選択解除（AC 2）、保存失敗復元時に無効 ID が残らないこと（AC 3）を検証する
* [x] `npm test`・`npm run build`・`npx tsc --noEmit`・`./tools/aico.sh doctor --strict` の通過を確認する
* [x] 独立レビュー（`aico-review`）を実施し、指摘解消のうえクローズする

## 検証方針

* `scripts/card-context-menu.test.mjs`（JSDOM + esbuild-svelte 上の `App.svelte` テスト）で以下を自動検証する：
  1. 単一カード／複数カードの「グループへ移動」（サブメニュー・子メニューフォールバック）および「グループ解除」（サブメニュー・単一／複数メニュー・選択バー）完了後も、移動先カードに `.is-selected` が維持され `.jotline-selection-bar` が表示されること。
  2. 選択維持後にカードクリック・`Escape` キー・選択バーの解除ボタン（`x`）で選択が解除されること。
  3. 保存失敗でモデルが復元された場合、`.jotline-selection-bar` が消え `.jotline-card.is-selected` が 0 件となり、存在しないカード ID が選択状態に残らないこと。
* `npm test`、`npm run build`、`npx tsc --noEmit`、`./tools/aico.sh doctor --strict` を実行する。
* 対象外：Obsidian 実機での目視確認（事前合意のとおり自動テストで代替し DoD へ明記する）。

## 判断ログ

* `JotStore.replacedCount` は既存設計書（`docs/architecture/01.Architecture.md`）および `src/store.test.ts` で「アンドゥ／リドゥ／外部変更時のみ増加」と定義されているため変更せず、`App.svelte` の `pruneSelection`（リアクティブ監視＋移動／解除完了後の即時呼び出し）で保存失敗復元時の無効 ID を確実に除外する設計とした。
