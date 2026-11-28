---
name: aico-create-runbook
description: 繰り返し実施する定常作業を手順書（Runbook）として作成または改訂し、一覧を更新する。
---

# aico-create-runbook

## 目的

繰り返し実施する定常作業を再現可能な手順書（Runbook）として資産化・改訂する。

## 入力

* Runbook の `slug`・件名・対象手順（改訂時は既存 `slug`）

## 前提条件

* 現在の Git ブランチが `integration_branch` であること。

## 手順

1. 新規作成時は `create_runbook.py` で手順書雛形を生成する。
   ```bash
   uv run <管理ルート>/scripts/create_runbook.py --slug <slug> --title "<件名>" --json
   ```
2. 既存資料や過去ログから手順を構造化する必要がある場合は、必要時 `worker-middle` または `worker-low` へ委譲する。  
   サブエージェントワーカーへ委譲する際は、親セッションの会話履歴が引き継がれない前提で、必ず以下の5項目をプロンプトへ明示する。
1. 参照する手順書・スキルパス
2. 対象範囲（ファイル・調査対象・比較基点コミット等）
3. 入力条件・制約（前提条件・対象外・守るべき規約）
4. 変更可否（読み取り専用か、許可する編集範囲はどこか）
5. 期待する成果と報告形式（出力先パス・実行環境・未確認事項を含む）
3. `aico-markdown-write` に従って `runbook.md` の各見出し（概要・前提条件・入力・手順・完了条件・異常時の対応・改訂履歴）を記入・改訂し、人間へ提示して承認を得る。
4. 改訂時は `update_frontmatter.py` 等で `updated` 日時を更新し、`rebuild_indexes.py` で一覧を再生成する。
   ```bash
   uv run <管理ルート>/scripts/rebuild_indexes.py --json
   ```

## 完了条件と状態更新

* `management/05.runbooks/<slug>/runbook.md` が人間承認済みで保存され、`05.runbooks/index.md` およびダッシュボードが更新されていること（手順書に `status` は設けない）。

## 報告形式

* Runbook パス
* 作成・改訂の要点
* 一覧再生成の結果
