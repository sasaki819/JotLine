---
name: aico-runbook-run
description: Runbook 手順書に従って定常作業を実施し、実施記録・添付物・異常引き継ぎを残す。
---

# aico-runbook-run

## 目的

Runbook 手順書に従って定常作業を確実に実施し、実施記録と証跡（ログ・添付ファイル等）を所定のフォルダへ残す。

## 入力

* 対象 Runbook の `slug`（再開時は既存実施記録 ID `<runbook>/<record-id>` または `<record-id>`）

## 前提条件

* 現在の Git ブランチが `integration_branch` であること。
* 対象 `management/05.runbooks/<slug>/runbook.md` が存在すること。

## 手順

1. 新規実施時は `create_runbook_record.py` で実施記録フォルダを作成する（初期状態は `status: in-progress`）。
   ```bash
   uv run <管理ルート>/scripts/create_runbook_record.py --runbook <runbook> --slug <record-slug> --title "<件名>" --json
   ```
2. 手順書の前提条件・入力・各ステップを順に実施する（定型コマンド実行やログ抽出は推奨ワーカー `worker-low` へ委譲可）。実行ログや出力ファイル等の添付物は同じ実施記録フォルダ内へ格納し、相対リンクで参照する。  
   サブエージェントワーカーへ委譲する際は、親セッションの会話履歴が引き継がれない前提で、必ず以下の5項目をプロンプトへ明示する。
1. 参照する手順書・スキルパス
2. 対象範囲（ファイル・調査対象・比較基点コミット等）
3. 入力条件・制約（前提条件・対象外・守るべき規約）
4. 変更可否（読み取り専用か、許可する編集範囲はどこか）
5. 期待する成果と報告形式（出力先パス・実行環境・未確認事項を含む）
3. 完了条件を実物照合で検証する。未検証項目がある場合は人間へ判断を求め、判断結果と追跡先を記録する。実施結果に独立レビューが必要な場合は `aico-review` 以降のレビュー系スキルで `review/` 配下に証跡を残す。
4. 異常や改善課題が見つかった場合は `aico-discuss` または `aico-create-ticket`（`--followup-from` 指定）へ引き継ぎ、`followups` へ記録する。
5. `aico-markdown-write` に従って実施記録本文を更新し、人間承認後に `update_frontmatter.py` で `status`（`done` / `cancelled`、中断時は `in-progress` 維持）を更新し、`rebuild_indexes.py` で一覧を再生成する。

## 完了条件と状態更新

* 実施記録本文および添付物が整い、`status`（`in-progress` / `done` / `cancelled`）と一覧が更新されていること。

## 報告形式

* 実施記録パスと `status`
* 完了条件の検証結果（実行環境・未確認事項を含む）
* 添付物一覧および引き継ぎ先（ある場合）
