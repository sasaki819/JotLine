---
id: implementation-round1-001-drop-does-not-end-drag-session
title: グループ間・別ファイルへのドロップ完了時にドラッグセッションが終了せず .is-dragging 等が残留する
status: done
created: 2026-11-28 23:26:56
updated: 2026-11-28 23:31:00
severity: major
reviewer: independent-worker(self)
---

# グループ間・別ファイルへのドロップ完了時にドラッグセッションが終了せず .is-dragging 等が残留する

## 対象

* `src/ui/GroupView.svelte`（`handleDrop`）
* `src/ui/CardView.svelte`（`$activeDragSource` による `isDragging` 判定）
* `scripts/drop-preview.test.mjs`
* 比較基点: `6d06cbf0fcbb1106a3de19730056c0864e1a1859`

## 指摘内容と根拠

* `GroupView.svelte` の `handleDrop` が `clearDropPreview()` のみを呼び `endDrag()` を呼んでいなかった。
* 同一ビュー内でカードを別グループへ移動した際、`store.reorderCard` 内の `doc.update` により移動元 `CardView` がアンマウントされ DOM から切り離されるため、`dragend` が発火・伝播せず `activeDragSource` が残留し、移動先カードに `.is-dragging`（`opacity: 0.45`）が残り続ける。別ファイル移動・エディタドロップ時も同様にセッション残留が起こり得る。

## 採否判断（人間選別）

* 採用（`in-progress`）：客観的な実機不具合（AC 3 および表示状態整合に直結）のため修正する（事前承認済みの自動採用・修正方針に基づく）。

## 修正内容

* `src/ui/GroupView.svelte` の `handleDrop` で有効な JotLine ドロップ経路およびエディタドロップ経路に入ったタイミングで `endDrag()` を呼び出し、`activeDragSource` と `dropPreview` を確実に終了するように修正した。
* `scripts/drop-preview.test.mjs` で、同一グループドロップ後の手動 `endDrag()` 呼び出しを削除して自動終了を検証するとともに、展開された別グループへのドロップ直後に `dragend` なしでも `.is-dragging` 解除・`getDragSource() === null`・`getDropPreview() === null` となる回帰テストを追加した。

## 独立再確認結果

* 解消確認済み（独立再確認ワーカーにより実物照合・新規指摘 0 件）。`src/ui/GroupView.svelte` の `handleDrop` 内で JotLine 経路およびエディタ経路の双方で `endDrag()` を呼ぶこと、`scripts/drop-preview.test.mjs` の別グループドロップ回帰テストを含む 14 ファイル・158 テスト全通過を確認。
* 実行環境: Linux 7.0.0-44-generic / Node.js v24.13.1 / Vitest / TypeScript / Python 3.14.4
* 未確認事項: Obsidian 実機での目視・ポインタ操作確認（事前合意により自動テストで代替）
