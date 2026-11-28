---
id: implementation-round1-002-empty-group-drag-guard
title: カード0枚スレッドのドラッグ抑止と空テキスト削除防止
status: done
created: 2026-10-20 22:00:01
updated: 2026-10-21 07:30:00
severity: minor
reviewer: Gemini
---
# カード0枚スレッドのドラッグ抑止と空テキスト削除防止

## 対象

`src/ui/GroupView.svelte`（L116-L131、L274）、`src/main.ts`（L207-L211）

## 指摘内容と根拠

旧レビュー記録（`specs/0004-dnd-between-jotline-and-notes/reviews/2026-10-20-impl-ai.md` R2、元重大度: Low）。

パーサー・シリアライザーはカード0枚の名前付きスレッド（`<!-- group: name -->` のみ）を許容しており、`GroupView.svelte` でもカード0枚のスレッドヘッダーをドラッグできる。しかしカード0枚のスレッドを別ファイルのエディタへドロップした場合、`source.text` が空文字 `""` となるため、`removeMovedSource` の `editor.getValue().includes("")` が常に `true` となり、エディタ側には何も挿入されないまま元のスレッドが削除されてしまう（また別ファイルの JotLine ビューへドロップした場合は `insertGroupAfterInDoc` が `false` を返し無反応となる）。カード0枚のスレッドはドラッグ不可にするか、`removeMovedSource` 等で `source.text` が空でないことを確認する必要がある。

## 採否判断（人間選別）

採用（人間承認済み）。

## 修正内容

カード0枚のスレッドはスレッドヘッダーをドラッグできないようにした（`GroupView.svelte`、`draggable={!isRenaming && group.cards.length > 0}`）。あわせて `main.ts` の `removeMovedSource` で、挿入テキストが空なら挿入を確認できなかった扱いにし、元を削除しないようにした（コミット `7316bd4`）。スレッドのドラッグ開始処理でも、念のためカード0枚なら何もしないようにした（コミット `e453938`）。

## 独立再確認結果

正しく配置したビルド（`e453938` 時点）で、ユーザーが Obsidian 上で動作を確認済み。
