---
id: 20261124-120014-ticket-keep-selection-after-group-move
title: グループ移動直後もカードの選択状態を維持する
status: open
created: 2026-11-24 12:00:14
updated: 2026-11-24 12:00:14
phase: drafting
phase_status: working
branch: feature/20261124-120014-ticket-keep-selection-after-group-move
parent: null
children: []
discussions: []
adrs: []
---
# グループ移動直後もカードの選択状態を維持する

## 概要

旧管理番号: Item 0014

グループへの移動操作を行った直後にカードの選択状態が解除され、どのカードが移動したかを追いにくくなる点を改善する。
移動後も対象カードの選択状態を維持し、移動結果を確認しやすくする。

### 補足・背景メモ

- Item 0007 の実画面検証（2026-11-24）で確認された要望。
- 現在は `App.svelte` の `handleMoveCardsToGroup()` と `handleUngroupCards()` が完了時に `clearSelection()` を呼んでいる。

## AC（受け入れ条件）

* [ ] 単一カードまたは複数カードをグループへ移動（またはグループ解除）した直後も、移動先にある対象カードの選択状態が維持される。
* [ ] 選択維持後も、カードクリック・Escape キー・選択バーの解除操作などで選択状態を解除できる。
* [ ] 保存に失敗してモデルを復元した場合、存在しないカード ID が選択状態に残らない。

## DoR（着手合意）

* **任せる範囲**：着手時に確認する
* **未決事項**：なし
* **着手合意**：未合意

## 現在地

* **状況**：起票完了（`ai-dev-standard` から移行）
* **ブロッカー（確認待ち）**：なし
* **次に取る行動**：DoR を確認し `aico-ticket-start` で作業ブランチを作成する

## 変更ファイル

<!-- AICO:AUTO:BEGIN:changed-files -->

変更されたプロジェクト資産はない。

<!-- AICO:AUTO:END:changed-files -->

## DoD（完了の定義）

* **AC 検証結果と根拠**：未実施
* **未検証項目と人の判断結果**：なし
* **プロジェクト側設計書・仕様書の更新確認**：未確認（不要時は理由を記載する）
* **ADR の要否判断**：未確認（不要時は理由、作成時は相対リンクを記載する）
* **関連記録への導線確認**：未確認

## 親子チケット・関連

* 旧管理番号: Item 0014（元ファイル: `backlog/items/0014-keep-selection-after-group-move.md`）
* 発見契機チケット: [20261104-221107-ticket-send-cards-to-group](../archived/20261104-221107-ticket-send-cards-to-group/index.md)
