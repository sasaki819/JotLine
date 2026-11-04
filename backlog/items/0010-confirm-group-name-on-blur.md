---
id: "0010"
title: "グループ名の変更をフォーカスアウト時に確定する"
status: backlog        # backlog / ready / in-progress / done / dropped
priority: medium       # high / medium / low
owner: ""
created: 2026-11-04
spec: ""               # 例: specs/0012-login-rework/（Spec を作らない場合は空）
discussions: []        # 例: [discussions/2026-10-15-auth-ideas.md]
---
## 概要
グループ名の編集中に入力欄からフォーカスが外れたら、確定ボタンを押さなくても変更を確定する。確定ボタンも引き続き利用できるようにする。
## 受入基準
- グループ名を編集して入力欄からフォーカスを外すと、確定ボタンを押さなくても変更が確定・保存される。
- 確定ボタンは残り、押した場合も変更が確定・保存される。
- フォーカスアウトと確定ボタンの操作が続けて発生しても、同じ変更が重複して処理されない。
## タスク（Spec を作らない小規模な Item の場合のみ）
## メモ
