---
id: "0014"
title: "グループ移動直後もカードの選択状態を維持する"
status: backlog        # backlog / ready / in-progress / done / dropped
priority: medium       # high / medium / low
owner: ""
created: 2026-11-24
spec: ""               # 例: specs/0012-login-rework/（Spec を作らない場合は空）
discussions: []        # 例: [discussions/2026-10-15-auth-ideas.md]
---
## 概要
グループへの移動操作を行った直後にカードの選択状態が解除され、どのカードが移動したかを追いにくくなる点を改善する。
移動後も対象カードの選択状態を維持し、移動結果を確認しやすくする。
## 受入基準
- 単一カードまたは複数カードをグループへ移動（またはグループ解除）した直後も、移動先にある対象カードの選択状態が維持される。
- 選択維持後も、カードクリック・Escape キー・選択バーの解除操作などで選択状態を解除できる。
- 保存に失敗してモデルを復元した場合、存在しないカード ID が選択状態に残らない。
## タスク（Spec を作らない小規模な Item の場合のみ）
## メモ
- Item 0007 の実画面検証（2026-11-24）で確認された要望。
- 現在は `App.svelte` の `handleMoveCardsToGroup()` と `handleUngroupCards()` が完了時に `clearSelection()` を呼んでいる。
