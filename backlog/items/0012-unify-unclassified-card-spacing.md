---
id: "0012"
title: "連続する未分類グループ間のカード間隔を揃える"
status: backlog        # backlog / ready / in-progress / done / dropped
priority: medium       # high / medium / low
owner: ""
created: 2026-11-24
spec: ""               # 例: specs/0012-login-rework/（Spec を作らない場合は空）
discussions: []        # 例: [discussions/2026-10-15-auth-ideas.md]
---
## 概要
スレッド解散などで `<!-- group -->` が連続した場合に、未分類カード同士の境界だけマージンが広くなる表示を解消する。
同じ未分類カードの並びとして自然なカード間隔になるようにする。
## 受入基準
- 未分類グループが連続して並んだ状態でも、グループ境界のカード間隔が同じグループ内のカード間隔と揃う。
- 名前付きグループとの境界の余白や、カードの並び順・編集操作は維持される。
## タスク（Spec を作らない小規模な Item の場合のみ）
## メモ
- Item 0007 の実画面検証（2026-11-24）で確認された課題。
- `GroupView.svelte` の `.jotline-group`（`margin-bottom: 16px`）と `CardView.svelte` の `.jotline-card`（`margin-bottom: 8px`）が連続する未分類グループの境界で重なることが原因。
