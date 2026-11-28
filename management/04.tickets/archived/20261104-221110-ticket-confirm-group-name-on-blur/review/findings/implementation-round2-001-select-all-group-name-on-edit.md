---
id: implementation-round2-001-select-all-group-name-on-edit
title: グループ名編集開始時に既存テキストを全選択する
status: done
created: 2026-11-05 00:00:00
updated: 2026-11-05 00:26:24
severity: minor
reviewer: human
---
# グループ名編集開始時に既存テキストを全選択する

## 対象

`src/ui/GroupView.svelte`（グループ名編集入力欄）

## 指摘内容と根拠

旧レビュー記録（`specs/0010-confirm-group-name-on-blur/reviews/2026-11-05-impl-human.md` R1、元重大度: 確認待ち → 移行時に minor として記録）。

グループ名の編集を開始したとき、既存のテキストを全選択してほしい。

## 採否判断（人間選別）

採用（人間要望）。

## 修正内容

`871c0d2`: フォーカス後に `select()` を呼ぶよう変更。ダブルクリックと編集ボタンの双方について選択範囲と名前全体の置き換えをテストし、build・全100テスト・型検査・当時の check-docs が成功。

## 独立再確認結果

ユーザーから追加機能も実画面で正常動作するとの確認を得た。
