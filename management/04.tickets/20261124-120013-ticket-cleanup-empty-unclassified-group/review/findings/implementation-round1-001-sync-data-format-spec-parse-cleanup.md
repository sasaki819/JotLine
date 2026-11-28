---
id: implementation-round1-001-sync-data-format-spec-parse-cleanup
title: 02.Data-Format-Spec.md の parseJotDocument 仕様に空未分類グループ除去を反映する
status: done
created: 2026-11-28 22:23:39
updated: 2026-11-28 22:25:56
severity: minor
reviewer: independent-ai-reviewer
---

# 02.Data-Format-Spec.md の parseJotDocument 仕様に空未分類グループ除去を反映する

## 対象

* ファイル：`docs/architecture/02.Data-Format-Spec.md` L118-125
* 比較基点：`a2ff173e14c10d07fb204a64789c555e58101260`

## 指摘内容と根拠

`src/parser.ts` の `parseJotDocument` で `cleanupEmptyUnclassifiedGroups` により不要な空の未分類グループを除外するよう変更したが、`docs/architecture/02.Data-Format-Spec.md` の 4.1 節（手順 7）に当該仕様が未反映だった。

## 採否判断（人間選別）

* **判断**：採用（`in-progress`）
* **理由**：設計書と実装の整合を図る明確な追記であり仕様トレードオフがないため、事前合意の方針に従い即修正する。

## 修正内容

* `docs/architecture/02.Data-Format-Spec.md` の 4.1 節（手順 7）に、他グループ存在時の空未分類グループ除外と 0 件時の 1 件確保ルールを追記した。
* 関連コミット：クローズ前の作業ブランチコミットへ含める（未コミット差分）。

## 独立再確認結果

* **判定**：解消（`done`）
* **根拠**：`docs/architecture/02.Data-Format-Spec.md` 4.1 節（L125）が空未分類グループ整理仕様へ更新され、`src/parser.ts` の `parseJotDocument`・`cleanupEmptyUnclassifiedGroups` および 4.2 節・5 節と完全に整合していることを独立ワーカーが実物照合。
* **実行環境**：Linux x86_64, Node v24.13.1, npm 11.8.0, Python 3.14.4
* **未確認事項**：Obsidian 実機目視確認（事前合意により自動テストで代替）
