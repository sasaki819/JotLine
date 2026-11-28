---
id: 20261104-221108-ticket-replace-seihon-terminology
title: プロジェクト資材の用語を「マスター」「原本」に統一する
status: done
created: 2026-11-04 22:11:08
updated: 2026-11-06 02:59:08
phase: closing
phase_status: done
branch: feature/0008-replace-seihon-terminology
parent: null
children: []
discussions: []
adrs: []
---
# プロジェクト資材の用語を「マスター」「原本」に統一する

## 概要

旧管理番号: Item 0008

プロジェクト資材全体で使われている旧語（Unicode: U+6B63 U+672C）を、意味に応じて「マスター」または「原本」に訂正する。唯一の本体・最新の基準となる文書などは「マスター」、派生物を作る元の資料は「原本」と呼ぶ。用語の定義、雛形、手順書、既存の文書・記録を対象とする。

## AC（受け入れ条件）

* [x] プロジェクト資材にある旧語の用例を確認し、唯一の本体を指す場合は「マスター」、派生元を指す場合は「原本」に意味を保って修正する。
* [x] `docs/architecture/` を指す用語と関連する Task 名・説明は「マスタードキュメント」に統一する。
* [x] AGENTS.md の標準管理領域、および `.agents/skills/`・`.claude/skills/` など標準管理対象の内容は、管理元の ai-dev-standard を更新して sync で反映する。管理対象ファイルを直接編集しない。
* [x] 雛形、運用文書、Spec、Backlog の Item、作業記録など既存のプロジェクト資材も対象に含め、置換後に旧語が残っていない。
* [x] `bash tools/ai-standard/check-docs.sh` が成功する。

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
| `M` | `.agents/skills/close-item/SKILL.md` |
| `M` | `.agents/skills/implement-task/SKILL.md` |
| `M` | `.agents/skills/new-item/SKILL.md` |
| `M` | `.agents/skills/new-spec/SKILL.md` |
| `M` | `.agents/skills/pr-draft/SKILL.md` |
| `M` | `.ai-standard-version` |
| `M` | `.claude/skills/close-item/SKILL.md` |
| `M` | `.claude/skills/implement-task/SKILL.md` |
| `M` | `.claude/skills/new-item/SKILL.md` |
| `M` | `.claude/skills/new-spec/SKILL.md` |
| `M` | `.claude/skills/pr-draft/SKILL.md` |
| `M` | `.gitlab/merge_request_templates/AI-Standard.md` |
| `M` | `AGENTS.md` |
| `M` | `docs/ai-dev-standard-guide.md` |
| `M` | `docs/ai-dev-standard-process.md` |
| `M` | `docs/architecture/00.Overview.md` |
| `M` | `docs/architecture/README.md` |
| `M` | `docs/process.md` |
| `M` | `templates/item.md` |
| `M` | `templates/spec/design.md` |
| `M` | `templates/spec/tasks.md` |

<!-- AICO:AUTO:END:changed-files -->

## DoD（完了の定義）

* **AC 検証結果と根拠**：管理元と本リポジトリ双方で旧語（U+6B63 U+672C）が 0 件となり、再同期・ビルド・テスト・型検査・AI レビュー（指摘0件）すべて通過。
* **未検証項目と人の判断結果**：なし
* **プロジェクト側設計書・仕様書の更新確認**：反映済み（`docs/architecture/00.Overview.md`、`docs/architecture/README.md`）。
* **ADR の要否判断**：不要（用語統一のみでありアーキテクチャ決定ではないため）。
* **関連記録への導線確認**：確認済み

## 親子チケット・関連

* 旧管理番号: Item 0008（元ファイル: `backlog/archive/0008-replace-seihon-terminology.md`）
* 作業計画（旧 `requirements.md`・`tasks.md`）: [plan.md](plan.md)
* 設計詳細（旧 `design.md`）: [notes/001-design.md](notes/001-design.md)
* 作業ログ・判断履歴（旧 `progress.md`）: [notes/002-progress.md](notes/002-progress.md)
* レビュー記録: [review/index.md](review/index.md)
