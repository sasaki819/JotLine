# 作業計画

## 合意した仕様

* スレッド解散などで未分類グループ（`group.name === ""`）が連続して並んだとき、未分類カード同士の境界間隔を同一グループ内のカード間隔（`8px`）と揃える。
* 判定条件：現在のグループが「カードを持つ未分類グループ（`!group.name && group.cards.length > 0`）」であり、かつ直後のグループも「カードを持つ未分類グループ」である場合、前側の `.jotline-group.is-default` に `is-followed-by-default` クラスを付与して `margin-bottom: 0` とする。
* 名前付きグループ（`.is-thread`）との境界余白（`margin-bottom: 16px`）、タイムライン末尾の余白、カードの並び順・編集操作・Markdown 保存形式は変更しない。
* 空の未分類グループには `is-followed-by-default` を付与しない。

## ステップ一覧

* [x] `src/ui/GroupView.svelte` に `isFollowedByDefaultGroup` prop、`.is-followed-by-default` クラス付与、および `.jotline-group.is-default.is-followed-by-default { margin-bottom: 0; }` スタイルを追加する
* [x] `src/ui/App.svelte` の `GroupView` 呼び出しで連続未分類グループ判定を渡す
* [x] `scripts/unclassified-spacing.test.mjs` を追加し、連続未分類グループ・名前付きグループ境界・スレッド解散後のリアクティブ反映・空未分類グループ時の非適用を検証する
* [x] `npm run build`・`npm test`・`npx tsc --noEmit`・`tools/aico.sh doctor --strict` の通過を確認する
* [x] 独立レビュー（`aico-review`）を実施し、指摘解消のうえクローズする

## 検証方針

* JSDOM + esbuild-svelte（`css: "injected"`）上で `App.svelte` をレンダリングし、`getComputedStyle` による `marginBottom` 値（`0px` / `16px` / カード `8px`）と DOM クラス・カード順序を自動検証する。
* `npm run build`、`npm test`、`npx tsc --noEmit`、`tools/aico.sh doctor --strict` を実行する。
* 対象外：Obsidian 実機での目視確認（事前合意のとおり自動テストで代替し DoD へ明記する）。

## 判断ログ

* CSS の `:has(+ .jotline-group.is-default)` ではなく Svelte prop 経由のクラス制御（`is-followed-by-default`）を採用した。理由は、古い WebView や JSDOM を含む全環境で確実に動作し、かつ「カードを持つ未分類グループ同士のみ」という条件を明示的に表現できるため。
* プロジェクト側設計書（`docs/architecture/03.UI-UX-Specification.md`）にはグループ間・カード間のピクセル余白仕様の記載がないため、設計書更新は不要と判断した。
