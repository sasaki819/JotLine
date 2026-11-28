---
id: implementation-round1-001-focus-group-name-input-on-edit
title: グループ名編集開始時に入力欄へ自動フォーカスする
status: done
created: 2026-11-04 23:40:00
updated: 2026-11-04 23:53:07
severity: major
reviewer: human
---
# グループ名編集開始時に入力欄へ自動フォーカスする

## 対象

`src/ui/GroupView.svelte`（グループ名編集入力欄）

## 指摘内容と根拠

旧レビュー記録（`specs/0010-confirm-group-name-on-blur/reviews/2026-11-04-impl-human.md` R1、元重大度: 確認待ち → 移行時に major として記録）。

グループ名のダブルクリック直後は入力欄にフォーカスがなく、Enter・Esc・欄外クリックが効かない。自分で入力欄をクリックした後は確定・キャンセルできる。

## 採否判断（人間選別）

採用（人間指摘）。

## 修正内容

`c577423`: 編集欄のマウント時にフォーカスを当てる修正と、追加クリックをせず操作する回帰テスト6件を追加。build・全98テスト・型検査・当時の check-docs が成功。

## 独立再確認結果

ユーザーから修正後に「うまく動いています」との実画面での動作確認を得た（Task 2 の全確認項目・対象環境を網羅した確認とは扱わない）。
