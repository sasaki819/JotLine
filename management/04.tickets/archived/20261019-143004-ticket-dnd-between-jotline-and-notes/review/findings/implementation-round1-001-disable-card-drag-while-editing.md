---
id: implementation-round1-001-disable-card-drag-while-editing
title: 編集・返信入力中のカードドラッグ抑止
status: done
created: 2026-10-20 22:00:00
updated: 2026-10-21 07:30:00
severity: major
reviewer: Gemini
---
# 編集・返信入力中のカードドラッグ抑止

## 対象

`src/ui/CardView.svelte`（L215-L237、L247）

## 指摘内容と根拠

旧レビュー記録（`specs/0004-dnd-between-jotline-and-notes/reviews/2026-10-20-impl-ai.md` R1、元重大度: Medium）。

`GroupView.svelte`（L274）ではスレッド名編集中に `draggable={!isRenaming}` としてドラッグを無効化しているが、`CardView.svelte` ではインライン編集中（`isEditing`）や返信入力中（`isReplying`）も `.jotline-card` が `draggable="true"` のままであり、`handleDragStart` も編集状態を考慮していない。そのため、カード編集欄（`<textarea>`）や返信欄（`<input>`）内で選択テキストをドラッグした際にイベントが `.jotline-card` へバブリングし、`text/plain` がカード全体の保存済み本文で上書きされ、`cards` ドラッグセッションが開始されてしまう（別ファイルのエディタへドロップするとカード自体が削除される）。`draggable={!isEditing && !isReplying}` とするか、`handleDragStart` で編集・返信欄からのドラッグを除外する必要がある。

## 採否判断（人間選別）

採用（人間承認済み）。3段階で修正を実施し、返信欄を開いている間はカードをドラッグできない挙動も含めユーザー判断で採用。

## 修正内容

対応は3段階で行い、すべて残している。

1. `CardView.svelte` の `handleDragStart` で、ドラッグの起点が `textarea` / `input` の中なら何もしない（コミット `1929d39`）。
2. カードの編集中・返信欄を開いている間は `.jotline-card` の `draggable` を `false` にする（指摘の案。コミット `b66bbf7`）。
3. 編集中・返信欄を開いている間は `handleDragStart` で何もしず、タイムラインはドラッグセッションのあるドラッグだけを受け付ける（編集欄の文字を落としたときに、何も追加されずに元の文字だけ消えるのを防ぐ。コミット `e453938`）。

(2)(3) は Obsidian 上の確認で改善しないとの報告を受けて追加したが、後にその確認は配置先の取り違えにより Task 5 のビルドで行われていたと判明した（経緯は [notes/002-progress.md](../../notes/002-progress.md) の 2026-10-21）。

## 独立再確認結果

正しく配置したビルド（`e453938` 時点）で、ユーザーが Obsidian 上で動作を確認済み。返信欄を開いている間はカードをドラッグできないが、ユーザーの判断でこのままとした。
