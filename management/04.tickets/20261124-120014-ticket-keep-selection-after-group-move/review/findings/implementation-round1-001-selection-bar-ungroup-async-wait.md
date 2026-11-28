---
id: implementation-round1-001-selection-bar-ungroup-async-wait
title: 選択バーからのグループ解除テストが非同期完了（finally）前にアサーションしている
status: done
created: 2026-11-28 22:33:47
updated: 2026-11-28 22:36:15
severity: major
reviewer: independent-ai-reviewer
---

# 選択バーからのグループ解除テストが非同期完了（finally）前にアサーションしている

## 対象

* ファイル：`scripts/card-context-menu.test.mjs` L452-458
* 比較基点：`3aa45ba7765ae49478cd097c61511c4240dc36e7`

## 指摘内容と根拠

`barUngroupBtn.dispatchEvent(...)` 後に `await tick(); await Promise.resolve();` しか待機しておらず、多段の `async/await` を含む `handleUngroupSelection()` の `finally` ブロック到達前にアサーションが走っていた。旧実装の `clearSelection()` が残っていても偽陽性となるリスクがある。

## 採否判断（人間選別）

* **判断**：採用（`in-progress`）
* **理由**：テストの回帰検知精度に直結する明確な非同期待機不備であり、事前合意の方針に従い即修正する。

## 修正内容

* `scripts/card-context-menu.test.mjs` の選択バー解除テストで `await new Promise((resolve) => setTimeout(resolve, 0)); await tick();` による完了待機へ修正し、`.jotline-selection-bar` 表示・選択維持・解除ボタン非表示を検証するようにした。
* 関連コミット：クローズ前の作業ブランチコミットへ含める（未コミット差分）。

## 独立再確認結果

* **判定**：解消（`done`）
* **根拠**：`scripts/card-context-menu.test.mjs` L454-460 で `setTimeout(resolve, 0)` と `tick()` による完了待機および選択バー表示・選択維持・解除ボタン非表示の検証が行われていることを独立ワーカーが実物照合。
* **実行環境**：Linux, Node v24.13.1, npm 11.8.0, Python 3.14.4
* **未確認事項**：Obsidian 実機目視確認（事前合意により自動テストで代替）
