---
id: implementation-round1-001-unused-unknown-prop-in-spacing-test
title: テストで App.svelte に存在しない onOpenInEditor prop を渡している
status: done
created: 2026-11-28 22:09:16
updated: 2026-11-28 22:11:57
severity: minor
reviewer: independent-ai-reviewer
---

# テストで App.svelte に存在しない onOpenInEditor prop を渡している

## 対象

* ファイル：`scripts/unclassified-spacing.test.mjs` L79
* 比較基点：`62d7fa9bc279513d6db0540609c8f3525797e278`

## 指摘内容と根拠

`mountWithMarkdown` 内で `new AppComponent({ target: ..., props: { store, app, onOpenInEditor: () => {} } })` を渡しているが、`src/ui/App.svelte` が受け取る props は `store` と `app` のみである（`src/ui/App.svelte` L38-40、`src/ui/JotLineView.ts` L64-70）。未定義 prop の受け渡しは読解時の誤認や開発モード警告の原因となる。

## 採否判断（人間選別）

* **判断**：採用（`in-progress`）
* **理由**：明確なテストコードの不要引数であり仕様トレードオフを伴わないため、事前合意の自律修正方針に従い即修正する。

## 修正内容

* `scripts/unclassified-spacing.test.mjs` の `AppComponent` 生成時 `props` を `{ store, app }` へ修正した。
* 関連コミット：クローズ前の作業ブランチコミットへ含める（未コミット差分）。

## 独立再確認結果

* **判定**：解消（`done`）
* **根拠**：`scripts/unclassified-spacing.test.mjs` L77-80 で `AppComponent` への `props` が `{ store, app }` のみとなっていることを独立ワーカーが実物照合し、`npm test` 全 133 件通過を確認。
* **実行環境**：Linux x86_64, Node v24.13.1, Vitest 2.1.9, TypeScript 5.9.3, Python 3.14.4
* **未確認事項**：Obsidian 実機目視確認（事前合意により自動テストで代替）
