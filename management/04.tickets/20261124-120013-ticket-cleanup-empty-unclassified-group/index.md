---
id: 20261124-120013-ticket-cleanup-empty-unclassified-group
title: 空になった不要な未分類グループのドロップ枠を残さない
status: open
created: 2026-11-24 12:00:13
updated: 2026-11-24 12:00:13
phase: drafting
phase_status: working
branch: feature/20261124-120013-ticket-cleanup-empty-unclassified-group
parent: null
children: []
discussions: []
adrs: []
---
# 空になった不要な未分類グループのドロップ枠を残さない

## 概要

旧管理番号: Item 0013

他にカードやグループが存在する状態で未分類グループのカードが 0 枚になったとき、画面上に空のドロップ枠だけが残り再読み込みで消える事象を解消する。
操作直後の表示と保存・再読み込み後の表示が一致するようにする。

### 補足・背景メモ

- Item 0007 の実画面検証（2026-11-24）で確認された課題。
- `GroupView.svelte` が空の未分類グループに対して `DROP_CARDS_HERE` 枠を表示する一方、`serializeJotDocument()` は空の未分類グループを書き出さないため、再読み込み前後で表示が食い違っていた。

## AC（受け入れ条件）

* [ ] 他にカードまたはグループが存在する状態で未分類グループが空になった場合、不要な空のドロップ枠が画面に残らない。
* [ ] ドキュメント全体のカードが 0 枚になった場合は、既存の初期表示（ウェルカム表示）を維持する。
* [ ] 操作直後の表示構成と、ファイル保存・再読み込み後の表示構成が一致する。

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

* 旧管理番号: Item 0013（元ファイル: `backlog/items/0013-cleanup-empty-unclassified-group.md`）
* 発見契機チケット: [20261104-221107-ticket-send-cards-to-group](../archived/20261104-221107-ticket-send-cards-to-group/index.md)
