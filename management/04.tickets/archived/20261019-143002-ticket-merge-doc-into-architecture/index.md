---
id: 20261019-143002-ticket-merge-doc-into-architecture
title: doc/ の設計書を docs/architecture/ へ統合（移動）する
status: done
created: 2026-10-19 14:30:02
updated: 2026-10-19 22:42:40
phase: closing
phase_status: done
branch: item/0002-merge-doc-into-architecture
parent: null
children: []
discussions: []
adrs: []
---
# doc/ の設計書を docs/architecture/ へ統合（移動）する

## 概要

旧管理番号: Item 0002

ai-dev-standard の導入により、システム全体の最新設計（マスタードキュメント）の置き場所は `docs/architecture/` になった。一方、既存の設計書5本は `doc/` にあり、マスタードキュメントの置き場所が2つに分かれている。`doc/` の内容を `docs/architecture/` へ移動して一本化し、以降の Item のマスタードキュメント反映先を `docs/architecture/` に統一する。

対象（2026-10-19 時点）:

- `doc/00.Overview.md`（製品概要・ドキュメントマップ）
- `doc/01.Architecture.md`（システム構造）
- `doc/02.Data-Format-Spec.md`（データフォーマット）
- `doc/03.UI-UX-Specification.md`（UI/UX 仕様）
- `doc/04.Non-Functional.md`（非機能要件）

## AC（受け入れ条件）

* [x] `doc/` の5文書が `docs/architecture/` に移動され、`doc/` ディレクトリが残っていない。
* [x] 文書の内容（記述そのもの）は、パスやリンクの修正を除いて変わっていない。
* [x] 文書間の相対リンクと、`00.Overview.md` のドキュメントマップ（`doc/` のツリー表記を含む）が新しい配置で正しく辿れる。
* [x] `docs/architecture/README.md` に、配置した文書の一覧と役割が記載されている。
* [x] リポジトリ内に `doc/` を指す参照が残っていない。
* [x] `git mv` で移動し、変更履歴を追えるようにする。
* [x] `check-docs` が OK で終了する。

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
| `R` | `doc/00.Overview.md -> docs/architecture/00.Overview.md` |
| `R` | `doc/01.Architecture.md -> docs/architecture/01.Architecture.md` |
| `R` | `doc/02.Data-Format-Spec.md -> docs/architecture/02.Data-Format-Spec.md` |
| `R` | `doc/03.UI-UX-Specification.md -> docs/architecture/03.UI-UX-Specification.md` |
| `R` | `doc/04.Non-Functional.md -> docs/architecture/04.Non-Functional.md` |
| `M` | `docs/architecture/README.md` |

<!-- AICO:AUTO:END:changed-files -->

## DoD（完了の定義）

* **AC 検証結果と根拠**：`doc/` 配下5文書を `git mv` で `docs/architecture/` へ移動し、`00.Overview.md`・`docs/architecture/README.md` の更新および当時の `check-docs` 通過を確認済み。
* **未検証項目と人の判断結果**：なし
* **プロジェクト側設計書・仕様書の更新確認**：完了（本チケット自体がマスタードキュメント `docs/architecture/` への統合）。
* **ADR の要否判断**：不要（ドキュメント再配置のみのため）。
* **関連記録への導線確認**：確認済み

## 親子チケット・関連

* 旧管理番号: Item 0002（元ファイル: `backlog/archive/0002-merge-doc-into-architecture.md`）
* 作業計画: [plan.md](plan.md)

### 旧 Item メモ

- `docs/architecture/` はプロジェクト所有の領域で、sync では変更されない（`tools/ai-standard/manifest.txt` の記載による）。
- ファイル名の番号付け（`00.`〜`04.`）を維持するか改めるかは、着手時に決めてよい。改める場合はリンクもあわせて修正する。
