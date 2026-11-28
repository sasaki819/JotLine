---
id: 20261104-221110-ticket-confirm-group-name-on-blur
title: グループ名の変更をフォーカスアウト時に確定する
status: done
created: 2026-11-04 22:11:10
updated: 2026-11-05 08:07:19
phase: closing
phase_status: done
branch: main
parent: null
children: []
discussions: []
adrs: []
---
# グループ名の変更をフォーカスアウト時に確定する

## 概要

旧管理番号: Item 0010

グループ名の確定・キャンセルボタンを削除し、Enter または入力欄からのフォーカスアウトで変更を確定する。Esc で編集をキャンセルする。

## AC（受け入れ条件）

* [x] グループ名の確定・キャンセルボタンが表示されない。
* [x] Enter または入力欄からのフォーカスアウトで変更が確定・保存される。
* [x] Esc で変更を破棄して編集を終了し、その後のフォーカスアウトで保存されない。
* [x] Enter とフォーカスアウトが続けて発生しても、同じ変更が重複して処理されない。

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
| `M` | `package-lock.json` |
| `M` | `package.json` |
| `A` | `scripts/group-rename.test.mjs` |
| `M` | `src/ui/GroupView.svelte` |

<!-- AICO:AUTO:END:changed-files -->

## DoD（完了の定義）

* **AC 検証結果と根拠**：グループ名編集のボタン削除・Enter/blur 確定・Esc キャンセル・編集開始時自動フォーカスおよび全選択を実装し、単体テスト・実画面確認・AI 実装レビュー（指摘0件）まで完了。
* **未検証項目と人の判断結果**：なし
* **プロジェクト側設計書・仕様書の更新確認**：反映済み（`docs/architecture/03.UI-UX-Specification.md`）。
* **ADR の要否判断**：不要（UI 編集操作の改善であり構造的な設計変更ではないため）。
* **関連記録への導線確認**：確認済み

## 親子チケット・関連

* 旧管理番号: Item 0010（元ファイル: `backlog/archive/0010-confirm-group-name-on-blur.md`）
* 作業計画（旧 `requirements.md`・`tasks.md`）: [plan.md](plan.md)
* 設計詳細（旧 `design.md`）: [notes/001-design.md](notes/001-design.md)
* 作業ログ・判断履歴（旧 `progress.md`）: [notes/002-progress.md](notes/002-progress.md)
* レビュー記録: [review/index.md](review/index.md)
