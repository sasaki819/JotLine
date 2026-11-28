---
id: 20261104-210000-ticket-append-main-input-card-at-end
title: メイン入力欄から追加したカードをファイル末尾に保存する
status: done
created: 2026-11-04 21:00:00
updated: 2026-11-04 22:26:43
phase: closing
phase_status: done
branch: main
parent: null
children: []
discussions: []
adrs: []
---
# メイン入力欄から追加したカードをファイル末尾に保存する

## 概要

旧管理番号: Item 0006

現在、ファイル上部にデフォルトグループのカードがあり、その下にグループ化されたカードがある場合、メイン入力欄から追加したカードは上部のデフォルトグループの末尾に保存される。追加したカードの位置が分かりづらいため、メイン入力欄からの新規カードを常に保存先 Markdown ファイルの末尾に追加する。

## AC（受け入れ条件）

* [x] ファイル上部にデフォルトグループのカード、その下にグループ化されたカードがある場合、メイン入力欄から追加したカードがファイル末尾に保存される。
* [x] グループの有無にかかわらず、メイン入力欄から追加したカードはファイル末尾に保存され、既存カードの順序は変わらない。
* [x] 保存先ファイルを再読み込みしても、新規カードが末尾に表示される。

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
| `M` | `src/store.test.ts` |
| `M` | `src/store.ts` |

<!-- AICO:AUTO:END:changed-files -->

## DoD（完了の定義）

* **AC 検証結果と根拠**：`src/store.ts` の末尾追加ロジック変更、`src/store.test.ts` の回帰テスト追加、ビルド・テスト・型検査・AI レビュー（指摘0件）すべて通過。
* **未検証項目と人の判断結果**：なし
* **プロジェクト側設計書・仕様書の更新確認**：反映済み（`docs/architecture/03.UI-UX-Specification.md`）。
* **ADR の要否判断**：不要（既存データモデルの範囲内での局所的な保存位置変更のため）。
* **関連記録への導線確認**：確認済み

## 親子チケット・関連

* 旧管理番号: Item 0006（元ファイル: `backlog/archive/0006-append-main-input-card-at-end.md`）
* 作業計画（旧 `requirements.md`・`tasks.md`）: [plan.md](plan.md)
* 設計詳細（旧 `design.md`）: [notes/001-design.md](notes/001-design.md)
* 作業ログ・判断履歴（旧 `progress.md`）: [notes/002-progress.md](notes/002-progress.md)
* レビュー記録: [review/index.md](review/index.md)
