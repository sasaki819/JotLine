---
id: implementation-round1-002-invalid-dragover-filtered-clear-leaves-stale-preview
title: 無効なドロップ先への dragover でフィルタ付き clearDropPreview を呼ぶため別ビューのプレビューが残留し得る
status: done
created: 2026-11-28 23:26:56
updated: 2026-11-28 23:31:00
severity: minor
reviewer: independent-worker(self)
---

# 無効なドロップ先への dragover でフィルタ付き clearDropPreview を呼ぶため別ビューのプレビューが残留し得る

## 対象

* `src/ui/GroupView.svelte`（`handleDragOver`）
* `scripts/drop-preview.test.mjs`
* 比較基点: `6d06cbf0fcbb1106a3de19730056c0864e1a1859`

## 指摘内容と根拠

* `GroupView.svelte` の `handleDragOver` において、`JOTLINE_DRAG_MIME` 欠落時および同一ビュー内スレッドドラッグ時に `clearDropPreview({ store, groupId: group.id })` を呼んでいたため、別ビュー上にプレビューが表示されている状態から `dragleave` を経ずに無効ドロップ先へポインタが戻った場合に、別ビュー側のプレビューが消えず残留し得る。

## 採否判断（人間選別）

* 採用（`in-progress`）：`dragover` は現在ポインタ位置の要素でのみ発火するため無条件クリアが正しく、修正も簡潔なため採用する。

## 修正内容

* `src/ui/GroupView.svelte` の `handleDragOver` 内の無効分岐 2 箇所を無条件の `clearDropPreview()` に統一した。
* `scripts/drop-preview.test.mjs` に、別ビュー上にプレビューが表示されている状態から同一ビュースレッドまたは `JOTLINE_DRAG_MIME` 欠落の `dragover` を受けた際にプレビューが消去される回帰テストを追加した。

## 独立再確認結果

* 解消確認済み（独立再確認ワーカーにより実物照合・新規指摘 0 件）。`src/ui/GroupView.svelte` の `handleDragOver` 内の無効分岐 2 箇所が無条件 `clearDropPreview()` に統一され、`handleDragLeave` / `onDestroy` のフィルタ付き消去が適切に維持されていること、および回帰テスト通過を確認。
* 実行環境: Linux 7.0.0-44-generic / Node.js v24.13.1 / Vitest / TypeScript / Python 3.14.4
* 未確認事項: Obsidian 実機での目視・ポインタ操作確認（事前合意により自動テストで代替）
