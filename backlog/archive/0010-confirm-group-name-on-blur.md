---
id: "0010"
title: "グループ名の変更をフォーカスアウト時に確定する"
status: done           # backlog / ready / in-progress / done / dropped
priority: medium       # high / medium / low
owner: ""
created: 2026-11-04
spec: "specs/0010-confirm-group-name-on-blur/"
discussions: []        # 例: [discussions/2026-10-15-auth-ideas.md]
---
## 概要
グループ名の確定・キャンセルボタンを削除し、Enter または入力欄からのフォーカスアウトで変更を確定する。Esc で編集をキャンセルする。
## 受入基準
- グループ名の確定・キャンセルボタンが表示されない。
- Enter または入力欄からのフォーカスアウトで変更が確定・保存される。
- Esc で変更を破棄して編集を終了し、その後のフォーカスアウトで保存されない。
- Enter とフォーカスアウトが続けて発生しても、同じ変更が重複して処理されない。
## タスク（Spec を作らない小規模な Item の場合のみ）
## メモ
