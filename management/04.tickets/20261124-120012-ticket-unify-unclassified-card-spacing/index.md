---
id: 20261124-120012-ticket-unify-unclassified-card-spacing
title: 連続する未分類グループ間のカード間隔を揃える
status: done
created: 2026-11-24 12:00:12
updated: 2026-11-28 22:11:57
phase: closing
phase_status: done
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

* [x] 未分類グループが連続して並んだ状態でも、グループ境界のカード間隔が同じグループ内のカード間隔と揃う。
* [x] 名前付きグループとの境界の余白や、カードの並び順・編集操作は維持される。

## DoR（着手合意）

* **任せる範囲**：実装・自動テスト・独立レビュー・DoD 確認・MR 作成・CI 通過後のスカッシュマージまで一括委任（2026-11-28 ユーザー合意済み）
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
| `A` | `scripts/unclassified-spacing.test.mjs` |
| `M` | `src/ui/App.svelte` |
| `M` | `src/ui/GroupView.svelte` |

<!-- AICO:AUTO:END:changed-files -->

## DoD（完了の定義）

* **AC 検証結果と根拠**：全 AC 達成。`scripts/unclassified-spacing.test.mjs`（3 件）で連続未分類グループ間 `marginBottom: 0px`・カード間 `8px`・名前付きグループ境界および末尾 `16px`・スレッド解散後リアクティブ更新・空未分類グループ非適用を検証し、`npm test`（12 files / 133 tests）・`npm run build`・`npx tsc --noEmit`・`tools/aico.sh doctor --strict` 全通過、独立レビューおよび独立再確認で未解決指摘 0 件を確認。
* **未検証項目と人の判断結果**：Obsidian 実機確認は未実施（自動テスト通過＋事前合意により完了）。
* **プロジェクト側設計書・仕様書の更新確認**：不要（`docs/architecture/03.UI-UX-Specification.md` にグループ間・カード間のピクセル余白仕様の記載がないため）。
* **ADR の要否判断**：不要（既存コンポーネントのスタイル・prop 調整のみで複数作業へ波及する設計判断の変更がないため）。
* **関連記録への導線確認**：確認済み（発見契機チケット `../archived/20261104-221107-ticket-send-cards-to-group/index.md` への相対リンク有効、子チケット・議事録・ADR なし）。

## 親子チケット・関連

* 旧管理番号: Item 0012（元ファイル: `backlog/items/0012-unify-unclassified-card-spacing.md`）
* 発見契機チケット: [20261104-221107-ticket-send-cards-to-group](../archived/20261104-221107-ticket-send-cards-to-group/index.md)
