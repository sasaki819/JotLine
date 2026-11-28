---
id: 20261124-120012-ticket-unify-unclassified-card-spacing
title: 連続する未分類グループ間のカード間隔を揃える
status: open
created: 2026-11-24 12:00:12
updated: 2026-11-24 12:00:12
phase: drafting
phase_status: working
branch: feature/20261124-120012-ticket-unify-unclassified-card-spacing
parent: null
children: []
discussions: []
adrs: []
---
# 連続する未分類グループ間のカード間隔を揃える

## 概要

旧管理番号: Item 0012

スレッド解散などで `<!-- group -->` が連続した場合に、未分類カード同士の境界だけマージンが広くなる表示を解消する。
同じ未分類カードの並びとして自然なカード間隔になるようにする。

### 補足・背景メモ

- Item 0007 の実画面検証（2026-11-24）で確認された課題。
- `GroupView.svelte` の `.jotline-group`（`margin-bottom: 16px`）と `CardView.svelte` の `.jotline-card`（`margin-bottom: 8px`）が連続する未分類グループの境界で重なることが原因。

## AC（受け入れ条件）

* [ ] 未分類グループが連続して並んだ状態でも、グループ境界のカード間隔が同じグループ内のカード間隔と揃う。
* [ ] 名前付きグループとの境界の余白や、カードの並び順・編集操作は維持される。

## DoR（着手合意）

* **任せる範囲**：着手時に確認する
* **未決事項**：なし
* **着手合意**：未合意

## 現在地

* **状況**：起票完了（`ai-dev-standard` から移行）
* **ブロッカー（確認待ち）**：なし
* **次に取る行動**：DoR を確認し `aico-ticket-start` で作業ブランチを作成する

## 変更ファイル

<!-- AICO:AUTO:BEGIN:changed-files -->

変更されたプロジェクト資産はない。

<!-- AICO:AUTO:END:changed-files -->

## DoD（完了の定義）

* **AC 検証結果と根拠**：未実施
* **未検証項目と人の判断結果**：なし
* **プロジェクト側設計書・仕様書の更新確認**：未確認（不要時は理由を記載する）
* **ADR の要否判断**：未確認（不要時は理由、作成時は相対リンクを記載する）
* **関連記録への導線確認**：未確認

## 親子チケット・関連

* 旧管理番号: Item 0012（元ファイル: `backlog/items/0012-unify-unclassified-card-spacing.md`）
* 発見契機チケット: [20261104-221107-ticket-send-cards-to-group](../archived/20261104-221107-ticket-send-cards-to-group/index.md)
