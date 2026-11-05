---
id: "0008"
title: "プロジェクト資材の用語を「マスター」「原本」に統一する"
status: done           # backlog / ready / in-progress / done / dropped
priority: medium       # high / medium / low
owner: ""
created: 2026-11-04
spec: "specs/0008-replace-seihon-terminology/"
discussions: []        # 例: [discussions/2026-10-15-auth-ideas.md]
---
## 概要
プロジェクト資材全体で使われている旧語（Unicode: U+6B63 U+672C）を、意味に応じて「マスター」または「原本」に訂正する。唯一の本体・最新の基準となる文書などは「マスター」、派生物を作る元の資料は「原本」と呼ぶ。用語の定義、雛形、手順書、既存の文書・記録を対象とする。

## 受入基準
- プロジェクト資材にある旧語の用例を確認し、唯一の本体を指す場合は「マスター」、派生元を指す場合は「原本」に意味を保って修正する。
- `docs/architecture/` を指す用語と関連する Task 名・説明は「マスタードキュメント」に統一する。
- AGENTS.md の標準管理領域、および `.agents/skills/`・`.claude/skills/` など標準管理対象の内容は、管理元の ai-dev-standard を更新して sync で反映する。管理対象ファイルを直接編集しない。
- 雛形、運用文書、Spec、Backlog の Item、作業記録など既存のプロジェクト資材も対象に含め、置換後に旧語が残っていない。
- `bash tools/ai-standard/check-docs.sh` が成功する。

## タスク（Spec を作らない小規模な Item の場合のみ）

## メモ
