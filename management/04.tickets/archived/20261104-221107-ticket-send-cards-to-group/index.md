---
id: 20261104-221107-ticket-send-cards-to-group
title: カードの右クリックメニューからグループへ移動する
status: done
created: 2026-11-04 22:11:07
updated: 2026-11-28 01:50:31
phase: closing
phase_status: done
branch: feature/0007-send-cards-to-group
parent: null
children: []
discussions: []
adrs: []
---
# カードの右クリックメニューからグループへ移動する

## 概要

旧管理番号: Item 0007

各カードの右クリックメニューに「Send to group（グループへ移動）」を追加する。サブメニューから移動先グループを選び、カードをそのグループの末尾へ移動できるようにする。複数選択したカードもまとめて移動できるようにする。名前付きグループの候補とは区切り線で分離して「Ungroup（グループ解除）」を表示し、グループ解除時はファイル末尾の未分類グループへ配置する。

## AC（受け入れ条件）

* [x] 各カードの右クリックメニューに「Send to group（グループへ移動）」が表示される。
* [x] サブメニューには現在存在する名前付きグループ名が JotLine 上のグループの並び順で表示される。
* [x] グループを選ぶと、対象カードが選択先グループの末尾へ移動する。
* [x] 既にグループに所属するカードも、別のグループまたは現在所属するグループの末尾へ移動できる。
* [x] 複数のカードを選択した状態で実行すると、選択したカードがまとめて移動し、移動後も元の JotLine 上の並び順を維持して選択先グループの末尾に並ぶ。
* [x] サブメニューの名前付きグループ候補と区切り線で分離して「Ungroup（グループ解除）」を表示する。
* [x] カードのグループ解除は、対象カードの並び順を維持してファイル末尾の未分類グループへ配置する。末尾に未分類グループがなければ作成する。

## DoR（着手合意）

* **任せる範囲**：旧 `ai-dev-standard` 運用下で着手・完了済み
* **未決事項**：なし
* **着手合意**：合意済み（完了・アーカイブ済み）

## 現在地

* **状況**：完了・アーカイブ済み（`ai-dev-standard` から AIco へ移行）
* **ブロッカー（確認待ち）**：なし
* **次に取る行動**：なし

## 変更ファイル

<!-- AICO:AUTO:BEGIN:changed-files -->

| 種別 | パス |
| :--- | :--- |
| `M` | `docs/architecture/03.UI-UX-Specification.md` |
| `A` | `scripts/card-context-menu.test.mjs` |
| `A` | `scripts/group-dissolve.test.mjs` |
| `M` | `src/__mocks__/obsidian.ts` |
| `M` | `src/i18n/locales/en.ts` |
| `M` | `src/i18n/locales/ja.ts` |
| `M` | `src/parser.test.ts` |
| `M` | `src/parser.ts` |
| `M` | `src/store.test.ts` |
| `M` | `src/store.ts` |
| `M` | `src/ui/App.svelte` |
| `M` | `src/ui/GroupView.svelte` |
| `A` | `src/ui/cardMoveMenu.test.ts` |
| `A` | `src/ui/cardMoveMenu.ts` |

<!-- AICO:AUTO:END:changed-files -->

## DoD（完了の定義）

* **AC 検証結果と根拠**：AC1〜AC11 実装・単体テスト（11ファイル 130テスト通過）・実画面検証・AI レビュー指摘1件（R1）の修正および MR #8 マージまで完了。
* **未検証項目と人の判断結果**：なし
* **プロジェクト側設計書・仕様書の更新確認**：反映済み（`docs/architecture/03.UI-UX-Specification.md`）。
* **ADR の要否判断**：不要（既存公開 API・既存データモデルの延長上の機能追加であり、構造的な設計変更がないため）。
* **関連記録への導線確認**：確認済み

## 親子チケット・関連

* 旧管理番号: Item 0007（元ファイル: `backlog/archive/0007-send-cards-to-group.md`）
* 作業計画（旧 `requirements.md`・`tasks.md`）: [plan.md](plan.md)
* 設計詳細（旧 `design.md`）: [notes/001-design.md](notes/001-design.md)
* 作業ログ・判断履歴（旧 `progress.md`）: [notes/002-progress.md](notes/002-progress.md)
* レビュー記録: [review/index.md](review/index.md)
