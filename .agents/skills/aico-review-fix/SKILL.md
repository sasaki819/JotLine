---
name: aico-review-fix
description: 人間が採用した（in-progress）レビュー指摘をすべて修正し、修正内容と関連コミットを記録する。
---

# aico-review-fix

## 目的

人間が採用したレビュー指摘（`status: in-progress`）をすべて修正・検証し、各指摘ファイルへ修正経緯を記録する。

## 入力

* 対象チケット ID または Runbook 実施記録 ID（省略可）
* 対象 ID の指定が省略された場合は、以下の3段階フォールバックで解決する。
1. ユーザーの明示指定（ID・`slug`・パス）。
2. `uv run <管理ルート>/scripts/ticket_status.py --json` による現在の Git ブランチと `branch` 属性の照合。
3. 自動特定できない場合は該当状態の候補一覧を提示して人間に選択してもらう。

## 前提条件

* **チケット対象時**：作業ブランチ上であること、`status: in-progress`・`phase_status: fixing` であること。
* **Runbook 実施記録対象時**：統合ブランチ上であること、`review/findings/` に `status: in-progress` の指摘が存在すること。

## 手順

1. `review/findings/` から `status: in-progress` の指摘をすべて抽出する。
2. 各指摘に対して修正と必要なテスト検証を実施する（推奨ワーカー：原則 `worker-middle`、定型修正は `worker-low`、難原因の修正は `worker-high`）。  
   サブエージェントワーカーへ委譲する際は、親セッションの会話履歴が引き継がれない前提で、必ず以下の5項目をプロンプトへ明示する。
1. 参照する手順書・スキルパス
2. 対象範囲（ファイル・調査対象・比較基点コミット等）
3. 入力条件・制約（前提条件・対象外・守るべき規約）
4. 変更可否（読み取り専用か、許可する編集範囲はどこか）
5. 期待する成果と報告形式（出力先パス・実行環境・未確認事項を含む）
3. `aico-markdown-write` に従い、各指摘ファイルの `## 修正内容` に修正概要と関連コミットを記録する。なお、指摘の `status` は独立再確認が完了するまで `in-progress` のまま維持する。
4. すべての採用指摘への修正が完了したら人間へ報告し、チケット対象時は `update_frontmatter.py` で `phase_status: re-reviewing` へ更新する（Runbook 実施記録時は `phase_status` を更新しない）。
   ```bash
   uv run <管理ルート>/scripts/update_frontmatter.py --file <チケットindex.md> --set phase_status=re-reviewing --json
   ```

## 完了条件と状態更新

* すべての採用指摘が修正され、`## 修正内容` が記録されていること（各指摘の `status` は `in-progress` 維持）。
* チケット対象時：`<phase> / re-reviewing` へ更新されていること。

## 報告形式

* 修正した指摘 ID 一覧
* 関連コミットとテスト検証結果（実行環境・未確認事項を含む）
* 次のアクションを推奨案先頭の番号付き Markdown 選択肢（2〜4件）で案内する（推奨：`aico-review-recheck`）
