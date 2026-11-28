---
id: 20261124-120014-ticket-keep-selection-after-group-move
title: グループ移動直後もカードの選択状態を維持する
status: done
created: 2026-11-24 12:00:14
updated: 2026-11-28 22:36:15
phase: closing
phase_status: done
branch: feature/20261124-120014-ticket-keep-selection-after-group-move
parent: null
children: []
discussions: []
adrs: []
---
# グループ移動直後もカードの選択状態を維持する

## 概要

旧管理番号: Item 0014

グループへの移動操作を行った直後にカードの選択状態が解除され、どのカードが移動したかを追いにくくなる点を改善する。
移動後も対象カードの選択状態を維持し、移動結果を確認しやすくする。

### 補足・背景メモ

- Item 0007 の実画面検証（2026-11-24）で確認された要望。
- 現在は `App.svelte` の `handleMoveCardsToGroup()` と `handleUngroupCards()` が完了時に `clearSelection()` を呼んでいる。

## AC（受け入れ条件）

* [x] 単一カードまたは複数カードをグループへ移動（またはグループ解除）した直後も、移動先にある対象カードの選択状態が維持される。
* [x] 選択維持後も、カードクリック・Escape キー・選択バーの解除操作などで選択状態を解除できる。
* [x] 保存に失敗してモデルを復元した場合、存在しないカード ID が選択状態に残らない。

## DoR（着手合意）

* **任せる範囲**：設計・実装・自動テスト・独立レビュー・DoD 確認・MR 作成・CI 通過後のスカッシュマージまで一括委任（2026-11-28 ユーザー合意済み）
* **未決事項**：なし
* **着手合意**：合意済み（2026-11-28）

## 現在地

* **状況**：完了（クローズ済み・MR マージ待ち）
* **ブロッカー（確認待ち）**：なし
* **次に取る行動**：作業ブランチを push・MR 作成し、CI 成功後にスカッシュマージして `main` 側の一覧を再生成する

## 変更ファイル

<!-- AICO:AUTO:BEGIN:changed-files -->

| 種別 | パス |
| :--- | :--- |
| `M` | `docs/architecture/03.UI-UX-Specification.md` |
| `M` | `scripts/card-context-menu.test.mjs` |
| `M` | `src/ui/App.svelte` |

<!-- AICO:AUTO:END:changed-files -->

## DoD（完了の定義）

* **AC 検証結果と根拠**：全 AC 達成。`src/ui/App.svelte` の `handleMoveCardsToGroup()`・`handleUngroupCards()`・`pruneSelection()` を修正し、`scripts/card-context-menu.test.mjs`（7 件）で単一／複数移動・解除後の選択維持、カードクリック・Escape・選択バー解除ボタンによる解除、保存失敗復元時の無効 ID／`lastSelectedCardId` 除外、`anySelectedInGroup` 追従、no-op 時の選択維持を検証、`npm test`（13 files / 143 tests）・`npm run build`・`npx tsc --noEmit`・`tools/aico.sh doctor --strict` 全通過および独立レビュー・独立再確認で未解決指摘 0 件を確認。
* **未検証項目と人の判断結果**：Obsidian 実機確認は未実施（自動テスト通過＋事前合意により完了）。
* **プロジェクト側設計書・仕様書の更新確認**：更新済み（`docs/architecture/03.UI-UX-Specification.md` の右クリックコンテキストメニュー「移動・解除後の選択扱い」を新仕様へ更新）。
* **ADR の要否判断**：不要（UI コンポーネント内の選択解除タイミングの変更のみで複数作業へ波及するアーキテクチャ判断の変更がないため）。
* **関連記録への導線確認**：確認済み（発見契機チケット `../archived/20261104-221107-ticket-send-cards-to-group/index.md` への相対リンク有効、子チケット・議事録・ADR なし）。

## 親子チケット・関連

* 旧管理番号: Item 0014（元ファイル: `backlog/items/0014-keep-selection-after-group-move.md`）
* 発見契機チケット: [20261104-221107-ticket-send-cards-to-group](../archived/20261104-221107-ticket-send-cards-to-group/index.md)
