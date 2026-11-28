---
id: implementation-round1-002-missing-selection-state-edge-tests
title: 選択維持に伴う状態整合（anySelectedInGroup・lastSelectedCardId・no-op）の自動テスト不足
status: done
created: 2026-11-28 22:33:47
updated: 2026-11-28 22:36:15
severity: minor
reviewer: independent-ai-reviewer
---

# 選択維持に伴う状態整合（anySelectedInGroup・lastSelectedCardId・no-op）の自動テスト不足

## 対象

* ファイル：`scripts/card-context-menu.test.mjs` L219-459
* 比較基点：`3aa45ba7765ae49478cd097c61511c4240dc36e7`

## 指摘内容と根拠

選択維持に伴う `anySelectedInGroup`（選択バー `folder-minus` ボタンの表示切替）、`lastSelectedCardId`（移動後および保存失敗復元後の `Shift+Click` 起点）、および no-op 移動／解除時の非保存＋選択維持の自動テストが不足していた。

## 採否判断（人間選別）

* **判断**：採用（`in-progress`）
* **理由**：境界ケースの品質保証を強化する明確なテスト拡充であり、事前合意の方針に従い即修正する。

## 修正内容

* `scripts/card-context-menu.test.mjs` に `keeps anySelectedInGroup, Shift+Click range anchor, and no-op move/ungroup selection state consistent` テストケースを追加し、上記 3 観点をすべて検証した。
* 関連コミット：クローズ前の作業ブランチコミットへ含める（未コミット差分）。

## 独立再確認結果

* **判定**：解消（`done`）
* **根拠**：`scripts/card-context-menu.test.mjs` L463-520 に `anySelectedInGroup`・`lastSelectedCardId`（移動後／保存失敗復元後の `Shift+Click`）・no-op 移動／解除時の非保存＋選択維持の 3 観点がすべて追加され、`npm test` 全 143 件通過を確認。
* **実行環境**：Linux, Node v24.13.1, npm 11.8.0, Python 3.14.4
* **未確認事項**：Obsidian 実機目視確認（事前合意により自動テストで代替）
